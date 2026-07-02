import { MarkdownRenderChild, TFile, type App, type MarkdownPostProcessorContext } from "obsidian";

import { applyEmbedDimensions, parseEmbedDimensions, type HtmlEmbedSpec } from "./HtmlEmbedParser";
import { HtmlPreviewRenderer } from "../render/HtmlPreviewRenderer";
import { renderHtmlForPreview } from "../security/HtmlSecurityPolicy";
import type { HtmlVEditorSettings } from "../settings/settings";
import { getEditorDocumentBaseUrl, rewriteHtmlResourceUrls } from "../editors/editorResources";

export interface HtmlVCodeBlockProcessorOptions {
  app: App;
  getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>;
}

export class HtmlVCodeBlockProcessor {
  constructor(private options: HtmlVCodeBlockProcessorOptions) {}

  process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    el.empty();
    el.addClass("html-v-code-block");

    const previewEl = el.createDiv({ cls: "html-v-code-block-preview" });
    const renderer = new HtmlPreviewRenderer();
    void this.options.getPreviewSettings(ctx.sourcePath, source).then((settings) => {
      const preview = renderHtmlForPreview(source, settings);
      renderer.render(previewEl, rewriteHtmlResourceUrls(this.options.app, ctx.sourcePath, preview.html), {
        sandbox: preview.sandbox,
        documentBaseUrl: getEditorDocumentBaseUrl(this.options.app, ctx.sourcePath)
      });
    });

    const child = new HtmlVCodeBlockRenderChild(el, renderer);
    ctx.addChild(child);
    child.applyDimensions(() => this.getHtmlVCodeBlockDimensions(source, el, ctx));
  }

  private async applyDimensions(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
    applyEmbedDimensions(el, await this.getHtmlVCodeBlockDimensions(source, el, ctx));
  }

  private async getHtmlVCodeBlockDimensions(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<Pick<HtmlEmbedSpec, "width" | "height">> {
    // 阅读模式下 Obsidian 有时只能从 sectionInfo 拿到渲染片段，所以先走最近上下文。
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
      // sectionInfo 的起始行可能略有偏移，附近搜索可以覆盖表格/标题等复杂布局后的定位误差。
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
  const normalizedSource = normalizeHtmlForMatch(source);
  for (const block of scanHtmlVBlocks(data)) {
    if (normalizeHtmlForMatch(block.html) === normalizedSource) {
      return block.openingLine;
    }
  }

  return undefined;
}

function scanHtmlVBlocks(data: string): Array<{ openingLine: string; html: string }> {
  const blocks: Array<{ openingLine: string; html: string }> = [];
  const lines = data.split(/\r?\n/);

  for (let line = 0; line < lines.length; line += 1) {
    const marker = lines[line]?.match(/^\s{0,3}(`{3,}|~{3,})\s*html-v(?:\s+.*?)?\s*$/i)?.[1];
    if (!marker) {
      continue;
    }

    const closeLine = findFenceCloseLine(lines, line + 1, marker);
    if (closeLine <= line) {
      continue;
    }

    blocks.push({
      openingLine: lines[line] ?? "",
      html: lines.slice(line + 1, closeLine).join("\n")
    });
    line = closeLine;
  }

  return blocks;
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
  private dimensionTimers: number[] = [];

  constructor(containerEl: HTMLElement, private renderer: HtmlPreviewRenderer) {
    super(containerEl);
  }

  applyDimensions(getDimensions: () => Promise<Pick<HtmlEmbedSpec, "width" | "height">>): void {
    const apply = () => {
      void getDimensions().then((dimensions) => {
        if (this.containerEl.isConnected) {
          applyEmbedDimensions(this.containerEl, dimensions);
        }
      });
    };

    apply();
    // 阅读模式渲染会被 Obsidian 后续布局覆盖，延迟重放几次可保证宽高最终落到容器上。
    for (const delay of [0, 50, 250]) {
      this.dimensionTimers.push(window.setTimeout(apply, delay));
    }
  }

  onunload(): void {
    this.dimensionTimers.forEach((timer) => window.clearTimeout(timer));
    this.dimensionTimers = [];
    this.renderer.destroy();
  }
}
