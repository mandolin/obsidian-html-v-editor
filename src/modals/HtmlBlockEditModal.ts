import { Notice, type App } from "obsidian";

import {
  createHtmlEditorAdapter,
  getActiveRichEditorId,
  HTML_ACTIVE_RICH_EDITOR_DEFINITIONS,
  isRichHtmlEditorId
} from "../editors/HtmlEditorRegistry";
import { cleanupHugeRteAuxiliaryUi } from "../editors/HugeRteAdapter";
import type { HtmlEditorAdapter, HtmlEditorId } from "../editors/HtmlEditorAdapter";
import { isolateObsidianControl, protectObsidianButton, stopObsidianMouseBubble } from "../editors/editorDom";
import type { SourceEditorMode } from "../settings/settings";

export interface HtmlBlockEditModalOptions {
  title?: string;
  defaultEditorId?: HtmlEditorId;
  initialHtml: string;
  assetsBaseUrl: string;
  sourceEditorMode?: SourceEditorMode;
  onSave: (html: string) => Promise<void>;
}

export class HtmlBlockEditModal {
  private containerEl: HTMLElement | null = null;
  private modalEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private editorHostEl!: HTMLElement;
  private editorSelectEl: HTMLSelectElement | null = null;
  private sourceModeSelectEl: HTMLSelectElement | null = null;
  private editor: HtmlEditorAdapter | null = null;
  private html: string;
  private editorId: HtmlEditorId;
  private richEditorId: HtmlEditorId;
  private sourceEditorMode: SourceEditorMode;
  private isSaving = false;
  private isOpen = false;
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
    }
  };

  constructor(_app: App, private options: HtmlBlockEditModalOptions) {
    this.html = options.initialHtml;
    this.editorId = options.defaultEditorId === "source" ? "source" : getActiveRichEditorId(options.defaultEditorId);
    this.richEditorId = getActiveRichEditorId(options.defaultEditorId);
    this.sourceEditorMode = options.sourceEditorMode ?? "codemirror";
  }

  open(): void {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.containerEl = document.body.createDiv({ cls: "html-v-block-edit-modal-container" });
    const backdropEl = this.containerEl.createDiv({ cls: "html-v-block-edit-modal-backdrop" });
    stopObsidianMouseBubble(backdropEl);
    backdropEl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    this.modalEl = this.containerEl.createDiv({ cls: "html-v-block-edit-modal" });
    this.modalEl.setAttr("role", "dialog");
    this.modalEl.setAttr("aria-modal", "true");
    this.modalEl.setAttr("aria-label", this.options.title ?? "Edit html-v block");

    const headerEl = this.modalEl.createDiv({ cls: "html-v-block-edit-modal-header" });
    headerEl.createEl("h2", {
      cls: "html-v-block-edit-modal-title",
      text: this.options.title ?? "Edit html-v block"
    });
    const closeButton = headerEl.createEl("button", {
      cls: "html-v-block-edit-modal-close",
      attr: {
        "aria-label": "Close"
      },
      text: "x"
    });
    protectObsidianButton(closeButton);
    closeButton.addEventListener("click", () => {
      this.close();
    });

    this.contentEl = this.modalEl.createDiv({ cls: "html-v-block-edit-modal-content" });

    const toolbarEl = this.contentEl.createDiv({ cls: "html-v-block-edit-toolbar" });
    stopObsidianMouseBubble(toolbarEl);
    toolbarEl.createSpan({
      cls: "html-v-block-edit-editor-label",
      text: "Editor"
    }).addClass("is-hidden");
    this.editorSelectEl = toolbarEl.createEl("select", {
      cls: "html-v-block-edit-editor-select"
    });
    this.editorSelectEl.addClass("is-hidden");
    isolateObsidianControl(this.editorSelectEl);
    for (const editor of HTML_ACTIVE_RICH_EDITOR_DEFINITIONS) {
      this.editorSelectEl.createEl("option", {
        text: editor.displayName,
        value: editor.id
      });
    }
    this.editorSelectEl.value = this.editorId;
    this.editorSelectEl.addEventListener("change", () => {
      const nextId = this.editorSelectEl?.value;
      if (nextId && isRichHtmlEditorId(nextId)) {
        void this.switchEditor(nextId);
      }
    });
    const editButton = toolbarEl.createEl("button", {
      cls: "html-v-block-edit-source-button",
      text: "Edit"
    });
    protectObsidianButton(editButton);
    editButton.addEventListener("click", () => {
      void this.switchEditor(this.richEditorId);
    });
    this.sourceModeSelectEl = toolbarEl.createEl("select", {
      cls: "html-v-block-edit-source-select"
    });
    this.sourceModeSelectEl.createEl("option", { text: "CodeMirror", value: "codemirror" });
    this.sourceModeSelectEl.createEl("option", { text: "Textarea", value: "textarea" });
    this.sourceModeSelectEl.value = this.sourceEditorMode;
    isolateObsidianControl(this.sourceModeSelectEl);
    this.sourceModeSelectEl.addEventListener("change", () => {
      const nextMode = this.sourceModeSelectEl?.value;
      if (nextMode === "codemirror" || nextMode === "textarea") {
        void this.switchSourceMode(nextMode);
      }
    });
    const sourceButton = toolbarEl.createEl("button", {
      cls: "html-v-block-edit-source-button",
      text: "Source"
    });
    protectObsidianButton(sourceButton);
    sourceButton.addEventListener("click", () => {
      void this.switchEditor("source");
    });
    this.updateSourceModeSelect();

    this.editorHostEl = this.contentEl.createDiv({ cls: "html-v-block-edit-host" });

    const footerEl = this.contentEl.createDiv({ cls: "html-v-block-edit-footer" });
    stopObsidianMouseBubble(footerEl);
    const cancelButton = footerEl.createEl("button", {
      cls: "html-v-block-edit-footer-button",
      text: "Cancel"
    });
    protectObsidianButton(cancelButton);
    cancelButton.addEventListener("click", () => {
      this.close();
    });
    const saveButton = footerEl.createEl("button", {
      cls: "html-v-block-edit-footer-button mod-cta",
      text: "Save"
    });
    protectObsidianButton(saveButton);
    saveButton.addEventListener("click", () => {
      void this.save();
    });

    document.addEventListener("keydown", this.onKeyDown, true);
    this.mountEditor();
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.editor?.destroy();
    this.editor = null;
    this.containerEl?.remove();
    cleanupHugeRteAuxiliaryUi({ onlyWhenNoActiveEditors: true });
    this.containerEl = null;
    this.modalEl = null;
    this.contentEl = null;
    this.editorSelectEl = null;
    this.sourceModeSelectEl = null;
  }

  private mountEditor(): void {
    const editor = createHtmlEditorAdapter(this.editorId);
    this.editor = editor;

    editor.mount(this.editorHostEl, this.html, {
      assetsBaseUrl: this.options.assetsBaseUrl,
      isolateUiInFrame: false,
      sourceEditorMode: this.sourceEditorMode,
      onChange: (html) => {
        this.html = html;
      }
    }).then(() => {
      editor.focus();
    }).catch((error: unknown) => {
      console.error("Failed to mount html-v block editor", error);
      this.editor = null;
      this.editorHostEl.empty();
      const fallback = this.editorHostEl.createEl("textarea", {
        cls: "html-v-block-edit-fallback"
      });
      fallback.value = this.html;
      fallback.addEventListener("input", () => {
        this.html = fallback.value;
      });
      fallback.focus();
      new Notice(`${editor.displayName} failed to load. Fallback source editor is available.`);
    });
  }

  private async switchEditor(nextId: HtmlEditorId): Promise<void> {
    const normalizedId = nextId === "source" ? "source" : getActiveRichEditorId(nextId);
    if (this.editorId === normalizedId) {
      return;
    }

    this.html = this.editor?.getHtml() ?? this.html;
    this.editor?.destroy();
    this.editor = null;
    this.editorId = normalizedId;
    if (this.editorId !== "source") {
      this.richEditorId = this.editorId;
    }
    this.updateSourceModeSelect();
    this.mountEditor();
  }

  private async switchSourceMode(nextMode: SourceEditorMode): Promise<void> {
    if (this.sourceEditorMode === nextMode) {
      return;
    }

    this.html = this.editor?.getHtml() ?? this.html;
    this.editor?.destroy();
    this.editor = null;
    this.sourceEditorMode = nextMode;
    if (this.editorId === "source") {
      this.mountEditor();
    }
  }

  private updateSourceModeSelect(): void {
    this.sourceModeSelectEl?.toggleClass("is-hidden", this.editorId !== "source");
  }

  private async save(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    this.isSaving = true;

    try {
      const nextHtml = this.editor?.getHtml() ?? this.html;
      await this.options.onSave(nextHtml);
      this.close();
    } catch (error) {
      console.error("Failed to save html-v block", error);
      new Notice(error instanceof Error ? error.message : "Failed to save html-v block.");
    } finally {
      this.isSaving = false;
    }
  }
}
