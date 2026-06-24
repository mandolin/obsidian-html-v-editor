import { Notice, TextFileView, type TFile, type WorkspaceLeaf } from "obsidian";

import { HTML_V_EDITOR_VIEW_TYPE } from "../constants";
import {
  createHtmlEditorAdapter,
  getActiveRichEditorId,
  HTML_ACTIVE_RICH_EDITOR_DEFINITIONS,
  isRichHtmlEditorId
} from "../editors/HtmlEditorRegistry";
import type { HtmlEditorAdapter, HtmlEditorId } from "../editors/HtmlEditorAdapter";
import { protectObsidianButton } from "../editors/editorDom";
import { HtmlPreviewRenderer } from "../render/HtmlPreviewRenderer";
import { renderHtmlForPreview } from "../security/HtmlSecurityPolicy";
import type { HtmlVEditorSettings } from "../settings/settings";

type EditorMode = "preview" | "edit" | "source";

export class HtmlVEditorView extends TextFileView {
  private mode: EditorMode = "preview";
  private html = "";
  private isDirty = false;
  private assetsBaseUrl: string;
  private getSettings: () => HtmlVEditorSettings;
  private getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>;

  private toolbarEl!: HTMLElement;
  private fileNameEl!: HTMLElement;
  private modeButtons = new Map<EditorMode, HTMLButtonElement>();
  private saveButton: HTMLButtonElement | null = null;
  private editorSelectEl: HTMLSelectElement | null = null;
  private sourceModeSelectEl: HTMLSelectElement | null = null;
  private editorContainerEl!: HTMLElement;
  private editorAdapter: HtmlEditorAdapter | null = null;
  private selectedEditorId: HtmlEditorId;
  private selectedSourceEditorMode: HtmlVEditorSettings["defaultSourceEditorMode"];
  private previewRenderer = new HtmlPreviewRenderer();

  constructor(
    leaf: WorkspaceLeaf,
    assetsBaseUrl: string,
    getSettings: () => HtmlVEditorSettings,
    getPreviewSettings: (sourcePath: string, html: string) => Promise<HtmlVEditorSettings>
  ) {
    super(leaf);
    this.assetsBaseUrl = assetsBaseUrl;
    this.getSettings = getSettings;
    this.getPreviewSettings = getPreviewSettings;
    this.selectedEditorId = getActiveRichEditorId(getSettings().defaultEditor);
    this.selectedSourceEditorMode = getSettings().defaultSourceEditorMode;
  }

  getViewType(): string {
    return HTML_V_EDITOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file ? `HTML V Editor: ${this.file.basename}` : "HTML V Editor";
  }

  getIcon(): string {
    return "file-code";
  }

  canAcceptExtension(extension: string): boolean {
    return extension === "html" || extension === "htm";
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    const data = await this.app.vault.read(file);
    this.setViewData(data, true);
    this.updateFileName(file);
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.syncFromActiveMode();
    await super.onUnloadFile(file);
  }

  getViewData(): string {
    this.syncFromActiveMode();
    return this.html;
  }

  setViewData(data: string, clear: boolean): void {
    this.html = data;
    this.isDirty = false;

    if (clear) {
      this.clear();
    }

    this.renderActiveMode();
    this.updateSaveButtonState();
  }

  clear(): void {
    this.destroyModeContent();
  }

  refreshPreview(): void {
    if (this.mode === "preview") {
      this.renderActiveMode();
    }
  }

  protected async onOpen(): Promise<void> {
    this.containerEl.addClass("html-v-editor-view");
    this.renderShell();
    this.renderActiveMode();
  }

  protected async onClose(): Promise<void> {
    this.destroyModeContent();
    this.previewRenderer.destroy();
  }

  private renderShell(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("html-v-editor-root");

    this.toolbarEl = root.createDiv({ cls: "html-v-editor-toolbar" });

    this.fileNameEl = this.toolbarEl.createDiv({
      cls: "html-v-editor-file-name",
      text: this.file?.path ?? "No HTML file"
    });

    const modeGroupEl = this.toolbarEl.createDiv({ cls: "html-v-editor-mode-group" });
    this.modeButtons.clear();

    this.createModeButton(modeGroupEl, "preview", "Preview");
    this.createModeButton(modeGroupEl, "edit", "Edit");
    this.createModeButton(modeGroupEl, "source", "Source");

    const actionsEl = this.toolbarEl.createDiv({ cls: "html-v-editor-actions" });
    this.editorSelectEl = actionsEl.createEl("select", {
      cls: "html-v-editor-editor-select"
    });
    this.editorSelectEl.addClass("is-hidden");
    for (const editor of HTML_ACTIVE_RICH_EDITOR_DEFINITIONS) {
      this.editorSelectEl.createEl("option", {
        text: editor.displayName,
        value: editor.id
      });
    }
    this.editorSelectEl.addEventListener("change", () => {
      const nextId = this.editorSelectEl?.value;
      if (nextId && isRichHtmlEditorId(nextId)) {
        void this.switchEditorAdapter(nextId);
      }
    });
    this.sourceModeSelectEl = actionsEl.createEl("select", {
      cls: "html-v-editor-source-select"
    });
    this.sourceModeSelectEl.createEl("option", { text: "CodeMirror", value: "codemirror" });
    this.sourceModeSelectEl.createEl("option", { text: "Textarea", value: "textarea" });
    this.sourceModeSelectEl.value = this.selectedSourceEditorMode;
    this.sourceModeSelectEl.addEventListener("change", () => {
      const nextMode = this.sourceModeSelectEl?.value;
      if (nextMode === "codemirror" || nextMode === "textarea") {
        this.selectedSourceEditorMode = nextMode;
        if (this.mode === "source") {
          this.syncFromActiveMode();
          this.renderActiveMode();
        }
      }
    });

    this.saveButton = actionsEl.createEl("button", {
      cls: "html-v-editor-save-button",
      text: "Save"
    });
    protectObsidianButton(this.saveButton);
    this.saveButton.addEventListener("click", () => {
      void this.saveCurrentFile();
    });

    this.editorContainerEl = root.createDiv({ cls: "html-v-editor-content" });
    this.updateModeButtons();
    this.updateEditorSelect();
    this.updateSaveButtonState();
  }

