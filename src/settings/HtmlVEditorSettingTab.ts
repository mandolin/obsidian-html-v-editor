import { App, PluginSettingTab, Setting } from "obsidian";

import {
  getActiveRichEditorId,
  HTML_ACTIVE_RICH_EDITOR_DEFINITIONS,
  isRichHtmlEditorId
} from "../editors/HtmlEditorRegistry";
import type HtmlVEditorPlugin from "../main";
import type { HtmlPreviewSecurityLevel } from "./settings";

export class HtmlVEditorSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: HtmlVEditorPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "HTML V Editor" });

    new Setting(containerEl)
      .setName("Default editor")
      .setDesc("HugeRTE is the default visual editor. Source is a built-in plain HTML editor and fallback adapter.")
      .addDropdown((dropdown) => {
        for (const editor of HTML_ACTIVE_RICH_EDITOR_DEFINITIONS) {
          dropdown.addOption(editor.id, editor.displayName);
        }

        dropdown
          .setValue(getActiveRichEditorId(this.plugin.settings.defaultEditor))
          .onChange(async (value) => {
            if (isRichHtmlEditorId(value)) {
              this.plugin.settings.defaultEditor = getActiveRichEditorId(value);
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("Default Source backend")
      .setDesc("Controls whether Source mode uses CodeMirror or a plain textarea. CodeMirror is the richer default.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("codemirror", "CodeMirror")
          .addOption("textarea", "Textarea")
          .setValue(this.plugin.settings.defaultSourceEditorMode)
          .onChange(async (value) => {
            if (value === "codemirror" || value === "textarea") {
              this.plugin.settings.defaultSourceEditorMode = value;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("Default preview security")
      .setDesc("Controls how HTML is rendered in Preview mode. Safe is the recommended default.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("safe", "Safe")
          .addOption("sandbox", "Sandbox")
          .addOption("trusted", "Trusted")
          .setValue(this.plugin.settings.defaultSecurityLevel)
          .onChange(async (value) => {
            this.plugin.settings.defaultSecurityLevel = value as HtmlPreviewSecurityLevel;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName("Live Preview html-v blocks")
      .setDesc("Replace ```html-v fenced blocks in Live Preview with rendered previews and inline edit actions. Plain HTML blocks are left to Obsidian.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.livePreviewHtmlWidgets)
          .onChange(async (value) => {
            this.plugin.settings.livePreviewHtmlWidgets = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Live Preview HTML file embeds")
      .setDesc("Replace ![[file.html]] and ![[file.htm]] embeds in Live Preview with rendered previews and inline edit actions.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.livePreviewEmbedWidgets)
          .onChange(async (value) => {
            this.plugin.settings.livePreviewEmbedWidgets = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Live Preview edit trigger")
      .setDesc("Choose whether previews are edited from a hover button or by clicking anywhere on the preview.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("button", "Hover button")
          .addOption("click", "Click preview")
          .setValue(this.plugin.settings.livePreviewEditTrigger)
          .onChange(async (value) => {
            if (value === "button" || value === "click") {
              this.plugin.settings.livePreviewEditTrigger = value;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("Folder trust files")
      .setDesc("Read .htmlv JSON files from the vault root and parent folders. Later folders override earlier matches.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableFolderTrustFiles)
          .onChange(async (value) => {
            this.plugin.settings.enableFolderTrustFiles = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Trust rules JSON")
      .setDesc("Global rules. Example: [{\"scope\":\"folder\",\"pattern\":\"trusted-html\",\"securityLevel\":\"trusted\"}]. Source rules match external URL origins.")
      .addTextArea((text) => {
        text.inputEl.rows = 6;
        text.inputEl.cols = 40;
        text
          .setValue(JSON.stringify(this.plugin.settings.trustRules ?? [], null, 2))
          .onChange(async (value) => {
            try {
              const parsed = JSON.parse(value) as typeof this.plugin.settings.trustRules;
              if (Array.isArray(parsed)) {
                this.plugin.settings.trustRules = parsed;
                await this.plugin.saveSettings();
              }
            } catch {
              // Keep the previous valid value while the user is editing.
            }
          });
      });

    new Setting(containerEl)
      .setName("Safe mode remote images")
      .setDesc("Allow http and https images in Safe mode. Scripts and embedded frames remain blocked.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.safeAllowRemoteImages)
          .onChange(async (value) => {
            this.plugin.settings.safeAllowRemoteImages = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sandbox: allow scripts")
      .setDesc("Allow JavaScript inside sandboxed previews. The default is off.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.allowScriptsInSandbox)
          .onChange(async (value) => {
            this.plugin.settings.allowScriptsInSandbox = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sandbox: allow same-origin")
      .setDesc("Allows sandboxed content to keep its origin. Leave off unless a file needs it.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.allowSameOriginInSandbox)
          .onChange(async (value) => {
            this.plugin.settings.allowSameOriginInSandbox = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sandbox: allow forms")
      .setDesc("Allow forms to submit inside sandboxed previews.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.allowFormsInSandbox)
          .onChange(async (value) => {
            this.plugin.settings.allowFormsInSandbox = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sandbox: allow popups")
      .setDesc("Allow links or scripts in sandboxed previews to open popups.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.allowPopupsInSandbox)
          .onChange(async (value) => {
            this.plugin.settings.allowPopupsInSandbox = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Trusted mode scripts")
      .setDesc("Allow JavaScript in Trusted previews. This is still off by default.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.trustedAllowScripts)
          .onChange(async (value) => {
            this.plugin.settings.trustedAllowScripts = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Reset security settings")
      .setDesc("Restore the conservative default preview settings.")
      .addButton((button) => {
        button
          .setButtonText("Reset")
          .onClick(async () => {
            await this.plugin.resetSettings();
            this.display();
          });
      });
  }
}
