import { HugeRteAdapter } from "./HugeRteAdapter";
import type { HtmlEditorAdapter, HtmlEditorId } from "./HtmlEditorAdapter";
import { ProseMirrorAdapter } from "./ProseMirrorAdapter";
import { SourceEditorAdapter } from "./SourceEditorAdapter";
import { TipTapAdapter } from "./TipTapAdapter";

export interface HtmlEditorDefinition {
  id: HtmlEditorId;
  displayName: string;
}

export const HTML_RICH_EDITOR_DEFINITIONS: HtmlEditorDefinition[] = [
  {
    id: "hugerte",
    displayName: "HugeRTE"
  },
  {
    id: "tiptap",
    displayName: "TipTap"
  },
  {
    id: "prosemirror",
    displayName: "ProseMirror"
  }
];

export const HTML_ACTIVE_RICH_EDITOR_DEFINITIONS: HtmlEditorDefinition[] = [
  {
    id: "hugerte",
    displayName: "HugeRTE"
  }
];

export const HTML_EDITOR_DEFINITIONS: HtmlEditorDefinition[] = [
  ...HTML_RICH_EDITOR_DEFINITIONS,
  {
    id: "source",
    displayName: "Source"
  }
];

export function createHtmlEditorAdapter(id: HtmlEditorId): HtmlEditorAdapter {
  if (id === "tiptap") {
    return new TipTapAdapter();
  }

  if (id === "prosemirror") {
    return new ProseMirrorAdapter();
  }

  if (id === "source") {
    return new SourceEditorAdapter();
  }

  return new HugeRteAdapter();
}

export function isHtmlEditorId(value: string): value is HtmlEditorId {
  return HTML_EDITOR_DEFINITIONS.some((editor) => editor.id === value);
}

export function isRichHtmlEditorId(value: string): value is HtmlEditorId {
  return HTML_RICH_EDITOR_DEFINITIONS.some((editor) => editor.id === value);
}

export function getActiveRichEditorId(_value?: HtmlEditorId | null): HtmlEditorId {
  return "hugerte";
}