  private createModeButton(parent: HTMLElement, mode: EditorMode, text: string): void {
    const button = parent.createEl("button", {
      cls: "html-v-editor-mode-button",
      text
    });
    protectObsidianButton(button);
    button.addEventListener("click", () => {
      void this.switchMode(mode);
    });
    this.modeButtons.set(mode, button);
  }

  private async switchMode(nextMode: EditorMode): Promise<void> {
    if (this.mode === nextMode) {
      return;
    }

    this.syncFromActiveMode();
    this.mode = nextMode;
    this.renderActiveMode();
  }

  private renderActiveMode(): void {
    if (!this.editorContainerEl) {
      return;
    }

    this.destroyModeContent();
    this.updateModeButtons();
    this.updateEditorSelect();

    if (this.mode === "preview") {
      const sourcePath = this.file?.path ?? "";
      void this.getPreviewSettings(sourcePath, this.html).then((settings) => {
        if (this.mode !== "preview") {
          return;
        }

        const preview = renderHtmlForPreview(this.html, settings);
        this.previewRenderer.render(this.editorContainerEl, preview.html, {
          sandbox: preview.sandbox
        });
      });
      return;
    }

    if (this.mode === "source") {
      this.renderSourceEditor();
      return;
    }

    this.renderAdapterEditor();
  }

  private renderAdapterEditor(): void {
    const editorHost = this.editorContainerEl.createDiv({ cls: "html-v-editor-rich-host" });
    const adapter = createHtmlEditorAdapter(this.selectedEditorId);
    this.editorAdapter = adapter;

    adapter.mount(editorHost, this.html, {
      assetsBaseUrl: this.assetsBaseUrl,
      sourceEditorMode: this.selectedSourceEditorMode,
      onChange: (html) => {
        this.html = html;
        this.markDirty();
      }
    }).then(() => {
      adapter.focus();
    }).catch((error: unknown) => {
      console.error(`Failed to mount ${adapter.displayName}`, error);
      this.editorAdapter = null;
      editorHost.empty();
      editorHost.createDiv({
        cls: "html-v-editor-error",
        text: `${adapter.displayName} failed to load. Use Source mode to continue editing.`
      });
      new Notice(`${adapter.displayName} failed to load. Source mode is still available.`);
    });
  }

  private renderSourceEditor(): void {
    const editorHost = this.editorContainerEl.createDiv({ cls: "html-v-editor-source-host" });
    const adapter = createHtmlEditorAdapter("source");
    this.editorAdapter = adapter;

    adapter.mount(editorHost, this.html, {
      assetsBaseUrl: this.assetsBaseUrl,
      sourceEditorMode: this.selectedSourceEditorMode,
      onChange: (html) => {
        this.html = html;
        this.markDirty();
      }
    }).then(() => {
      adapter.focus();
    }).catch((error: unknown) => {
      console.error("Failed to mount Source editor", error);
      this.editorAdapter = null;
      editorHost.empty();
      editorHost.createDiv({
        cls: "html-v-editor-error",
        text: "Source editor failed to load."
      });
      new Notice("Source editor failed to load.");
    });
  }

  private async switchEditorAdapter(nextId: HtmlEditorId): Promise<void> {
    if (this.selectedEditorId === nextId) {
      return;
    }

    this.syncFromActiveMode();
    this.selectedEditorId = getActiveRichEditorId(nextId);

    if (this.mode === "edit") {
      this.renderActiveMode();
    } else {
      this.updateEditorSelect();
    }
  }

  private destroyModeContent(): void {
    this.previewRenderer.destroy();
    this.editorAdapter?.destroy();
    this.editorAdapter = null;
    this.editorContainerEl?.empty();
  }

  private syncFromActiveMode(): void {
    if ((this.mode === "edit" || this.mode === "source") && this.editorAdapter) {
      this.html = this.editorAdapter.getHtml();
    }
  }

  private markDirty(): void {
    this.isDirty = true;
    this.updateSaveButtonState();
  }

  private updateFileName(file: TFile): void {
    if (this.fileNameEl) {
      this.fileNameEl.setText(file.path);
    }
  }

  private updateModeButtons(): void {
    for (const [mode, button] of this.modeButtons) {
      if (mode === "preview" || mode === "edit" || mode === "source") {
        button.toggleClass("is-active", mode === this.mode);
      }
    }
  }

  private updateEditorSelect(): void {
    if (!this.editorSelectEl) {
      return;
    }

    this.editorSelectEl.value = this.selectedEditorId === "source" ? "hugerte" : this.selectedEditorId;
    this.editorSelectEl.toggleClass("is-hidden", true);
    this.sourceModeSelectEl?.toggleClass("is-hidden", this.mode !== "source");
    if (this.sourceModeSelectEl) {
      this.sourceModeSelectEl.value = this.selectedSourceEditorMode;
    }
  }

  private updateSaveButtonState(): void {
    if (!this.saveButton) {
      return;
    }
    this.saveButton.toggleClass("is-dirty", this.isDirty);
    this.saveButton.setText(this.isDirty ? "Save *" : "Save");
  }

  private async saveCurrentFile(): Promise<void> {
    this.syncFromActiveMode();
    await this.save();
    this.isDirty = false;
    this.updateSaveButtonState();
    new Notice("HTML saved.");
  }
}
