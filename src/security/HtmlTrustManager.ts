import { TFile, normalizePath, type App } from "obsidian";

import type { HtmlPreviewSecurityLevel, HtmlTrustRule, HtmlVEditorSettings } from "../settings/settings";

export interface HtmlPreviewContext {
  sourcePath?: string;
  html?: string;
}

interface HtmlVFolderConfig {
  trust?: HtmlTrustRule[];
  htmlVEditor?: {
    trust?: HtmlTrustRule[];
  };
}

export class HtmlTrustManager {
  constructor(private app: App, private getSettings: () => HtmlVEditorSettings) {}

  async getPreviewSettings(context: HtmlPreviewContext = {}): Promise<HtmlVEditorSettings> {
    const base = this.getSettings();
    const rules = [
      ...(base.trustRules ?? []),
      ...(await this.loadFolderTrustRules(context.sourcePath))
    ];
    const securityLevel = this.resolveSecurityLevel(base.defaultSecurityLevel, rules, context);

    return {
      ...base,
      defaultSecurityLevel: securityLevel
    };
  }

  private async loadFolderTrustRules(sourcePath: string | undefined): Promise<HtmlTrustRule[]> {
    const settings = this.getSettings();
    if (!settings.enableFolderTrustFiles || !sourcePath) {
      return [];
    }

    const folders = getAncestorFolders(sourcePath);
    const rules: HtmlTrustRule[] = [];

    for (const folder of folders) {
      const configPath = normalizePath(folder ? `${folder}/.htmlv` : ".htmlv");
      const file = this.app.vault.getAbstractFileByPath(configPath);
      if (!(file instanceof TFile)) {
        continue;
      }

      try {
        const config = JSON.parse(await this.app.vault.cachedRead(file)) as HtmlVFolderConfig;
        rules.push(...normalizeTrustRules(config.trust));
        rules.push(...normalizeTrustRules(config.htmlVEditor?.trust));
      } catch (error) {
        console.warn(`HTML V Editor ignored invalid trust file: ${configPath}`, error);
      }
    }

    return rules;
  }

  private resolveSecurityLevel(
    fallback: HtmlPreviewSecurityLevel,
    rules: HtmlTrustRule[],
    context: HtmlPreviewContext
  ): HtmlPreviewSecurityLevel {
    let level = fallback;

    for (const rule of rules) {
      if (!isValidSecurityLevel(rule.securityLevel)) {
        continue;
      }

      if (rule.scope === "file" && context.sourcePath && normalizePath(rule.pattern) === normalizePath(context.sourcePath)) {
        level = rule.securityLevel;
      }

      if (rule.scope === "folder" && context.sourcePath && isPathInFolder(context.sourcePath, rule.pattern)) {
        level = rule.securityLevel;
      }

      if (rule.scope === "source" && context.html && htmlMatchesSourceRule(context.html, rule.pattern)) {
        level = rule.securityLevel;
      }
    }

    return level;
  }
}

function normalizeTrustRules(rules: HtmlTrustRule[] | undefined): HtmlTrustRule[] {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules.filter((rule) => (
    (rule.scope === "file" || rule.scope === "folder" || rule.scope === "source")
    && typeof rule.pattern === "string"
    && isValidSecurityLevel(rule.securityLevel)
  ));
}

function isValidSecurityLevel(level: string): level is HtmlPreviewSecurityLevel {
  return level === "safe" || level === "sandbox" || level === "trusted";
}

function getAncestorFolders(path: string): string[] {
  const parts = normalizePath(path).split("/");
  parts.pop();

  const folders = [""];
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    folders.push(current);
  }

  return folders;
}

function isPathInFolder(path: string, folderPattern: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(folderPattern).replace(/\/+$/g, "");
  return normalizedFolder === "" || normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
}

function htmlMatchesSourceRule(html: string, pattern: string): boolean {
  const origins = extractExternalOrigins(html);
  if (origins.includes(pattern)) {
    return true;
  }

  const regexMatch = pattern.match(/^\/(.+)\/([a-z]*)$/i);
  if (!regexMatch) {
    return false;
  }

  try {
    const regex = new RegExp(regexMatch[1], regexMatch[2]);
    return origins.some((origin) => regex.test(origin));
  } catch {
    return false;
  }
}

function extractExternalOrigins(html: string): string[] {
  const origins = new Set<string>();
  // 用 DOMParser 提取外链来源，避免对临时文档执行 innerHTML 赋值。
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const element of Array.from(doc.body.querySelectorAll("[src], [href]"))) {
    const value = element.getAttribute("src") ?? element.getAttribute("href");
    if (!value || !/^https?:\/\//i.test(value)) {
      continue;
    }

    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore invalid URLs.
    }
  }

  return Array.from(origins);
}
