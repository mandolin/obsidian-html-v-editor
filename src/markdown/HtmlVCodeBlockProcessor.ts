import { MarkdownRenderChild, Notice, TFile, type App, type MarkdownPostProcessorContext } from "obsidian";

import { HtmlBlockEditModal } from "../modals/HtmlBlockEditModal";
import { HtmlPreviewRenderer } from "../render/HtmlPreviewRenderer";
import { renderHtmlForPreview } from "../security/HtmlSecurityPolicy";
import type { HtmlVEditorSettings } from "../settings/settings";

export interface HtmlVCodeBlockProcessorOptions {
  app: App;
  assetsBaseUrl: string;
  getSettings: () => HtmlVEditorSettings;
  getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>;
}

export class HtmlVCodeBlockProcessor {
  constructor(private options: HtmlVCodeBlockProcessorOptions) {}

  process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    el.empty();
    el.addClass("html-v-code-block");

    const headerEl = el.createDiv({ cls: "html-v-code-block-header" });
    headerEl.createSpan({ cls: "html-v-code-block-title", text: "HTML V" });
    const editButton = headerEl.createEl("button", {
      cls: "html-v-code-block-edit-button",
      text: "Edit"
    });

    const previewEl = el.createDiv({ cls: "html-v-code-block-preview" });
    const renderer = new HtmlPreviewRenderer();
    void this.options.getPreviewSettings(ctx.sourcePath, source).then((settings) => {
      const preview = renderHtmlForPreview(source, settings);
      renderer.render(previewEl, preview.html, {
        sandbox: preview.sandbox
      });
    });

    ctx.addChild(new HtmlVCodeBlockRenderChild(el, renderer));

    editButton.addEventListener("click", () => {
      void this.openEditor(source, el, ctx);
    });
  }

  private async openEditor(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
    const file = this.options.app.vault.getAbstractFileByPath(ctx.sourcePath);

    if (!(file instanceof TFile)) {
      new Notice("Unable to find the source Markdown file.");
      return;
    }

    const section = ctx.getSectionInfo(el);
    if (!section) {
      new Notice("Unable to locate this html-v code block.");
      return;
    }

    new HtmlBlockEditModal(this.options.app, {
      initialHtml: source,
      defaultEditorId: this.options.getSettings().defaultEditor,
      assetsBaseUrl: this.options.assetsBaseUrl,
      sourceEditorMode: this.options.getSettings().defaultSourceEditorMode,
      onSave: async (nextHtml) => {
        await replaceHtmlVCodeBlock(this.options.app, file, section.lineStart, section.lineEnd, nextHtml);
        new Notice("html-v block saved.");
      }
    }).open();
  }
}

class HtmlVCodeBlockRenderChild extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement, private renderer: HtmlPreviewRenderer) {
    super(containerEl);
  }

  onunload(): void {
    this.renderer.destroy();
  }
}

async function replaceHtmlVCodeBlock(app: App, file: TFile, lineStart: number, lineEnd: number, nextHtml: string): Promise<void> {
  await app.vault.process(file, (data) => {
    const lines = data.split(/\r?\n/);
    const eol = data.includes("\r\n") ? "\r\n" : "\n";
    const blockLines = lines.slice(lineStart, lineEnd + 1);

    if (blockLines.length < 2 || !/^```\s*html-v\s*$/i.test(blockLines[0].trim()) || !/^```\s*$/.test(blockLines[blockLines.length - 1].trim())) {
      throw new Error("The original html-v code block could not be verified.");
    }

    const nextLines = [
      blockLines[0],
      ...normalizeBlockHtml(nextHtml).split(/\r?\n/),
      blockLines[blockLines.length - 1]
    ];

    lines.splice(lineStart, blockLines.length, ...nextLines);
    return lines.join(eol);
  });
}

function normalizeBlockHtml(html: string): string {
  return html.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/g, "");
}
