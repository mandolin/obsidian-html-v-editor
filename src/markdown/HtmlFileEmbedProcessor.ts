import { MarkdownRenderChild, TFile, type App, type MarkdownPostProcessorContext } from "obsidian";

import { HTML_FILE_EXTENSIONS } from "../constants";
import { HtmlPreviewRenderer } from "../render/HtmlPreviewRenderer";
import { renderHtmlForPreview } from "../security/HtmlSecurityPolicy";
import type { HtmlVEditorSettings } from "../settings/settings";
import { getEditorDocumentBaseUrl, rewriteHtmlResourceUrls } from "../editors/editorResources";
import { applyEmbedDimensions, parseHtmlEmbedText, type HtmlEmbedSpec } from "./HtmlEmbedParser";

export interface HtmlFileEmbedProcessorOptions {
  app: App;
  getSettings: () => HtmlVEditorSettings;
  getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>;
  assetsBaseUrl: string;
}

export class HtmlFileEmbedProcessor {
  constructor(private options: HtmlFileEmbedProcessorOptions) {}

  process(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const embeds = this.findCandidateEmbeds(el);
    const sourceSpecs = [
      ...extractHtmlEmbedSpecs(ctx.getSectionInfo(el)?.text ?? ""),
      ...this.getCachedEmbedSpecs(ctx.sourcePath)
    ];

    for (const embedEl of embeds) {
      const embed = this.resolveEmbeddedHtmlFile(embedEl, ctx.sourcePath, sourceSpecs);
      const file = embed?.file;
      if (!file) {
        continue;
      }

      const child = new HtmlFileEmbedRenderChild(embedEl, {
        app: this.options.app,
        assetsBaseUrl: this.options.assetsBaseUrl,
        file,
        embedSpec: embed.spec,
        sourcePath: ctx.sourcePath,
        getSettings: this.options.getSettings,
        getPreviewSettings: this.options.getPreviewSettings
      });
      ctx.addChild(child);
      child.render();
    }
  }

  private findCandidateEmbeds(el: HTMLElement): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    if (el.hasClass("internal-embed")) {
      candidates.push(el);
    }

    candidates.push(...Array.from(el.querySelectorAll<HTMLElement>(".internal-embed")));
    return candidates.filter((candidate) => {
      const parentEmbed = candidate.parentElement?.closest(".internal-embed");
      return !parentEmbed && !candidate.hasClass("html-v-file-embed-processed");
    });
  }

  private resolveEmbeddedHtmlFile(embedEl: HTMLElement, sourcePath: string, sourceSpecs: HtmlEmbedSpec[]): { file: TFile; spec: HtmlEmbedSpec } | null {
    const spec = mergeSourceSpec(getEmbedSpec(embedEl), sourceSpecs);
    if (!spec) {
      return null;
    }

    const file = this.options.app.metadataCache.getFirstLinkpathDest(spec.linktext, sourcePath);
    if (file instanceof TFile && HTML_FILE_EXTENSIONS.includes(file.extension.toLowerCase())) {
      return { file, spec };
    }

    return null;
  }

  private getCachedEmbedSpecs(sourcePath: string): HtmlEmbedSpec[] {
    const sourceFile = this.options.app.vault.getAbstractFileByPath(sourcePath);
    if (!(sourceFile instanceof TFile)) {
      return [];
    }

    const cache = this.options.app.metadataCache.getFileCache(sourceFile);
    return cache?.embeds
      ?.map((embed) => parseHtmlEmbedText(embed.original))
      .filter((spec): spec is HtmlEmbedSpec => Boolean(spec)) ?? [];
  }
}

interface HtmlFileEmbedRenderChildOptions {
  app: App;
  assetsBaseUrl: string;
  file: TFile;
  embedSpec: HtmlEmbedSpec;
  sourcePath: string;
  getSettings: () => HtmlVEditorSettings;
  getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>;
}

class HtmlFileEmbedRenderChild extends MarkdownRenderChild {
  private renderer = new HtmlPreviewRenderer();
  private previewEl: HTMLElement | null = null;

  constructor(containerEl: HTMLElement, private options: HtmlFileEmbedRenderChildOptions) {
    super(containerEl);
  }

