import { MarkdownRenderChild, TFile, type App, type MarkdownPostProcessorContext } from "obsidian";

import { applyEmbedDimensions, parseEmbedDimensions, type HtmlEmbedSpec } from "./HtmlEmbedParser";
import { HtmlPreviewRenderer } from "../render/HtmlPreviewRenderer";
import { renderHtmlForPreview } from "../security/HtmlSecurityPolicy";
import type { HtmlVEditorSettings } from "../settings/settings";

export interface HtmlVCodeBlockProcessorOptions {
  app: App;
  getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>;
}

export class HtmlVCodeBlockProcessor {
  constructor(private options: HtmlVCodeBlockProcessorOptions) {}

  process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    el.empty();
    el.addClass("html-v-code-block");
    void this.applyDimensions(source, el, ctx);

    const previewEl = el.createDiv({ cls: "html-v-code-block-preview" });
    const renderer = new HtmlPreviewRenderer();
    void this.options.getPreviewSettings(ctx.sourcePath, source).then((settings) => {
      const preview = renderHtmlForPreview(source, settings);
      renderer.render(previewEl, preview.html, {
        sandbox: preview.sandbox
      });
    });

    ctx.addChild(new HtmlVCodeBlockRenderChild(el, renderer));
  }

  private async applyDimensions(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
    if (!el.isConnected) {
      return;
    }

    applyEmbedDimensions(el, await this.getHtmlVCodeBlockDimensions(source, el, ctx));
  }

  private async getHtmlVCodeBlockDimensions(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<Pick<HtmlEmbedSpec, "width" | "height">> {
    const section = ctx.getSectionInfo(el);
    const sectionOpeningLine = section?.text.split(/\r?\n/, 1)[0];
    const sectionDimensions = parseHtmlVOpeningLineDimensions(sectionOpeningLine);
    if (sectionDimensions.width || sectionDimensions.height) {
      return sectionDimensions;
    }

    const file = this.options.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof TFile)) {
      return {};
    }

    const data = await this.options.app.vault.cachedRead(file);
    const lines = data.split(/\r?\n/);
    const lineStart = section?.lineStart;
    if (typeof lineStart === "number") {
      const byLine = findNearbyHtmlVOpeningLine(lines, lineStart, source);
      const lineDimensions = parseHtmlVOpeningLineDimensions(byLine);
      if (lineDimensions.width || lineDimensions.height) {
        return lineDimensions;
      }
    }

    return parseHtmlVOpeningLineDimensions(findMatchingHtmlVOpeningLine(data, source));
  }
}

function parseHtmlVOpeningLineDimensions(openingLine: string | undefined): Pick<HtmlEmbedSpec, "width" | "height"> {
  const params = openingLine?.match(/^\s{0,3}(?:`{3,}|~{3,})\s*html-v(?:\s+(.+?))?\s*$/i)?.[1];
  return parseEmbedDimensions(params);
}

function findNearbyHtmlVOpeningLine(lines: string[], lineStart: number, source: string): string | undefined {
  for (let line = Math.max(0, lineStart - 3); line <= Math.min(lines.length - 1, lineStart + 3); line += 1) {
    if (isHtmlVOpeningLine(lines[line]) && isMatchingHtmlVBlock(lines, line, source)) {
      return lines[line];
    }
  }

  return undefined;
}

function findMatchingHtmlVOpeningLine(data: string, source: string): string | undefined {
  const lines = data.split(/\r?\n/);
  for (let line = 0; line < lines.length; line += 1) {
    if (isHtmlVOpeningLine(lines[line]) && isMatchingHtmlVBlock(lines, line, source)) {
      return lines[line];
    }
  }

  return undefined;
}

function isMatchingHtmlVBlock(lines: string[], openingLine: number, source: string): boolean {
  const marker = lines[openingLine]?.match(/^\s{0,3}(`{3,}|~{3,})\s*html-v(?:\s+.*?)?\s*$/i)?.[1];
  if (!marker) {
    return false;
  }

  const closeLine = findFenceCloseLine(lines, openingLine + 1, marker);
  if (closeLine <= openingLine) {
    return false;
  }

  return normalizeHtmlForMatch(lines.slice(openingLine + 1, closeLine).join("\n")) === normalizeHtmlForMatch(source);
}

function isHtmlVOpeningLine(line: string | undefined): boolean {
  return /^\s{0,3}(?:`{3,}|~{3,})\s*html-v(?:\s+.*?)?\s*$/i.test(line ?? "");
}

function findFenceCloseLine(lines: string[], startLine: number, marker: string): number {
  const markerChar = marker[0] ?? "`";
  const pattern = new RegExp(`^\\s{0,3}${escapeRegExp(markerChar)}{${marker.length},}\\s*$`);
  for (let line = startLine; line < lines.length; line += 1) {
    if (pattern.test(lines[line] ?? "")) {
      return line;
    }
  }

  return -1;
}

function normalizeHtml(html: string): string {
  return html.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/g, "");
}

function normalizeHtmlForMatch(html: string): string {
  return normalizeHtml(html).trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class HtmlVCodeBlockRenderChild extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement, private renderer: HtmlPreviewRenderer) {
    super(containerEl);
  }

  onunload(): void {
    this.renderer.destroy();
  }
}
