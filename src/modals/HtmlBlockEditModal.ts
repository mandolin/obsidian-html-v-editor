import { Modal, Notice, Setting, type App } from "obsidian";

import {
  createHtmlEditorAdapter,
  getActiveRichEditorId,
  HTML_ACTIVE_RICH_EDITOR_DEFINITIONS,
  isRichHtmlEditorId
} from "../editors/HtmlEditorRegistry";
import type { HtmlEditorAdapter, HtmlEditorId } from "../editors/HtmlEditorAdapter";
import { protectObsidianButton } from "../editors/editorDom";
import type { SourceEditorMode } from "../settings/settings";

export interface HtmlBlockEditModalOptions {
  title?: string;
  defaultEditorId?: HtmlEditorId;
  initialHtml: string;
  assetsBaseUrl: string;
  sourceEditorMode?: SourceEditorMode;
  onSave: (html: string) => Promise<void>;
}

export class HtmlBlockEditModal extends Modal {
  private editorHostEl!: HTMLElement;
  private editorSelectEl: HTMLSelectElement | null = null;
  private sourceModeSelectEl: HTMLSelectElement | null = null;
  private editor: HtmlEditorAdapter | null = null;
  private html: string;
  private editorId: HtmlEditorId;
  private richEditorId: HtmlEditorId;
  private sourceEditorMode: SourceEditorMode;
  private isSaving = false;

  constructor(app: App, private options: HtmlBlockEditModalOptions) {
    super(app);
    this.html = options.initialHtml;
    this.editorId = options.defaultEditorId === "source" ? "source" : getActiveRichEditorId(options.defaultEditorId);
    this.richEditorId = getActiveRichEditorId(options.defaultEditorId);
    this.sourceEditorMode = options.sourceEditorMode ?? "codemirror";
  }

  onOpen(): void {
    this.setTitle(this.options.title ?? "Edit html-v block");
    this.modalEl.addClass("html-v-block-edit-modal");
    this.contentEl.empty();

    const toolbarEl = this.contentEl.createDiv({ cls: "html-v-block-edit-toolbar" });
    toolbarEl.createSpan({
      cls: "html-v-block-edit-editor-label",
      text: "Editor"
    }).addClass("is-hidden");
    this.editorSelectEl = toolbarEl.createEl("select", {
      cls: "html-v-block-edit-editor-select"
    });
    this.editorSelectEl.addClass("is-hidden");
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
    new Setting(footerEl)
      .addButton((button) => {
        button
          .setButtonText("Cancel")
          .onClick(() => {
            this.close();
          });
      })
      .addButton((button) => {
        button
          .setCta()
          .setButtonText("Save")
          .onClick(() => {
            void this.save();
          });
      });

    this.mountEditor();
  }

  onClose(): void {
    this.editor?.destroy();
    this.editor = null;
    this.contentEl.empty();
  }

  private mountEditor(): void {
    const editor = createHtmlEditorAdapter(this.editorId);
    this.editor = editor;

    editor.mount(this.editorHostEl, this.html, {
      assetsBaseUrl: this.options.assetsBaseUrl,
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
