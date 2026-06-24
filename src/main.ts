import { Menu, Notice, Plugin, TAbstractFile, TFile, normalizePath, type WorkspaceLeaf } from "obsidian";

import { editHtmlBlockAtCursor, editSelectedHtml } from "./commands/HtmlBlockEditorCommands";
import { HTML_FILE_EXTENSIONS, HTML_V_EDITOR_VIEW_TYPE } from "./constants";
import { cleanupHugeRteAuxiliaryUi } from "./editors/HugeRteAdapter";
import { HtmlFileEmbedProcessor } from "./markdown/HtmlFileEmbedProcessor";
import { RawHtmlBlockProcessor } from "./markdown/RawHtmlBlockProcessor";
import { HtmlVCodeBlockProcessor } from "./markdown/HtmlVCodeBlockProcessor";
import { createLivePreviewHtmlWidgets } from "./markdown/LivePreviewHtmlWidgets";
import { HtmlTrustManager } from "./security/HtmlTrustManager";
import { HtmlVEditorSettingTab } from "./settings/HtmlVEditorSettingTab";
import { DEFAULT_SETTINGS, type HtmlVEditorSettings } from "./settings/settings";
import { HtmlVEditorView } from "./views/HtmlVEditorView";

export default class HtmlVEditorPlugin extends Plugin {
  settings: HtmlVEditorSettings = { ...DEFAULT_SETTINGS };
  private trustManager: HtmlTrustManager | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    const assetsBaseUrl = this.getHugeRteAssetsBaseUrl();
    this.trustManager = new HtmlTrustManager(this.app, () => this.settings);
    const getPreviewSettings = (sourcePath: string, html: string) => this.getPreviewSettings(sourcePath, html);

    this.registerView(
      HTML_V_EDITOR_VIEW_TYPE,
      (leaf) => new HtmlVEditorView(leaf, assetsBaseUrl, () => this.settings, getPreviewSettings)
    );
    this.registerHtmlExtensions();
    this.addSettingTab(new HtmlVEditorSettingTab(this.app, this));
    const htmlVCodeBlockProcessor = new HtmlVCodeBlockProcessor({
      app: this.app,
      assetsBaseUrl,
      getSettings: () => this.settings,
      getPreviewSettings
    });
    this.registerMarkdownCodeBlockProcessor("html-v", (source, el, ctx) => {
      htmlVCodeBlockProcessor.process(source, el, ctx);
    });
    const htmlFileEmbedProcessor = new HtmlFileEmbedProcessor({
      app: this.app,
      assetsBaseUrl,
      getSettings: () => this.settings,
      getPreviewSettings
    });
    this.registerMarkdownPostProcessor((el, ctx) => {
      htmlFileEmbedProcessor.process(el, ctx);
    }, 1000);
    const rawHtmlBlockProcessor = new RawHtmlBlockProcessor({
      app: this.app,
      getSettings: () => this.settings,
      getPreviewSettings
    });
    this.registerMarkdownPostProcessor((el, ctx) => {
      rawHtmlBlockProcessor.process(el, ctx);
    }, 999);
    this.registerEditorExtension(createLivePreviewHtmlWidgets({
      app: this.app,
      assetsBaseUrl,
      getSettings: () => this.settings,
      getPreviewSettings
    }));

    this.addCommand({
      id: "open-current-html-file",
      name: "Open current HTML file with HTML V Editor",
      callback: () => {
        void this.openActiveHtmlFile();
      }
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
      this.addHtmlFileMenuItem(menu, file, source, leaf);
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
      cleanupHugeRteAuxiliaryUi();
    }));
    this.addCommand({
      id: "edit-selected-html",
      name: "Edit selected HTML with HTML V Editor",
      editorCallback: (editor) => {
        editSelectedHtml(editor, {
          app: this.app,
          assetsBaseUrl,
          defaultEditorId: this.settings.defaultEditor,
          sourceEditorMode: this.settings.defaultSourceEditorMode
        });
      }
    });
    this.addCommand({
      id: "edit-html-block-at-cursor",
      name: "Edit HTML block at cursor with HTML V Editor",
      editorCallback: (editor) => {
        editHtmlBlockAtCursor(editor, {
          app: this.app,
          assetsBaseUrl,
          defaultEditorId: this.settings.defaultEditor,
          sourceEditorMode: this.settings.defaultSourceEditorMode
        });
      }
    });

    console.log("HTML V Editor loaded");
  }

  onunload(): void {
    cleanupHugeRteAuxiliaryUi();
    console.log("HTML V Editor unloaded");
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData())
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshOpenPreviews();
  }

  async resetSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
  }

  private getHugeRteAssetsBaseUrl(): string {
    const pluginDir = this.manifest.dir;
    if (!pluginDir) {
      return "hugerte";
    }

    return this.app.vault.adapter.getResourcePath(normalizePath(`${pluginDir}/hugerte`));
  }

  private async getPreviewSettings(sourcePath: string, html: string): Promise<HtmlVEditorSettings> {
    return this.trustManager?.getPreviewSettings({ sourcePath, html }) ?? this.settings;
  }

  private async openActiveHtmlFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();

    if (!(file instanceof TFile) || !HTML_FILE_EXTENSIONS.includes(file.extension.toLowerCase())) {
      new Notice("Open an .html or .htm file first.");
      return;
    }

    await this.openHtmlFile(file);
  }

  private registerHtmlExtensions(): void {
    try {
      this.registerExtensions(HTML_FILE_EXTENSIONS, HTML_V_EDITOR_VIEW_TYPE);
    } catch (error) {
      console.warn(
        "HTML V Editor could not register .html/.htm as the default file view. Another plugin may already own the extension.",
        error
      );
      new Notice("HTML V Editor loaded, but .html/.htm is already registered by another plugin.");
    }
  }

  private addHtmlFileMenuItem(menu: Menu, file: TAbstractFile, _source: string, _leaf?: WorkspaceLeaf): void {
    if (!(file instanceof TFile) || !HTML_FILE_EXTENSIONS.includes(file.extension.toLowerCase())) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle("Open with HTML V Editor")
        .setIcon("file-code")
        .onClick(() => {
          void this.openHtmlFile(file);
        });
    });
  }

  private async openHtmlFile(file: TFile, existingLeaf?: WorkspaceLeaf): Promise<void> {
    const leaf = existingLeaf ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: HTML_V_EDITOR_VIEW_TYPE,
      state: {
        file: file.path
      },
      active: true
    });
    await this.app.workspace.revealLeaf(leaf);
  }

  private refreshOpenPreviews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(HTML_V_EDITOR_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof HtmlVEditorView) {
        view.refreshPreview();
      }
    }
  }
}
