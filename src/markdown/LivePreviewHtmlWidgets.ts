import { Prec, RangeSetBuilder, StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { Notice, TFile, editorInfoField, editorLivePreviewField, setIcon, type App, type MarkdownFileInfo } from "obsidian";

import { HTML_FILE_EXTENSIONS, HTML_V_EDITOR_VIEW_TYPE } from "../constants";
import {
  createHtmlEditorAdapter,
  getActiveRichEditorId,
  HTML_ACTIVE_RICH_EDITOR_DEFINITIONS,
  isRichHtmlEditorId
} from "../editors/HtmlEditorRegistry";
import type { HtmlEditorAdapter } from "../editors/HtmlEditorAdapter";
import type { HtmlEditorId } from "../editors/HtmlEditorAdapter";
import { isolateObsidianControl, protectObsidianButton, stopObsidianMouseBubble } from "../editors/editorDom";
import { HtmlBlockEditModal } from "../modals/HtmlBlockEditModal";
import { HtmlPreviewRenderer } from "../render/HtmlPreviewRenderer";
import { renderHtmlForPreview } from "../security/HtmlSecurityPolicy";
import type { HtmlVEditorSettings } from "../settings/settings";
import { applyEmbedDimensions, parseEmbedDimensions, parseHtmlEmbedText, type HtmlEmbedSpec } from "./HtmlEmbedParser";

export interface LivePreviewHtmlWidgetsOptions {
  app: App;
  assetsBaseUrl: string;
  getSettings: () => HtmlVEditorSettings;
  getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>;
}

export function createLivePreviewHtmlWidgets(options: LivePreviewHtmlWidgetsOptions) {
  return Prec.highest(StateField.define<DecorationSet>({
    create: (state) => buildDecorations(state, options),
    update: (decorations, transaction) => {
      if (transaction.docChanged || transaction.selection) {
        return buildDecorations(transaction.state, options);
      }

      return decorations.map(transaction.changes);
    },
    provide: (field) => EditorView.decorations.from(field)
  }));
}

function buildDecorations(state: EditorState, options: LivePreviewHtmlWidgetsOptions): DecorationSet {
  if (!state.field(editorLivePreviewField, false)) {
    return Decoration.none;
  }

  const settings = options.getSettings();
  if (!settings.livePreviewHtmlWidgets && !settings.livePreviewEmbedWidgets) {
    return Decoration.none;
  }

  const info = state.field(editorInfoField, false) as MarkdownFileInfo | undefined;
  const sourcePath = info?.file?.path ?? "";
  const text = state.doc.toString();
  const ranges = scanLivePreviewRanges(text, {
    includeHtmlBlocks: settings.livePreviewHtmlWidgets,
    includeEmbeds: settings.livePreviewEmbedWidgets
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const range of ranges) {
    builder.add(
      range.from,
      range.to,
      Decoration.replace({
        block: true,
        widget: new HtmlPreviewWidget({
          ...options,
          sourcePath,
          range,
          editorId: getActiveRichEditorId(settings.defaultEditor),
          selected: selectionIntersectsRange(state, range)
        })
      })
    );
  }

  return builder.finish();
}

interface LivePreviewRange {
  type: "html-v" | "embed";
  from: number;
  to: number;
  html?: string;
  linktext?: string;
  embedSpec?: HtmlEmbedSpec;
  markdown?: string;
  openingFence?: string;
  closingFence?: string;
  width?: number;
  height?: number;
}

interface ScanOptions {
  includeHtmlBlocks: boolean;
  includeEmbeds: boolean;
}

const HTML_V_FENCE_START_PATTERN = /^(\s{0,3})(`{3,}|~{3,})\s*html-v(?:\s+(.+?))?\s*$/i;

function scanLivePreviewRanges(text: string, options: ScanOptions): LivePreviewRange[] {
  const ranges: LivePreviewRange[] = [];
  const lines = text.split("\n");
  let offset = 0;
  let inFence = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const trimmed = line.trim();

    if (!inFence && options.includeHtmlBlocks) {
      const fenceMatch = line.match(HTML_V_FENCE_START_PATTERN);
      if (fenceMatch) {
        const marker = fenceMatch[2];
        const dimensions = parseEmbedDimensions(fenceMatch[3]);
        const close = findFenceCloseLine(lines, lineIndex + 1, marker);
        if (close > lineIndex) {
          const from = offset;
          const to = offsetForLine(lines, close) + (lines[close]?.length ?? 0);
          ranges.push({
            type: "html-v",
            from,
            to,
            html: lines.slice(lineIndex + 1, close).join("\n"),
            openingFence: line,
            closingFence: lines[close] ?? marker,
            ...dimensions
          });
          lineIndex = close;
          offset = to + 1;
          continue;
        }
      }
    }

    if (/^```/.test(trimmed) || /^~~~/.test(trimmed)) {
      inFence = !inFence;
    }

    if (!inFence && options.includeEmbeds) {
      const embedMatch = line.match(/^(\s*)!\[\[([^|\]#]+?\.(?:html|htm))(?:#[^|\]]*)?(?:\|([^\]]+))?]]\s*$/i);
      if (embedMatch) {
        const linktext = embedMatch[2].trim();
        const dimensions = parseEmbedDimensions(embedMatch[3]);
        ranges.push({
          type: "embed",
          from: offset,
          to: offset + line.length,
          linktext,
          markdown: line.trim(),
          embedSpec: {
            linktext,
            ...dimensions
          },
          ...dimensions
        });
      }
    }

    offset += line.length + 1;
  }

  return ranges.sort((a, b) => a.from - b.from);
}

function findFenceCloseLine(lines: string[], startLine: number, marker: string): number {
  const markerChar = marker[0] ?? "`";
  const minLength = marker.length;
  const closePattern = new RegExp(`^\\s{0,3}${escapeRegExp(markerChar)}{${minLength},}\\s*$`);
  for (let lineIndex = startLine; lineIndex < lines.length; lineIndex += 1) {
    if (closePattern.test(lines[lineIndex] ?? "")) {
      return lineIndex;
    }
  }

  return -1;
}

function offsetForLine(lines: string[], targetLine: number): number {
  let offset = 0;
  for (let line = 0; line < targetLine; line += 1) {
    offset += (lines[line]?.length ?? 0) + 1;
  }
  return offset;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function selectionIntersectsRange(state: EditorState, range: LivePreviewRange): boolean {
  return state.selection.ranges.some((selection) => {
    const from = Math.min(selection.from, selection.to);
    const to = Math.max(selection.from, selection.to);
    return (from >= range.from && from <= range.to)
      || (to >= range.from && to <= range.to)
      || (from <= range.from && to >= range.to);
  });
}

interface HtmlPreviewWidgetOptions extends LivePreviewHtmlWidgetsOptions {
  sourcePath: string;
  range: LivePreviewRange;
  editorId: HtmlEditorId;
  selected: boolean;
}

class HtmlPreviewWidget extends WidgetType {
  constructor(private options: HtmlPreviewWidgetOptions) {
    super();
  }

  eq(other: WidgetType): boolean {
    if (!(other instanceof HtmlPreviewWidget)) {
      return false;
    }

    return this.options.selected === other.options.selected
      && this.getStableKey() === other.getStableKey();
  }

  toDOM(view: EditorView): HTMLElement {
    const containerEl = document.createElement("div") as HtmlPreviewWidgetElement;
    this.renderPreviewDom(containerEl, view, this.options.selected);

    return containerEl;
  }

  destroy(dom: HTMLElement): void {
    (dom as HtmlPreviewWidgetElement).htmlVInlineEditor?.dispose();
  }

  ignoreEvent(): boolean {
    return true;
  }

  private renderPreviewDom(containerEl: HtmlPreviewWidgetElement, view: EditorView, autoOpen: boolean): void {
    containerEl.htmlVInlineEditor?.dispose();
    containerEl.htmlVInlineEditor = undefined;
    containerEl.empty();
    containerEl.removeClass("is-editing");
    containerEl.addClass("html-v-live-widget");
    applyEmbedDimensions(containerEl, this.options.range);

    let opening = false;
    const openInline = async () => {
      if (containerEl.hasClass("is-editing") || opening) {
        return;
      }

      opening = true;
      try {
        await this.openInlineEditor(containerEl, view);
      } finally {
        opening = false;
      }
    };
    const previewEl = containerEl.createDiv({ cls: "html-v-live-widget-preview" });
    const onEdit = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      void openInline();
    };
    void this.renderPreview(previewEl, onEdit);
    this.addEditTrigger(containerEl, previewEl, onEdit);
    if (autoOpen) {
      window.setTimeout(() => {
        if (containerEl.isConnected) {
          void openInline();
        }
      });
    }
  }

  private addEditTrigger(containerEl: HTMLElement, previewEl: HTMLElement, onEdit: (event: Event) => void): void {
    if (this.options.getSettings().livePreviewEditTrigger === "click") {
      const clickTargetEl = containerEl.createDiv({
        cls: "html-v-live-widget-click-target",
        attr: {
          "aria-label": "Edit HTML",
          role: "button",
          tabindex: "0"
        }
      });
      clickTargetEl.addEventListener("click", onEdit);
      clickTargetEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          onEdit(event);
        }
      });
      return;
    }

    const editButton = createIconButton(containerEl, "pencil", this.options.range.type === "embed" ? "Edit embedded HTML" : "Edit HTML block");
    editButton.addClass("html-v-live-widget-float-edit");
    containerEl.addClass("html-v-live-widget-has-float-edit");
    editButton.addEventListener("click", onEdit);
  }

  private async renderPreview(previewEl: HTMLElement, _onEdit: (event: Event) => void): Promise<void> {
    try {
      const html = await this.readHtml();
      const previewSettings = await this.options.getPreviewSettings(this.getPreviewSourcePath(), html);
      const preview = renderHtmlForPreview(html, previewSettings);
      const renderer = new HtmlPreviewRenderer();
      renderer.render(previewEl, preview.html, {
        sandbox: preview.sandbox
      });
    } catch (error) {
      console.error("Failed to render live preview HTML widget", error);
      previewEl.empty();
      previewEl.createDiv({
        cls: "html-v-live-widget-error",
        text: "Unable to render HTML preview."
      });
    }
  }

  private async openEditor(view: EditorView): Promise<void> {
    try {
      const html = await this.readHtml();
      new HtmlBlockEditModal(this.options.app, {
        title: this.options.range.type === "embed" ? `Edit ${this.options.range.linktext ?? "HTML file"}` : "Edit HTML block",
        initialHtml: html,
        defaultEditorId: this.options.editorId,
        assetsBaseUrl: this.options.assetsBaseUrl,
        sourceEditorMode: this.options.getSettings().defaultSourceEditorMode,
        onSave: async (nextHtml) => {
          if (this.options.range.type === "embed") {
            const file = this.resolveEmbeddedFile();
            if (!(file instanceof TFile)) {
              throw new Error("The embedded HTML file could not be resolved.");
            }
            await this.options.app.vault.modify(file, normalizeHtml(nextHtml));
          } else {
            view.dispatch({
              changes: {
                from: this.options.range.from,
                to: this.options.range.to,
                insert: buildHtmlVCodeBlock(this.options.range, nextHtml)
              }
            });
          }

          new Notice("HTML saved.");
        }
      }).open();
    } catch (error) {
      console.error("Failed to open live preview HTML editor", error);
      new Notice(error instanceof Error ? error.message : "Unable to edit HTML.");
    }
  }

  private async openInlineEditor(containerEl: HtmlPreviewWidgetElement, view: EditorView): Promise<void> {
    try {
      const html = await this.readHtml();
      const inline = new InlineHtmlEditor(containerEl, view, {
        ...this.options,
        initialHtml: html,
        onClose: () => {
          this.renderPreviewDom(containerEl, view, false);
        }
      });
      containerEl.htmlVInlineEditor = inline;
      await inline.mount();
    } catch (error) {
      console.error("Failed to open inline HTML editor", error);
      new Notice(error instanceof Error ? error.message : "Unable to edit HTML inline.");
    }
  }

  private async readHtml(): Promise<string> {
    if (this.options.range.type === "html-v") {
      return this.options.range.html ?? "";
    }

    const file = this.resolveEmbeddedFile();
    if (!(file instanceof TFile)) {
      throw new Error("The embedded HTML file could not be resolved.");
    }

    return this.options.app.vault.cachedRead(file);
  }

  private resolveEmbeddedFile(): TFile | null {
    if (!this.options.range.linktext) {
      return null;
    }

    const file = this.options.app.metadataCache.getFirstLinkpathDest(this.options.range.linktext, this.options.sourcePath);
    return file instanceof TFile ? file : null;
  }

  private getPreviewSourcePath(): string {
    if (this.options.range.type === "html-v") {
      return this.options.sourcePath;
    }

    return this.resolveEmbeddedFile()?.path ?? this.options.sourcePath;
  }

  private getStableKey(): string {
    const range = this.options.range;
    if (range.type === "html-v") {
      return [
        range.type,
        range.from,
        range.to,
        range.openingFence ?? "",
        range.closingFence ?? "",
        range.html ?? ""
      ].join("\u0000");
    }

    return [
      range.type,
      range.from,
      range.to,
      range.linktext ?? "",
      range.markdown ?? "",
      range.width ?? "",
      range.height ?? ""
    ].join("\u0000");
  }
}

interface HtmlPreviewWidgetElement extends HTMLElement {
  htmlVInlineEditor?: InlineHtmlEditor;
}

interface InlineHtmlEditorOptions extends HtmlPreviewWidgetOptions {
  initialHtml: string;
  onClose: () => void;
}

class InlineHtmlEditor {
  private html: string;
  private editorId: HtmlEditorId;
  private richEditorId: HtmlEditorId;
  private sourceEditorMode: "codemirror" | "textarea";
  private markdown: string;
  private editor: HtmlEditorAdapter | null = null;
  private editorHostEl: HTMLElement | null = null;
  private sourceModeSelectEl: HTMLSelectElement | null = null;
  private feedbackBubbleEl: HTMLElement | null = null;
  private feedbackTimer: number | null = null;
  private outsideAbort: AbortController | null = null;
  private closed = false;

  constructor(
    private containerEl: HTMLElement,
    private view: EditorView,
    private options: InlineHtmlEditorOptions
  ) {
    this.html = options.initialHtml;
    this.editorId = getActiveRichEditorId(options.editorId);
    this.richEditorId = this.editorId;
    this.sourceEditorMode = options.getSettings().defaultSourceEditorMode;
    this.markdown = options.range.markdown ?? "";
  }

  async mount(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass("is-editing");
    this.installOutsideClickCloser();

    const toolbarEl = this.containerEl.createDiv({ cls: "html-v-live-widget-toolbar" });
    stopObsidianMouseBubble(toolbarEl);
    if (this.options.range.type === "embed") {
      const sourceInputEl = toolbarEl.createEl("input", {
        cls: "html-v-live-widget-markdown-input",
        type: "text",
        value: this.markdown || `![[${this.options.range.linktext ?? ""}]]`
      });
      isolateObsidianControl(sourceInputEl);
      sourceInputEl.addEventListener("input", () => {
        this.markdown = sourceInputEl.value;
      });
      sourceInputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          void this.reloadEmbeddedMarkdown(sourceInputEl.value);
        }
      });
      this.feedbackBubbleEl = toolbarEl.createDiv({
        cls: "html-v-live-widget-embed-feedback is-hidden",
        attr: {
          role: "status"
        }
      });
    }

    const refreshButton = createIconButton(toolbarEl, "refresh-cw", "Refresh preview");
    refreshButton.addEventListener("click", () => {
      void this.close();
    });

    const inlineButton = createIconButton(toolbarEl, "panel-bottom-open", "Inline edit");
    inlineButton.addClass("is-active");
    inlineButton.addEventListener("click", () => {
      void this.switchEditor(this.editorId);
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
        void this.switchEditor(editorSelectEl.value);
      }
    });

    const editButton = toolbarEl.createEl("button", {
      cls: "html-v-live-widget-text-button",
      text: "Edit"
    });
    protectObsidianButton(editButton);
    editButton.addEventListener("click", () => {
      void this.switchEditor(this.richEditorId);
    });

    const sourceButton = toolbarEl.createEl("button", {
      cls: "html-v-live-widget-text-button",
      text: "Source"
    });
    protectObsidianButton(sourceButton);
    sourceButton.addEventListener("click", () => {
      void this.switchEditor("source");
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
        void this.switchEditor("source");
      }
    });

    this.editorHostEl = this.containerEl.createDiv({ cls: "html-v-live-widget-editor-host" });

    const footerEl = this.containerEl.createDiv({ cls: "html-v-live-widget-footer" });
    stopObsidianMouseBubble(footerEl);
    const cancelButton = footerEl.createEl("button", {
      cls: "html-v-live-widget-text-button",
      text: "Cancel"
    });
    protectObsidianButton(cancelButton);
    cancelButton.addEventListener("click", () => {
      void this.close();
    });

    const saveButton = footerEl.createEl("button", {
      cls: "html-v-live-widget-text-button mod-cta",
      text: "Save"
    });
    protectObsidianButton(saveButton);
    saveButton.addEventListener("click", () => {
      void this.save();
    });

    await this.mountEditor(sourceModeSelectEl);
  }

  dispose(): void {
    this.cleanup();
    this.closed = true;
  }

  private installOutsideClickCloser(): void {
    this.outsideAbort?.abort();
    const abort = new AbortController();
    this.outsideAbort = abort;
    document.addEventListener("mousedown", (event) => {
      if (this.shouldKeepOpenForTarget(event.target)) {
        return;
      }

      void this.close();
    }, {
      capture: true,
      signal: abort.signal
    });
  }

  private shouldKeepOpenForTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) {
      return false;
    }

    if (this.containerEl.contains(target)) {
      return true;
    }

    if (target instanceof Element) {
      return Boolean(target.closest([
        ".html-v-live-widget.is-editing",
        ".html-v-block-edit-modal-container",
        ".tox-hugerte-aux",
        ".tox-tinymce-aux",
        ".tox-silver-sink",
        ".tox-dialog-wrap",
        ".tox-pop",
        ".tox-menu",
        ".tox-tooltip"
      ].join(",")));
    }

    return false;
  }

  private async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.cleanup();
    this.closed = true;
    this.options.onClose();
  }

  private cleanup(): void {
    this.outsideAbort?.abort();
    this.outsideAbort = null;
    if (this.feedbackTimer !== null) {
      window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    this.editor?.destroy();
    this.editor = null;
    (this.containerEl as HtmlPreviewWidgetElement).htmlVInlineEditor = undefined;
  }

  private async switchEditor(nextId: HtmlEditorId): Promise<void> {
    this.html = this.editor?.getHtml() ?? this.html;
    this.editor?.destroy();
    this.editor = null;
    this.editorId = nextId === "source" ? "source" : getActiveRichEditorId(nextId);
    if (this.editorId !== "source") {
      this.richEditorId = this.editorId;
    }
    await this.mountEditor();
  }

  private async mountEditor(sourceModeSelectEl?: HTMLSelectElement): Promise<void> {
    if (!this.editorHostEl) {
      return;
    }

    (sourceModeSelectEl ?? this.sourceModeSelectEl)?.toggleClass("is-hidden", this.editorId !== "source");
    this.editorHostEl.empty();
    const editor = createHtmlEditorAdapter(this.editorId);
    this.editor = editor;
    await editor.mount(this.editorHostEl, this.html, {
      assetsBaseUrl: this.options.assetsBaseUrl,
      sourceEditorMode: this.sourceEditorMode,
      onChange: (html) => {
        this.html = html;
      }
    });
    editor.focus();
  }

  private async save(): Promise<void> {
    this.html = this.editor?.getHtml() ?? this.html;
    if (this.options.range.type === "embed") {
      const file = this.resolveEmbeddedFile();
      if (!(file instanceof TFile)) {
        throw new Error("The embedded HTML file could not be resolved.");
      }
      await this.options.app.vault.modify(file, normalizeHtml(this.html));
      if (this.markdown && this.markdown !== this.options.range.markdown) {
        this.cleanup();
        this.closed = true;
        this.view.dispatch({
          changes: {
            from: this.options.range.from,
            to: this.options.range.to,
            insert: this.markdown
          }
        });
      } else {
        await this.close();
      }
    } else {
      this.cleanup();
      this.closed = true;
      this.view.dispatch({
        changes: {
          from: this.options.range.from,
          to: this.options.range.to,
          insert: buildHtmlVCodeBlock(this.options.range, this.html)
        }
      });
    }
    new Notice("HTML saved.");
  }

  private async openModalEditor(): Promise<void> {
    this.html = this.editor?.getHtml() ?? this.html;
    new HtmlBlockEditModal(this.options.app, {
      title: this.options.range.type === "embed" ? `Edit ${this.options.range.linktext ?? "HTML file"}` : "Edit HTML block",
      initialHtml: this.html,
      defaultEditorId: this.editorId,
      assetsBaseUrl: this.options.assetsBaseUrl,
      sourceEditorMode: this.sourceEditorMode,
      onSave: async (nextHtml) => {
        this.html = nextHtml;
        await this.save();
      }
    }).open();
  }

  private async openNewTabEditor(): Promise<void> {
    const file = this.resolveEmbeddedFile();
    if (!(file instanceof TFile)) {
      new Notice("New tab editing is available for embedded HTML files.");
      return;
    }

    const leaf = this.options.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: HTML_V_EDITOR_VIEW_TYPE,
      state: { file: file.path },
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

    const file = this.resolveEmbeddedFileFromSpec(spec);
    if (!(file instanceof TFile) || !HTML_FILE_EXTENSIONS.includes(file.extension.toLowerCase())) {
      this.showEmbedFeedback(`HTML file not found: ${spec.linktext}`, "error");
      return;
    }

    try {
      const nextHtml = await this.options.app.vault.cachedRead(file);
      this.markdown = nextMarkdown;
      this.options.range.linktext = spec.linktext;
      this.options.range.embedSpec = spec;
      this.options.range.width = spec.width;
      this.options.range.height = spec.height;
      applyEmbedDimensions(this.containerEl, spec);
      this.html = nextHtml;
      this.editor?.setHtml(this.html);
      this.showEmbedFeedback(`Loaded ${file.path}.`, "success");
      this.updateMarkdownInDocument(nextMarkdown);
    } catch (error) {
      console.error("Failed to reload embedded HTML", error);
      this.showEmbedFeedback(error instanceof Error ? error.message : "Unable to reload embedded HTML.", "error");
    }
  }

  private updateMarkdownInDocument(nextMarkdown: string): void {
    if (this.options.range.type !== "embed" || !nextMarkdown || nextMarkdown === this.options.range.markdown) {
      return;
    }

    const from = this.options.range.from;
    const to = this.options.range.to;
    this.options.range.markdown = nextMarkdown;
    this.options.range.to = from + nextMarkdown.length;
    this.view.dispatch({
      changes: {
        from,
        to,
        insert: nextMarkdown
      }
    });
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

  private resolveEmbeddedFile(): TFile | null {
    const spec = parseHtmlEmbedText(this.markdown) ?? this.options.range.embedSpec;
    if (!spec?.linktext) {
      return null;
    }

    return this.resolveEmbeddedFileFromSpec(spec);
  }

  private resolveEmbeddedFileFromSpec(spec: Pick<HtmlEmbedSpec, "linktext">): TFile | null {
    const file = this.options.app.metadataCache.getFirstLinkpathDest(spec.linktext, this.options.sourcePath);
    return file instanceof TFile ? file : null;
  }
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

function buildHtmlVCodeBlock(range: LivePreviewRange, html: string): string {
  const openingFence = range.openingFence ?? "```html-v";
  const closingFence = range.closingFence ?? getClosingFenceForOpening(openingFence);
  return [
    openingFence,
    normalizeHtml(html),
    closingFence
  ].join("\n");
}

function getClosingFenceForOpening(openingFence: string): string {
  const marker = openingFence.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1] ?? "```";
  return marker;
}
