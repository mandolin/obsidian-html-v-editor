import { MarkdownView, Notice, TFile, setIcon, type App } from "obsidian";

import { HTML_FILE_EXTENSIONS, HTML_V_EDITOR_VIEW_TYPE } from "../constants";
import {
  createHtmlEditorAdapter,
  getActiveRichEditorId,
  HTML_ACTIVE_RICH_EDITOR_DEFINITIONS,
  isRichHtmlEditorId
} from "../editors/HtmlEditorRegistry";
import { buildHugeRteCharacterMap } from "../editors/HugeRteCharacterMap";
import type { HtmlEditorAdapter, HtmlEditorId } from "../editors/HtmlEditorAdapter";
import { isolateObsidianControl, protectObsidianButton, stopObsidianMouseBubble } from "../editors/editorDom";
import { getEditorDocumentBaseUrl, rewriteHtmlResourceUrls } from "../editors/editorResources";
import { HtmlBlockEditModal } from "../modals/HtmlBlockEditModal";
import { HtmlPreviewRenderer } from "../render/HtmlPreviewRenderer";
import { renderHtmlForPreview } from "../security/HtmlSecurityPolicy";
import type { HtmlVEditorSettings, SourceEditorMode } from "../settings/settings";
import { applyEmbedDimensions, parseHtmlEmbedText, type HtmlEmbedSpec } from "./HtmlEmbedParser";

export interface HtmlEmbedLivePreviewDomEnhancerOptions {
  app: App;
  assetsBaseUrl: string;
  getSettings: () => HtmlVEditorSettings;
  getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>;
}

export class HtmlEmbedLivePreviewDomEnhancer {
  private observer: MutationObserver | null = null;
  private controllers = new Set<HtmlLivePreviewEmbedController>();
  private activeController: HtmlLivePreviewEmbedController | null = null;
  private cursorCheckTimer: number | null = null;

  private readonly handleDocumentMouseDown = (event: MouseEvent): void => {
    if (!this.activeController) {
      return;
    }

    if (
      this.activeController.containsEventTarget(event.target)
      || isHugeRteAuxiliaryTarget(event.target)
      || isHtmlVInlineEditorTarget(event.target)
      || isHtmlVEditorModalTarget(event.target)
    ) {
      return;
    }

    void this.closeActiveController();
  };

  private readonly scheduleCursorCheck = (): void => {
    if (this.cursorCheckTimer !== null) {
      window.clearTimeout(this.cursorCheckTimer);
    }
    this.cursorCheckTimer = window.setTimeout(() => {
      this.cursorCheckTimer = null;
      this.handleEditorCursorChange();
    }, 50);
  };

  constructor(private options: HtmlEmbedLivePreviewDomEnhancerOptions) {}

