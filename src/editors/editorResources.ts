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
  if (!sourcePath || !resourcePath || shouldKeepResourceUrl(resourcePath)) {
    return resourcePath;
  }

  const decodedResourcePath = decodeHtmlResourcePath(resourcePath);
  const sourceFolder = getParentPath(sourcePath);
  const vaultPath = decodedResourcePath.startsWith("/")
    ? normalizePath(decodedResourcePath.slice(1))
    : normalizePath(sourceFolder ? `${sourceFolder}/${decodedResourcePath}` : decodedResourcePath);

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

  const doc = document.implementation.createHTMLDocument("HTML V Editor Preview Resources");
  doc.body.innerHTML = html;

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

function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}