  render(): void {
    window.setTimeout(() => {
      if (!this.containerEl.isConnected) {
        return;
      }

      this.renderShell();
      void this.refresh();
    }, 100);

    this.registerEvent(this.options.app.vault.on("modify", (file) => {
      if (file === this.options.file) {
        void this.refresh();
      }
    }));
  }

  onunload(): void {
    this.renderer.destroy();
  }

  private renderShell(): void {
    this.containerEl.empty();
    this.containerEl.removeClass("internal-embed");
    this.containerEl.removeClass("markdown-embed");
    this.containerEl.removeClass("file-embed");
    this.containerEl.addClass("html-v-file-embed");
    this.containerEl.addClass("html-v-file-embed-processed");
    stopEmbedOpenEvents(this.containerEl);
    for (const attr of ["src", "data-src", "data-href", "href", "alt", "aria-label"]) {
      this.containerEl.removeAttribute(attr);
    }
    applyEmbedDimensions(this.containerEl, this.options.embedSpec);
    this.previewEl = this.containerEl.createDiv({ cls: "html-v-file-embed-preview" });
    if (this.options.embedSpec.height) {
      this.previewEl.style.minHeight = "0";
    }
  }

  private async refresh(): Promise<void> {
    if (!this.previewEl) {
      return;
    }

    try {
      const html = await this.options.app.vault.cachedRead(this.options.file);
      const settings = await this.options.getPreviewSettings(this.options.file.path, html);
      const preview = renderHtmlForPreview(html, settings);
      this.renderer.render(this.previewEl, rewriteHtmlResourceUrls(this.options.app, this.options.file.path, preview.html), {
        sandbox: preview.sandbox,
        documentBaseUrl: getEditorDocumentBaseUrl(this.options.app, this.options.file.path)
      });
    } catch (error) {
      console.error("Failed to render HTML file embed", error);
      this.previewEl.empty();
      this.previewEl.createDiv({
        cls: "html-v-file-embed-error",
        text: "Unable to render embedded HTML file."
      });
    }
  }

}

function getEmbedSpec(embedEl: HTMLElement): HtmlEmbedSpec | null {
  const attrs = [
    "src",
    "data-src",
    "data-href",
    "href",
    "alt",
    "aria-label"
  ];

  for (const attr of attrs) {
    const value = embedEl.getAttribute(attr);
    const spec = parseHtmlEmbedText(value);
    if (spec) {
      return spec;
    }
  }

  return parseHtmlEmbedText(embedEl.textContent);
}

function extractHtmlEmbedSpecs(source: string): HtmlEmbedSpec[] {
  const specs: HtmlEmbedSpec[] = [];
  for (const match of source.matchAll(/!?\[\[[^\]]+?\.(?:html|htm)(?:#[^\]|]+)?(?:\|[^\]]+)?]]/gi)) {
    const spec = parseHtmlEmbedText(match[0]);
    if (spec) {
      specs.push(spec);
    }
  }
  return specs;
}

function mergeSourceSpec(domSpec: HtmlEmbedSpec | null, sourceSpecs: HtmlEmbedSpec[]): HtmlEmbedSpec | null {
  if (!domSpec && sourceSpecs.length > 0) {
    return sourceSpecs.shift() ?? null;
  }

  if (!domSpec) {
    return null;
  }

  const sourceIndex = sourceSpecs.findIndex((sourceSpec) => sameLinktext(sourceSpec.linktext, domSpec.linktext));
  if (sourceIndex < 0) {
    return domSpec;
  }

  const sourceSpec = sourceSpecs.splice(sourceIndex, 1)[0];
  return {
    ...domSpec,
    width: sourceSpec?.width ?? domSpec.width,
    height: sourceSpec?.height ?? domSpec.height
  };
}

function sameLinktext(left: string, right: string): boolean {
  return left.replace(/\\/g, "/").toLowerCase() === right.replace(/\\/g, "/").toLowerCase();
}

function stopEmbedOpenEvents(containerEl: HTMLElement): void {
  for (const eventName of ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "auxclick"]) {
    containerEl.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, true);
  }
}