  start(): void {
    this.stop();
    this.observer = new MutationObserver(() => {
      this.process();
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    document.addEventListener("mousedown", this.handleDocumentMouseDown, true);
    document.addEventListener("selectionchange", this.scheduleCursorCheck);
    document.addEventListener("keyup", this.scheduleCursorCheck, true);
    document.addEventListener("mouseup", this.scheduleCursorCheck, true);
    window.setTimeout(() => this.process(), 250);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener("mousedown", this.handleDocumentMouseDown, true);
    document.removeEventListener("selectionchange", this.scheduleCursorCheck);
    document.removeEventListener("keyup", this.scheduleCursorCheck, true);
    document.removeEventListener("mouseup", this.scheduleCursorCheck, true);
    if (this.cursorCheckTimer !== null) {
      window.clearTimeout(this.cursorCheckTimer);
      this.cursorCheckTimer = null;
    }
    for (const controller of this.controllers) {
      controller.dispose();
    }
    this.controllers.clear();
    this.activeController = null;
  }

  process(): void {
    if (!this.options.getSettings().livePreviewEmbedWidgets) {
      return;
    }

    const embeds = Array.from(document.querySelectorAll<HTMLElement>(".markdown-source-view .internal-embed"));
    for (const embedEl of embeds) {
      if (embedEl.hasClass("html-v-live-dom-processed") || embedEl.closest(".html-v-live-dom-embed")) {
        continue;
      }

      const spec = getEmbedSpec(embedEl);
      if (!spec) {
        continue;
      }

      const view = this.options.app.workspace.getActiveViewOfType(MarkdownView);
      const sourcePath = view?.file?.path ?? "";
      const markdown = findOriginalMarkdownInEditor(view, spec) ?? getOriginalMarkdown(embedEl, spec);
      const finalSpec = parseHtmlEmbedText(markdown) ?? spec;
      const file = this.options.app.metadataCache.getFirstLinkpathDest(finalSpec.linktext, sourcePath);
      if (!(file instanceof TFile)) {
        continue;
      }

      embedEl.addClass("html-v-live-dom-processed");
      embedEl.addClass("html-v-live-dom-source-hidden");

      const widgetEl = document.createElement("div");
      widgetEl.addClass("html-v-live-dom-widget");
      embedEl.insertAdjacentElement("afterend", widgetEl);

      const controller = new HtmlLivePreviewEmbedController(widgetEl, {
        ...this.options,
        file,
        sourcePath,
        spec: finalSpec,
        markdown,
        sourceEl: embedEl,
        onEditStateChange: (controller, isEditing) => {
          if (isEditing) {
            if (this.activeController && this.activeController !== controller) {
              void this.activeController.renderPreview();
            }
            this.activeController = controller;
          } else if (this.activeController === controller) {
            this.activeController = null;
          }
        }
      });
      this.controllers.add(controller);
      void controller.renderPreview();
    }
  }

  private handleEditorCursorChange(): void {
    this.process();

    const active = this.getCurrentCursorEmbed();
    if (!active) {
      if (this.activeController && !this.activeController.containsFocus() && !isHtmlVEditorModalOpen()) {
        void this.closeActiveController();
      }
      return;
    }

    for (const controller of this.controllers) {
      if (!controller.isConnected()) {
        this.controllers.delete(controller);
        continue;
      }

      if (controller.matchesCursor(active.sourcePath, active.file.path, active.markdown)) {
        controller.setMarkdown(active.markdown);
        void controller.openInlineEditor();
        return;
      }
    }

    if (this.activeController && !this.activeController.containsFocus() && !isHtmlVEditorModalOpen()) {
      void this.closeActiveController();
    }
  }

  private getCurrentCursorEmbed(): { sourcePath: string; file: TFile; markdown: string } | null {
    const view = this.options.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = view?.editor;
    const sourcePath = view?.file?.path ?? "";
    if (!editor) {
      return null;
    }

    const line = editor.getLine(editor.getCursor().line).trim();
    const spec = parseHtmlEmbedText(line);
    if (!spec) {
      return null;
    }

    const file = this.options.app.metadataCache.getFirstLinkpathDest(spec.linktext, sourcePath);
    return file instanceof TFile ? { sourcePath, file, markdown: line } : null;
  }

  private async closeActiveController(): Promise<void> {
    const controller = this.activeController;
    this.activeController = null;
    await controller?.renderPreview();
  }
}

interface HtmlLivePreviewEmbedControllerOptions extends HtmlEmbedLivePreviewDomEnhancerOptions {
  file: TFile;
  sourcePath: string;
  spec: HtmlEmbedSpec;
  markdown: string;
  sourceEl: HTMLElement;
  onEditStateChange: (controller: HtmlLivePreviewEmbedController, isEditing: boolean) => void;
}

class HtmlLivePreviewEmbedController {
  private renderer = new HtmlPreviewRenderer();
  private html = "";
  private editor: HtmlEditorAdapter | null = null;
  private editorId: HtmlEditorId;
  private richEditorId: HtmlEditorId;
  private sourceEditorMode: SourceEditorMode;
  private markdown: string;
  private isInlineEditing = false;
  private previewAbort: AbortController | null = null;
  private sourceModeSelectEl: HTMLSelectElement | null = null;
  private feedbackBubbleEl: HTMLElement | null = null;
  private feedbackTimer: number | null = null;

  constructor(private containerEl: HTMLElement, private options: HtmlLivePreviewEmbedControllerOptions) {
    this.editorId = getActiveRichEditorId(options.getSettings().defaultEditor);
    this.richEditorId = this.editorId;
    this.sourceEditorMode = options.getSettings().defaultSourceEditorMode;
    this.markdown = options.markdown;
  }

  async renderPreview(): Promise<void> {
    try {
      this.previewAbort?.abort();
      this.previewAbort = null;
      this.editor?.destroy();
      this.editor = null;
      this.isInlineEditing = false;
      this.options.onEditStateChange(this, false);
      this.containerEl.empty();
      this.prepareContainer();
      applyEmbedDimensions(this.containerEl, this.options.spec);

      const previewEl = this.containerEl.createDiv({ cls: "html-v-live-widget-preview" });
      this.html = await this.options.app.vault.cachedRead(this.options.file);
      const settings = await this.options.getPreviewSettings(this.options.file.path, this.html);
      const preview = renderHtmlForPreview(this.html, settings);
      this.renderer.render(previewEl, rewriteHtmlResourceUrls(this.options.app, this.options.file.path, preview.html), {
        sandbox: preview.sandbox,
        documentBaseUrl: getEditorDocumentBaseUrl(this.options.app, this.options.file.path)
      });
      const abort = new AbortController();
      this.previewAbort = abort;
      const openInline = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.openInlineEditor();
      };
      if (this.options.getSettings().livePreviewEditTrigger === "click") {
        const clickTargetEl = this.containerEl.createDiv({
          cls: "html-v-live-widget-click-target",
          attr: {
            "aria-label": "Edit embedded HTML",
            role: "button",
            tabindex: "0"
          }
        });
        clickTargetEl.addEventListener("click", openInline, { signal: abort.signal });
        clickTargetEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            openInline(event);
          }
        }, { signal: abort.signal });
      } else {
        const editButton = createIconButton(this.containerEl, "pencil", "Edit embedded HTML");
        editButton.addClass("html-v-live-widget-float-edit");
        this.containerEl.addClass("html-v-live-widget-has-float-edit");
        editButton.addEventListener("click", openInline, { signal: abort.signal });
      }
    } catch (error) {
      console.error("Failed to render HTML embed live preview", error);
      this.containerEl.empty();
      this.containerEl.createDiv({
        cls: "html-v-live-widget-error",
        text: "Unable to render HTML preview."
      });
    }
  }

  async openInlineEditor(): Promise<void> {
    if (this.isInlineEditing) {
      return;
    }

    this.previewAbort?.abort();
    this.previewAbort = null;
    this.renderer.destroy();
    this.editor?.destroy();
    this.editor = null;
    this.containerEl.empty();
    this.prepareContainer();
    this.containerEl.addClass("is-editing");
    this.isInlineEditing = true;
    this.options.onEditStateChange(this, true);
    this.html = await this.options.app.vault.cachedRead(this.options.file);

    const toolbarEl = this.containerEl.createDiv({ cls: "html-v-live-widget-toolbar" });
    stopObsidianMouseBubble(toolbarEl);
    const markdownInputEl = toolbarEl.createEl("input", {
      cls: "html-v-live-widget-markdown-input",
      type: "text",
      value: this.markdown
    });
    isolateObsidianControl(markdownInputEl);
    markdownInputEl.addEventListener("input", () => {
      this.markdown = markdownInputEl.value;
    });
    markdownInputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        void this.reloadEmbeddedMarkdown(markdownInputEl.value);
      }
    });
    this.feedbackBubbleEl = toolbarEl.createDiv({
      cls: "html-v-live-widget-embed-feedback is-hidden",
      attr: {
        role: "status"
      }
    });

    const refreshButton = createIconButton(toolbarEl, "refresh-cw", "Refresh preview");
    refreshButton.addEventListener("click", () => {
      void this.renderPreview();
    });

    const inlineButton = createIconButton(toolbarEl, "panel-bottom-open", "Inline edit");
    inlineButton.addClass("is-active");
    inlineButton.addEventListener("click", () => {
      void this.mountEditor(editorHostEl);
    });

    const modalButton = createIconButton(toolbarEl, "square-stack", "Modal edit");
    modalButton.addEventListener("click", () => {
      void this.openModalEditor();
    });

    const tabButton = createIconButton(toolbarEl, "external-link", "New tab edit");
    tabButton.addEventListener("click", () => {
      void this.openNewTabEditor();
    });

    const editorSelectEl = toolbarEl.createEl("select", {
      cls: "html-v-live-widget-editor-select"
    });
    editorSelectEl.addClass("is-hidden");
    for (const editor of HTML_ACTIVE_RICH_EDITOR_DEFINITIONS) {
      editorSelectEl.createEl("option", {
        text: editor.displayName,
        value: editor.id
      });
    }
    isolateObsidianControl(editorSelectEl);
    editorSelectEl.value = this.editorId;
    editorSelectEl.addEventListener("change", () => {
      if (isRichHtmlEditorId(editorSelectEl.value)) {
        this.editorId = getActiveRichEditorId(editorSelectEl.value);
        this.richEditorId = this.editorId;
        void this.mountEditor(editorHostEl);
      }
    });

    const editButton = toolbarEl.createEl("button", {
      cls: "html-v-live-widget-text-button",
      text: "Edit"
    });
    protectObsidianButton(editButton);
    editButton.addEventListener("click", () => {
      this.editorId = this.richEditorId;
      void this.mountEditor(editorHostEl);
    });

    const sourceButton = toolbarEl.createEl("button", {
      cls: "html-v-live-widget-text-button",
      text: "Source"
    });
    protectObsidianButton(sourceButton);
    sourceButton.addEventListener("click", () => {
      this.editorId = "source";
      void this.mountEditor(editorHostEl);
    });

    const sourceModeSelectEl = toolbarEl.createEl("select", {
      cls: "html-v-live-widget-source-select"
    });
    this.sourceModeSelectEl = sourceModeSelectEl;
    sourceModeSelectEl.createEl("option", { text: "CodeMirror", value: "codemirror" });
    sourceModeSelectEl.createEl("option", { text: "Textarea", value: "textarea" });
    isolateObsidianControl(sourceModeSelectEl);
    sourceModeSelectEl.value = this.sourceEditorMode;
    sourceModeSelectEl.toggleClass("is-hidden", this.editorId !== "source");
    sourceModeSelectEl.addEventListener("change", () => {
      if (sourceModeSelectEl.value === "codemirror" || sourceModeSelectEl.value === "textarea") {
        this.sourceEditorMode = sourceModeSelectEl.value;
        this.editorId = "source";
        void this.mountEditor(editorHostEl);
      }
    });

    const editorHostEl = this.containerEl.createDiv({ cls: "html-v-live-widget-editor-host" });
    const footerEl = this.containerEl.createDiv({ cls: "html-v-live-widget-footer" });
    stopObsidianMouseBubble(footerEl);
    const cancelButton = footerEl.createEl("button", {
      cls: "html-v-live-widget-text-button",
      text: "Cancel"
    });
    protectObsidianButton(cancelButton);
    cancelButton.addEventListener("click", () => {
      void this.renderPreview();
    });
    const saveButton = footerEl.createEl("button", {
      cls: "html-v-live-widget-text-button mod-cta",
      text: "Save"
    });
    protectObsidianButton(saveButton);
    saveButton.addEventListener("click", () => {
      void this.save();
    });

    await this.mountEditor(editorHostEl);
  }

  private async mountEditor(hostEl: HTMLElement): Promise<void> {
    this.html = this.editor?.getHtml() ?? this.html;
    this.editor?.destroy();
    hostEl.empty();
    this.sourceModeSelectEl?.toggleClass("is-hidden", this.editorId !== "source");
    const editor = createHtmlEditorAdapter(this.editorId);
    this.editor = editor;
    await editor.mount(hostEl, this.html, {
      assetsBaseUrl: this.options.assetsBaseUrl,
      documentBaseUrl: getEditorDocumentBaseUrl(this.options.app, this.options.file.path),
      characterMap: buildHugeRteCharacterMap(this.options.getSettings()),
      enableChecklist: this.options.getSettings().enableChecklist,
      sourceEditorMode: this.sourceEditorMode,
      onChange: (html) => {
        this.html = html;
      }
    });
    editor.focus();
  }

  private async save(): Promise<void> {
    this.html = this.editor?.getHtml() ?? this.html;
    await this.options.app.vault.modify(this.options.file, normalizeHtml(this.html));
    this.tryUpdateMarkdownLine();
    new Notice("HTML saved.");
    await this.renderPreview();
  }

  private async openModalEditor(): Promise<void> {
    this.html = this.editor?.getHtml() ?? this.html;
    new HtmlBlockEditModal(this.options.app, {
      title: `Edit ${this.options.file.path}`,
      initialHtml: this.html,
      defaultEditorId: this.editorId,
      assetsBaseUrl: this.options.assetsBaseUrl,
      documentBaseUrl: getEditorDocumentBaseUrl(this.options.app, this.options.file.path),
      characterMap: buildHugeRteCharacterMap(this.options.getSettings()),
      enableChecklist: this.options.getSettings().enableChecklist,
      sourceEditorMode: this.sourceEditorMode,
      onSave: async (nextHtml) => {
        this.html = nextHtml;
        await this.save();
      }
    }).open();
  }

  private async openNewTabEditor(): Promise<void> {
    const leaf = this.options.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: HTML_V_EDITOR_VIEW_TYPE,
      state: { file: this.options.file.path },
      active: true
    });
    await this.options.app.workspace.revealLeaf(leaf);
  }

  private async reloadEmbeddedMarkdown(markdown: string): Promise<void> {
    const nextMarkdown = markdown.trim();
    const spec = parseHtmlEmbedText(nextMarkdown);
    if (!spec) {
      this.showEmbedFeedback("Enter a valid HTML embed, for example ![[file.htm|600x400]].", "error");
      return;
    }

    const file = this.options.app.metadataCache.getFirstLinkpathDest(spec.linktext, this.options.sourcePath);
    if (!(file instanceof TFile) || !HTML_FILE_EXTENSIONS.includes(file.extension.toLowerCase())) {
      this.showEmbedFeedback(`HTML file not found: ${spec.linktext}`, "error");
      return;
    }

    try {
      const nextHtml = await this.options.app.vault.cachedRead(file);
      this.markdown = nextMarkdown;
      this.options.file = file;
      this.options.spec = spec;
      applyEmbedDimensions(this.containerEl, spec);
      this.html = nextHtml;
      this.editor?.setHtml(this.html);
      this.tryUpdateMarkdownLine();
      this.options.markdown = nextMarkdown;
      this.showEmbedFeedback(`Loaded ${file.path}.`, "success");
    } catch (error) {
      console.error("Failed to reload embedded HTML", error);
      this.showEmbedFeedback(error instanceof Error ? error.message : "Unable to reload embedded HTML.", "error");
    }
  }

  private showEmbedFeedback(message: string, variant: "error" | "success"): void {
    if (!this.feedbackBubbleEl) {
      if (variant === "error") {
        new Notice(message);
      }
      return;
    }

    if (this.feedbackTimer !== null) {
      window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }

    this.feedbackBubbleEl.setText(message);
    this.feedbackBubbleEl.removeClass("is-hidden");
    this.feedbackBubbleEl.toggleClass("is-error", variant === "error");
    this.feedbackBubbleEl.toggleClass("is-success", variant === "success");
    this.feedbackTimer = window.setTimeout(() => {
      this.feedbackBubbleEl?.addClass("is-hidden");
      this.feedbackTimer = null;
    }, variant === "error" ? 5200 : 2200);
  }

  private tryUpdateMarkdownLine(): void {
    if (this.markdown === this.options.markdown) {
      return;
    }

    const view = this.options.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = view?.editor;
    if (!editor) {
      return;
    }

    for (let line = 0; line < editor.lineCount(); line += 1) {
      if (editor.getLine(line).trim() === this.options.markdown) {
        editor.replaceRange(this.markdown, { line, ch: 0 }, { line, ch: editor.getLine(line).length }, "html-v-editor");
        return;
      }
    }
  }

  isConnected(): boolean {
    return this.containerEl.isConnected;
  }

  containsEventTarget(target: EventTarget | null): boolean {
    return target instanceof Node && this.containerEl.contains(target);
  }

  containsFocus(): boolean {
    const active = document.activeElement;
    return active instanceof Node && this.containerEl.contains(active);
  }

  setMarkdown(markdown: string): void {
    this.markdown = markdown;
  }

  matchesCursor(sourcePath: string, filePath: string, markdown: string): boolean {
    return this.options.sourcePath === sourcePath
      && this.options.file.path === filePath
      && getMarkdownLinktext(this.markdown) === getMarkdownLinktext(markdown);
  }

  dispose(): void {
    this.previewAbort?.abort();
    this.previewAbort = null;
    this.editor?.destroy();
    this.editor = null;
    this.renderer.destroy();
    this.containerEl.remove();
    this.options.sourceEl.removeClass("html-v-live-dom-processed");
    this.options.sourceEl.removeClass("html-v-live-dom-source-hidden");
  }

  private prepareContainer(): void {
    this.containerEl.removeClass("internal-embed");
    this.containerEl.removeClass("markdown-embed");
    this.containerEl.removeClass("file-embed");
    this.containerEl.removeClass("is-loaded");
    this.containerEl.addClass("html-v-live-widget");
    this.containerEl.addClass("html-v-live-dom-embed");
    this.containerEl.setAttribute("tabindex", "0");
    this.containerEl.setAttribute("data-html-v-editor-embed", "true");
    for (const attr of ["src", "data-src", "data-href", "href", "alt", "aria-label"]) {
      this.containerEl.removeAttribute(attr);
    }
    stopObsidianMouseBubble(this.containerEl);
  }
}

