import { Notice, type App, type Editor } from "obsidian";

import type { HtmlEditorId } from "../editors/HtmlEditorAdapter";
import { HtmlBlockEditModal } from "../modals/HtmlBlockEditModal";
import { findHtmlBlockAtCursor } from "../markdown/HtmlBlockRange";
import type { SourceEditorMode } from "../settings/settings";

export interface HtmlBlockEditorCommandOptions {
  app: App;
  assetsBaseUrl: string;
  defaultEditorId: HtmlEditorId;
  sourceEditorMode: SourceEditorMode;
}

export function editSelectedHtml(editor: Editor, options: HtmlBlockEditorCommandOptions): void {
  const selected = editor.getSelection();
  if (!selected.trim()) {
    new Notice("Select an HTML block first.");
    return;
  }

  new HtmlBlockEditModal(options.app, {
    title: "Edit selected HTML",
    initialHtml: selected,
    defaultEditorId: options.defaultEditorId,
    assetsBaseUrl: options.assetsBaseUrl,
    sourceEditorMode: options.sourceEditorMode,
    onSave: async (nextHtml) => {
      editor.replaceSelection(normalizeHtml(nextHtml), "html-v-editor");
      editor.focus();
      new Notice("Selected HTML updated.");
    }
  }).open();
}

export function editHtmlBlockAtCursor(editor: Editor, options: HtmlBlockEditorCommandOptions): void {
  const range = findHtmlBlockAtCursor(editor);
  if (!range) {
    new Notice("No complete HTML block found at the cursor.");
    return;
  }

  new HtmlBlockEditModal(options.app, {
    title: `Edit <${range.tagName}> block`,
    initialHtml: range.html,
    defaultEditorId: options.defaultEditorId,
    assetsBaseUrl: options.assetsBaseUrl,
    sourceEditorMode: options.sourceEditorMode,
    onSave: async (nextHtml) => {
      const replacement = normalizeHtml(nextHtml);
      editor.replaceRange(replacement, range.from, range.to, "html-v-editor");
      const nextTo = editor.offsetToPos(editor.posToOffset(range.from) + replacement.length);
      editor.setSelection(range.from, nextTo);
      editor.focus();
      new Notice("HTML block updated.");
    }
  }).open();
}

function normalizeHtml(html: string): string {
  return html.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/g, "");
}
