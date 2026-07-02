import type { HtmlEditorId } from "../editors/HtmlEditorAdapter";
import type { CharacterMapGroupId, CustomCharacterMapEntry } from "../editors/HugeRteCharacterMap";

export type HtmlPreviewSecurityLevel = "safe" | "sandbox" | "trusted";
export type SourceEditorMode = "textarea" | "codemirror";
export type LivePreviewEditTrigger = "button" | "click";
export type TaskPanelDefaultStatus = "all" | "open" | "done";

export interface HtmlVEditorSettings {
  defaultEditor: HtmlEditorId;
  defaultSourceEditorMode: SourceEditorMode;
  defaultSecurityLevel: HtmlPreviewSecurityLevel;
  livePreviewHtmlWidgets: boolean;
  livePreviewEmbedWidgets: boolean;
  livePreviewEditTrigger: LivePreviewEditTrigger;
  enableFolderTrustFiles: boolean;
  trustRules: HtmlTrustRule[];
  allowScriptsInSandbox: boolean;
  allowSameOriginInSandbox: boolean;
  allowFormsInSandbox: boolean;
  allowPopupsInSandbox: boolean;
  safeAllowRemoteImages: boolean;
  trustedAllowScripts: boolean;
  enableChecklist: boolean;
  enableCharacterMap: boolean;
  characterMapGroups: CharacterMapGroupId[];
  customCharacterMap: CustomCharacterMapEntry[];
  taskPanelIncludeMarkdownTasks: boolean;
  taskPanelDefaultStatus: TaskPanelDefaultStatus;
  taskPanelPageSize: number;
}

export type HtmlTrustScope = "file" | "folder" | "source";

export interface HtmlTrustRule {
  scope: HtmlTrustScope;
  pattern: string;
  securityLevel: HtmlPreviewSecurityLevel;
}

export const DEFAULT_SETTINGS: HtmlVEditorSettings = {
  defaultEditor: "hugerte",
  defaultSourceEditorMode: "codemirror",
  defaultSecurityLevel: "safe",
  livePreviewHtmlWidgets: true,
  livePreviewEmbedWidgets: true,
  livePreviewEditTrigger: "button",
  enableFolderTrustFiles: true,
  trustRules: [],
  allowScriptsInSandbox: false,
  allowSameOriginInSandbox: false,
  allowFormsInSandbox: false,
  allowPopupsInSandbox: true,
  safeAllowRemoteImages: false,
  trustedAllowScripts: false,
  enableChecklist: true,
  enableCharacterMap: true,
  characterMapGroups: ["common", "arrows", "boxDrawing", "shapes", "math"],
  customCharacterMap: [],
  taskPanelIncludeMarkdownTasks: true,
  taskPanelDefaultStatus: "open",
  taskPanelPageSize: 100
};
