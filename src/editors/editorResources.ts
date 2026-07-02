import { TFile, normalizePath, type App } from "obsidian";

export function getEditorDocumentBaseUrl(app: App, sourcePath: string | undefined): string | undefined {
  if (!sourcePath) {
    return undefined;
  }

  const resourcePath = app.vault.adapter.getResourcePath(normalizePath(sourcePath));
  try {
    return new URL(".", resourcePath).href;
  } catch {
    return resourcePath.replace(/\/[^/?#]*(?:[?#].*)?$/, "/");
  }
}

export function resolveVaultResourceUrl(app: App, sourcePath: string | undefined, resourcePath: string | null): string | null {
  if (!sourcePath || !resourcePath) {
    return resourcePath;
  }

  const decodedResourcePath = decodeHtmlResourcePath(resourcePath);
  const absoluteVaultPath = getVaultPathFromAbsoluteOrAppUrl(app, decodedResourcePath);
  if (shouldKeepResourceUrl(decodedResourcePath) && !absoluteVaultPath) {
    return resourcePath;
  }

  const sourceFolder = getParentPath(sourcePath);
  const vaultPath = absoluteVaultPath ?? (decodedResourcePath.startsWith("/")
    ? normalizePath(decodedResourcePath.slice(1))
    : normalizePath(sourceFolder ? `${sourceFolder}/${decodedResourcePath}` : decodedResourcePath));

  const file = app.vault.getAbstractFileByPath(vaultPath);
  if (file instanceof TFile) {
    return app.vault.getResourcePath(file);
  }

  return app.vault.adapter.getResourcePath(vaultPath);
}

export function rewriteHtmlResourceUrls(app: App, sourcePath: string | undefined, html: string): string {
  if (!sourcePath) {
    return html;
  }

  // 只在隔离文档中改写资源路径，避免直接 innerHTML 写入触发市场审核错误。
  const doc = new DOMParser().parseFromString(html, "text/html");

  rewriteElements(doc, "img[src],source[src],script[src],video[src],audio[src],iframe[src]", "src", (value) => {
    return resolveVaultResourceUrl(app, sourcePath, value);
  });
  rewriteElements(doc, "link[href],a[href]", "href", (value) => {
    return resolveVaultResourceUrl(app, sourcePath, value);
  });
  rewriteElements(doc, "[srcset]", "srcset", (value) => {
    return rewriteSrcset(app, sourcePath, value);
  });

  return doc.body.innerHTML;
}

function rewriteElements(doc: Document, selector: string, attr: string, rewrite: (value: string) => string | null): void {
  for (const element of Array.from(doc.body.querySelectorAll(selector))) {
    const value = element.getAttribute(attr);
    const nextValue = value ? rewrite(value) : value;
    if (nextValue && nextValue !== value) {
      element.setAttribute(attr, nextValue);
    }
  }
}

function rewriteSrcset(app: App, sourcePath: string, value: string): string {
  return value.split(",").map((candidate) => {
    const trimmed = candidate.trim();
    const match = trimmed.match(/^(\S+)(.*)$/);
    if (!match) {
      return candidate;
    }

    const nextUrl = resolveVaultResourceUrl(app, sourcePath, match[1]);
    return nextUrl ? `${nextUrl}${match[2]}` : candidate;
  }).join(", ");
}

function shouldKeepResourceUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return true;
  }

  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    || trimmed.startsWith("//");
}

function decodeHtmlResourcePath(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function getVaultPathFromAbsoluteOrAppUrl(app: App, value: string): string | null {
  const appUrlPath = getPathnameFromAppUrl(value);
  const candidate = appUrlPath ?? value;
  const basePath = getVaultBasePath(app);
  if (!basePath) {
    return null;
  }

  const normalizedCandidate = normalizePath(candidate.replace(/^\/([A-Za-z]:\/)/, "$1"));
  const normalizedBase = normalizePath(basePath);
  if (normalizedCandidate.toLowerCase() === normalizedBase.toLowerCase()) {
    return "";
  }

  // Obsidian 复制出的 app:// 或 Windows 绝对路径，只要落在当前 vault 内，就转回 vault 相对路径。
  const basePrefix = `${normalizedBase}/`.toLowerCase();
  if (normalizedCandidate.toLowerCase().startsWith(basePrefix)) {
    return normalizedCandidate.slice(normalizedBase.length + 1);
  }

  return null;
}

function getPathnameFromAppUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "app:" ? decodeURI(url.pathname) : null;
  } catch {
    return null;
  }
}

function getVaultBasePath(app: App): string | null {
  const adapter = app.vault.adapter as { getBasePath?: () => string };
  return typeof adapter.getBasePath === "function" ? adapter.getBasePath() : null;
}

function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}
