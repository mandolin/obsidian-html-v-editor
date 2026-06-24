import { MarkdownRenderChild, type App, type MarkdownPostProcessorContext } from "obsidian";

import { HtmlPreviewRenderer } from "../render/HtmlPreviewRenderer";
import { renderHtmlForPreview } from "../security/HtmlSecurityPolicy";
import type { HtmlVEditorSettings } from "../settings/settings";

export interface RawHtmlBlockProcessorOptions {
  app: App;
  getSettings: () => HtmlVEditorSettings;
  getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>;
}

const BLOCK_TAGS = new Set([
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "div",
  "figure",
  "footer",
  "form",
  "header",
  "main",
  "nav",
  "ol",
  "section",
  "table",
  "ul"
]);

export class RawHtmlBlockProcessor {
  constructor(private options: RawHtmlBlockProcessorOptions) {}

  process(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (!this.options.getSettings().livePreviewHtmlWidgets || el.hasClass("html-v-raw-html-processed")) {
      return;
    }

    const section = ctx.getSectionInfo(el);
    const blocks = extractRawHtmlBlocks(section?.text ?? "");
    if (!blocks.length) {
      return;
    }

    el.addClass("html-v-raw-html-processed");

    for (const block of blocks) {
      const targetEl = findRenderedBlock(el, block);
      if (!targetEl) {
        continue;
      }

      const containerEl = document.createElement("div");
      containerEl.addClass("html-v-raw-html-block");
      const previewEl = containerEl.createDiv({ cls: "html-v-raw-html-preview" });
      targetEl.replaceWith(containerEl);

      const renderer = new HtmlPreviewRenderer();
      void this.options.getPreviewSettings(ctx.sourcePath, block.html).then((settings) => {
        const preview = renderHtmlForPreview(block.html, settings);
        renderer.render(previewEl, preview.html, {
          sandbox: preview.sandbox
        });
      }).catch((error) => {
        console.error("Failed to render raw HTML block", error);
        previewEl.empty();
        previewEl.createDiv({
          cls: "html-v-live-widget-error",
          text: "Unable to render HTML preview."
        });
      });

      ctx.addChild(new RawHtmlBlockRenderChild(containerEl, renderer));
    }
  }
}

class RawHtmlBlockRenderChild extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement, private renderer: HtmlPreviewRenderer) {
    super(containerEl);
  }

  onunload(): void {
    this.renderer.destroy();
  }
}

interface RawHtmlBlock {
  tagName: string;
  html: string;
  text: string;
}

const BLOCK_START_PATTERN = /^\s*<([a-z][\w:-]*)(?:\s[^<>]*)?>/i;

function extractRawHtmlBlocks(source: string): RawHtmlBlock[] {
  const blocks: RawHtmlBlock[] = [];
  const lines = source.split("\n");
  let inFence = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const trimmed = line.trim();

    if (/^```/.test(trimmed) || /^~~~/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const start = line.match(BLOCK_START_PATTERN);
    const tagName = start?.[1]?.toLowerCase();
    if (!tagName || !BLOCK_TAGS.has(tagName)) {
      continue;
    }

    const close = findClosingLine(lines, lineIndex, tagName);
    if (close < lineIndex) {
      continue;
    }

    blocks.push({
      tagName,
      html: lines.slice(lineIndex, close + 1).join("\n").trim(),
      text: htmlToText(lines.slice(lineIndex, close + 1).join("\n"))
    });
    lineIndex = close;
  }

  return blocks;
}

function findClosingLine(lines: string[], startLine: number, tagName: string): number {
  let depth = 0;
  const tagPattern = new RegExp(`<(/?)${escapeRegExp(tagName)}(?:\\s[^<>]*)?>`, "gi");

  for (let lineIndex = startLine; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    for (const match of line.matchAll(tagPattern)) {
      const raw = match[0];
      if (match[1] === "/") {
        depth -= 1;
      } else if (!raw.endsWith("/>")) {
        depth += 1;
      }

      if (depth === 0) {
        return lineIndex;
      }
    }
  }

  return -1;
}

function findRenderedBlock(rootEl: HTMLElement, block: RawHtmlBlock): HTMLElement | null;
function findRenderedBlock(rootEl: HTMLElement, tagName: string): HTMLElement | null;
function findRenderedBlock(rootEl: HTMLElement, blockOrTagName: RawHtmlBlock | string): HTMLElement | null {
  const block = typeof blockOrTagName === "string" ? null : blockOrTagName;
  const tagName = typeof blockOrTagName === "string" ? blockOrTagName : blockOrTagName.tagName;
  const candidates: HTMLElement[] = [];
  if (rootEl.matches(tagName)) {
    candidates.push(rootEl);
  }
  candidates.push(...Array.from(rootEl.querySelectorAll<HTMLElement>(tagName)));

  return candidates.find((candidate) => {
    if (candidate.hasClass("html-v-raw-html-block")) {
      return false;
    }

    if (candidate.closest(".html-v-raw-html-block, .html-v-file-embed, .html-v-code-block, .html-v-live-widget, .html-v-editor-root")) {
      return false;
    }

    if (candidate.closest("pre, code")) {
      return false;
    }

    if (block && !isSameRenderedText(candidate, block.text)) {
      return false;
    }

    const sameTagAncestor = candidate.parentElement?.closest(tagName);
    return !sameTagAncestor || !rootEl.contains(sameTagAncestor);
  }) ?? null;
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return normalizeRenderedText(doc.body.textContent ?? "");
}

function isSameRenderedText(candidate: HTMLElement, expectedText: string): boolean {
  const actualText = normalizeRenderedText(candidate.textContent ?? "");
  if (!actualText || !expectedText) {
    return false;
  }

  return actualText === expectedText || actualText.includes(expectedText) || expectedText.includes(actualText);
}

function normalizeRenderedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