function getEmbedSpec(embedEl: HTMLElement): HtmlEmbedSpec | null {
  const attrs = ["src", "data-src", "data-href", "href", "alt", "aria-label"];
  for (const attr of attrs) {
    const spec = parseHtmlEmbedText(embedEl.getAttribute(attr));
    if (spec) {
      return spec;
    }
  }

  return parseHtmlEmbedText(embedEl.textContent);
}

function getOriginalMarkdown(embedEl: HTMLElement, spec: HtmlEmbedSpec): string {
  const text = embedEl.textContent?.trim();
  if (text?.startsWith("![[")) {
    return text;
  }
  return `![[${spec.linktext}${spec.width || spec.height ? `|${spec.width ?? ""}${spec.height ? `x${spec.height}` : ""}` : ""}]]`;
}

function findOriginalMarkdownInEditor(view: MarkdownView | null, spec: HtmlEmbedSpec): string | null {
  const editor = view?.editor;
  if (!editor) {
    return null;
  }

  for (let lineIndex = 0; lineIndex < editor.lineCount(); lineIndex += 1) {
    const line = editor.getLine(lineIndex).trim();
    const lineSpec = parseHtmlEmbedText(line);
    if (lineSpec?.linktext === spec.linktext) {
      return line;
    }
  }

  return null;
}

function normalizeMarkdownEmbed(markdown: string): string {
  return markdown.replace(/\s+/g, "");
}

function getMarkdownLinktext(markdown: string): string {
  return parseHtmlEmbedText(markdown)?.linktext ?? normalizeMarkdownEmbed(markdown);
}

function isHugeRteAuxiliaryTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest(".tox-hugerte-aux, .tox-tinymce-aux, .tox-silver-sink, .tox-dialog-wrap, .tox-pop, .tox-menu, .tox-tooltip"));
}

function isHtmlVInlineEditorTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest(".html-v-live-widget.is-editing"));
}

function isHtmlVEditorModalTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest(".html-v-block-edit-modal-container"));
}

function isHtmlVEditorModalOpen(): boolean {
  return Boolean(document.querySelector(".html-v-block-edit-modal-container"));
}

function createIconButton(parent: HTMLElement, icon: string, label: string): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: "html-v-live-widget-icon-button",
    attr: {
      "aria-label": label,
      title: label,
      type: "button"
    }
  });
  setIcon(button, icon);
  protectObsidianButton(button);
  return button;
}

function normalizeHtml(html: string): string {
  return html.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/g, "");
}
