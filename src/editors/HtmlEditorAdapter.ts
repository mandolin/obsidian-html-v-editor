import type { SourceEditorMode } from "../settings/settings";

export interface EditorOptions {
  assetsBaseUrl: string;
  documentBaseUrl?: string;
  isolateUiInFrame?: boolean;
  sourceEditorMode?: SourceEditorMode;
  onChange?: (html: string) => void;
}

export type HtmlEditorId = "hugerte" | "tiptap" | "prosemirror" | "source";

export interface HtmlEditorAdapter {
  readonly id: HtmlEditorId;
  readonly displayName: string;
  mount(container: HTMLElement, html: string, options: EditorOptions): Promise<void>;
  getHtml(): string;
  setHtml(html: string): void;
  focus(): void;
  destroy(): void;
}
