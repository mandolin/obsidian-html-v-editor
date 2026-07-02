import { App, PluginSettingTab, Setting } from "obsidian";

import {
  getActiveRichEditorId,
  HTML_ACTIVE_RICH_EDITOR_DEFINITIONS,
  isRichHtmlEditorId
} from "../editors/HtmlEditorRegistry";
import {
  CHARACTER_MAP_GROUPS,
  normalizeCharacterMapGroups,
  normalizeCustomCharacters,
  type CharacterMapGroupId,
  type CustomCharacterMapEntry
} from "../editors/HugeRteCharacterMap";
import type HtmlVEditorPlugin from "../main";
import { DEFAULT_SETTINGS, type HtmlPreviewSecurityLevel, type TaskPanelDefaultStatus } from "./settings";

export class HtmlVEditorSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: HtmlVEditorPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "HTML V Editor" });
    containerEl.createEl("p", {
      text: "当前设置以稳定默认值为主。修改后会刷新已打开的 HTML 预览和任务索引。"
    });

    containerEl.createEl("h3", { text: "编辑器" });

    new Setting(containerEl)
      .setName("默认可视化编辑器")
      .setDesc("HugeRTE 是默认可视化编辑器；Source 是内置源码编辑和兜底编辑器。")
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
      .setName("默认 Source 后端")
      .setDesc("控制 Source 模式使用 CodeMirror 还是普通 textarea。CodeMirror 是默认值。")
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
      .setName("Checklist 按钮")
      .setDesc("在 HugeRTE 工具栏中显示 checklist 按钮。关闭后不影响已有 checklist 的预览样式。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableChecklist)
          .onChange(async (value) => {
            this.plugin.settings.enableChecklist = value;
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl("h3", { text: "特殊字符" });

    new Setting(containerEl)
      .setName("特殊字符按钮")
      .setDesc("在 HugeRTE 工具栏中显示特殊字符对话框。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableCharacterMap)
          .onChange(async (value) => {
            this.plugin.settings.enableCharacterMap = value;
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl("h4", { text: "默认字符组" });
    for (const group of CHARACTER_MAP_GROUPS) {
      new Setting(containerEl)
        .setName(group.name)
        .setDesc(group.characters.map((entry) => entry.char).join(" "))
        .addToggle((toggle) => {
          toggle
            .setValue(this.plugin.settings.characterMapGroups.includes(group.id))
            .onChange(async (value) => {
              const groups = new Set<CharacterMapGroupId>(this.plugin.settings.characterMapGroups);
              if (value) {
                groups.add(group.id);
              } else {
                groups.delete(group.id);
              }
              this.plugin.settings.characterMapGroups = normalizeCharacterMapGroups(Array.from(groups));
              await this.plugin.saveSettings();
              this.display();
            });
        });
    }

    new Setting(containerEl)
      .setName("自定义特殊字符")
      .setDesc("JSON 数组。例如：[{\"char\":\"☕\",\"name\":\"Coffee\"}]。")
      .addTextArea((text) => {
        text.inputEl.rows = 5;
        text.inputEl.cols = 40;
        text
          .setValue(JSON.stringify(this.plugin.settings.customCharacterMap ?? [], null, 2))
          .onChange(async (value) => {
            try {
              const parsed = JSON.parse(value) as CustomCharacterMapEntry[];
              if (Array.isArray(parsed)) {
                this.plugin.settings.customCharacterMap = normalizeCustomCharacters(parsed);
                await this.plugin.saveSettings();
              }
            } catch {
              // 用户输入临时非法 JSON 时，保留上一次有效配置。
            }
          });
      });

    containerEl.createEl("h3", { text: "任务面板" });

    new Setting(containerEl)
      .setName("索引普通 Markdown task")
      .setDesc("开启后，HTML V Tasks 会同时索引 Markdown 中的 - [ ] / - [x] 任务。关闭后只保留 HTML V checklist 类任务。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.taskPanelIncludeMarkdownTasks)
          .onChange(async (value) => {
            this.plugin.settings.taskPanelIncludeMarkdownTasks = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("任务面板默认状态")
      .setDesc("打开任务面板时默认显示全部、未完成或已完成任务。")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("all", "All")
          .addOption("open", "Open")
          .addOption("done", "Done")
          .setValue(this.plugin.settings.taskPanelDefaultStatus)
          .onChange(async (value) => {
            if (isTaskPanelDefaultStatus(value)) {
              this.plugin.settings.taskPanelDefaultStatus = value;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("任务面板每页数量")
      .setDesc("分页渲染时每页显示的任务数。范围 20-500，默认 100。")
      .addText((text) => {
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.taskPanelPageSize))
          .setValue(String(this.plugin.settings.taskPanelPageSize))
          .onChange(async (value) => {
            const nextValue = normalizeTaskPanelPageSize(Number(value));
            this.plugin.settings.taskPanelPageSize = nextValue;
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl("h3", { text: "预览与安全" });

    new Setting(containerEl)
      .setName("默认预览安全级别")
      .setDesc("控制 Preview 模式如何渲染 HTML。推荐默认使用 Safe。")
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
      .setName("Live Preview 中渲染 html-v block")
      .setDesc("在 Live Preview 中把 ```html-v fenced block 替换为预览和编辑入口。普通 HTML block 仍交给 Obsidian。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.livePreviewHtmlWidgets)
          .onChange(async (value) => {
            this.plugin.settings.livePreviewHtmlWidgets = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Live Preview 中渲染 HTML 文件 embed")
      .setDesc("在 Live Preview 中把 ![[file.html]] / ![[file.htm]] 替换为预览和编辑入口。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.livePreviewEmbedWidgets)
          .onChange(async (value) => {
            this.plugin.settings.livePreviewEmbedWidgets = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Live Preview 编辑触发方式")
      .setDesc("选择通过悬浮按钮编辑，还是点击预览区域直接编辑。")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("button", "悬浮按钮")
          .addOption("click", "点击预览")
          .setValue(this.plugin.settings.livePreviewEditTrigger)
          .onChange(async (value) => {
            if (value === "button" || value === "click") {
              this.plugin.settings.livePreviewEditTrigger = value;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("文件夹 trust 配置")
      .setDesc("读取 vault 根目录和父文件夹中的 .htmlv JSON。越靠近文件的规则优先级越高。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableFolderTrustFiles)
          .onChange(async (value) => {
            this.plugin.settings.enableFolderTrustFiles = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("全局 trust 规则 JSON")
      .setDesc("全局规则。例如：[{\"scope\":\"folder\",\"pattern\":\"trusted-html\",\"securityLevel\":\"trusted\"}]。source 规则匹配外部 URL origin。")
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
              // 用户输入临时非法 JSON 时，保留上一次有效配置。
            }
          });
      });

    new Setting(containerEl)
      .setName("Safe 模式允许远程图片")
      .setDesc("允许 Safe 模式加载 http/https 图片。脚本和嵌入 frame 仍会被阻止。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.safeAllowRemoteImages)
          .onChange(async (value) => {
            this.plugin.settings.safeAllowRemoteImages = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sandbox：允许脚本")
      .setDesc("允许 sandbox 预览中的 JavaScript。默认关闭。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.allowScriptsInSandbox)
          .onChange(async (value) => {
            this.plugin.settings.allowScriptsInSandbox = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sandbox：允许 same-origin")
      .setDesc("允许 sandbox 内容保留自身 origin。除非文件明确需要，否则建议关闭。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.allowSameOriginInSandbox)
          .onChange(async (value) => {
            this.plugin.settings.allowSameOriginInSandbox = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sandbox：允许表单")
      .setDesc("允许 sandbox 预览中的表单提交。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.allowFormsInSandbox)
          .onChange(async (value) => {
            this.plugin.settings.allowFormsInSandbox = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sandbox：允许弹窗")
      .setDesc("允许 sandbox 预览中的链接或脚本打开弹窗。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.allowPopupsInSandbox)
          .onChange(async (value) => {
            this.plugin.settings.allowPopupsInSandbox = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Trusted 模式允许脚本")
      .setDesc("允许 Trusted 预览中的 JavaScript。默认仍然关闭。")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.trustedAllowScripts)
          .onChange(async (value) => {
            this.plugin.settings.trustedAllowScripts = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("重置设置")
      .setDesc("恢复插件默认设置。默认值保持保守，尤其是安全相关选项。")
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

function isTaskPanelDefaultStatus(value: string): value is TaskPanelDefaultStatus {
  return value === "all" || value === "open" || value === "done";
}

function normalizeTaskPanelPageSize(value: number): number {
  return Number.isFinite(value)
    ? Math.min(500, Math.max(20, Math.floor(value)))
    : DEFAULT_SETTINGS.taskPanelPageSize;
}
