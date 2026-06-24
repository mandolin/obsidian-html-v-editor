import { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import StarterKit from "@tiptap/starter-kit";

import type { EditorOptions, HtmlEditorAdapter } from "./HtmlEditorAdapter";
import { protectObsidianButton, stopObsidianContextMenu } from "./editorDom";

export class TipTapAdapter implements HtmlEditorAdapter {
  readonly id = "tiptap";
  readonly displayName = "TipTap";

  private editor: Editor | null = null;
  private toolbarEl: HTMLElement | null = null;
  private hostEl: HTMLElement | null = null;

  async mount(container: HTMLElement, html: string, options: EditorOptions): Promise<void> {
    this.destroy();
    container.empty();

    this.toolbarEl = container.createDiv({ cls: "html-v-editor-adapter-toolbar" });
    this.hostEl = container.createDiv({ cls: "html-v-editor-tiptap" });
    stopObsidianContextMenu(container);
    this.editor = new Editor({
      element: this.hostEl,
      extensions: [
        StarterKit,
        Image,
        Table.configure({
          resizable: true
        }),
        TableRow,
        TableHeader,
        TableCell
      ],
      content: html,
      editorProps: {
        attributes: {
          class: "html-v-editor-tiptap-content"
        }
      },
      onUpdate: ({ editor }) => {
        options.onChange?.(editor.getHTML());
      }
    });
    this.renderToolbar();
  }

  getHtml(): string {
    return this.editor?.getHTML() ?? "";
  }

  setHtml(html: string): void {
    this.editor?.commands.setContent(html, {
      emitUpdate: false
    });
  }

  focus(): void {
    this.editor?.commands.focus();
  }

  destroy(): void {
    this.editor?.destroy();
    this.editor = null;
    this.hostEl?.remove();
    this.hostEl = null;
    this.toolbarEl?.remove();
    this.toolbarEl = null;
  }

  private renderToolbar(): void {
    if (!this.toolbarEl || !this.editor) {
      return;
    }

    const buttons: Array<{ label: string; title: string; action: () => void }> = [
      { label: "P", title: "Paragraph", action: () => this.editor?.chain().focus().setParagraph().run() },
      { label: "H1", title: "Heading 1", action: () => this.editor?.chain().focus().toggleHeading({ level: 1 }).run() },
      { label: "B", title: "Bold", action: () => this.editor?.chain().focus().toggleBold().run() },
      { label: "I", title: "Italic", action: () => this.editor?.chain().focus().toggleItalic().run() },
      { label: "U", title: "Underline", action: () => this.editor?.chain().focus().toggleUnderline().run() },
      { label: "S", title: "Strike", action: () => this.editor?.chain().focus().toggleStrike().run() },
      { label: "<>", title: "Code", action: () => this.editor?.chain().focus().toggleCode().run() },
      { label: "H2", title: "Heading 2", action: () => this.editor?.chain().focus().toggleHeading({ level: 2 }).run() },
      { label: "H3", title: "Heading 3", action: () => this.editor?.chain().focus().toggleHeading({ level: 3 }).run() },
      { label: "Quote", title: "Blockquote", action: () => this.editor?.chain().focus().toggleBlockquote().run() },
      { label: "UL", title: "Bullet list", action: () => this.editor?.chain().focus().toggleBulletList().run() },
      { label: "OL", title: "Ordered list", action: () => this.editor?.chain().focus().toggleOrderedList().run() },
      { label: "HR", title: "Horizontal rule", action: () => this.editor?.chain().focus().setHorizontalRule().run() },
      { label: "Table", title: "Insert table", action: () => this.editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { label: "+Row", title: "Add row after", action: () => this.editor?.chain().focus().addRowAfter().run() },
      { label: "-Row", title: "Delete row", action: () => this.editor?.chain().focus().deleteRow().run() },
      { label: "+Col", title: "Add column after", action: () => this.editor?.chain().focus().addColumnAfter().run() },
      { label: "-Col", title: "Delete column", action: () => this.editor?.chain().focus().deleteColumn().run() },
      { label: "DelTbl", title: "Delete table", action: () => this.editor?.chain().focus().deleteTable().run() },
      { label: "Undo", title: "Undo", action: () => this.editor?.chain().focus().undo().run() },
      { label: "Redo", title: "Redo", action: () => this.editor?.chain().focus().redo().run() }
    ];

    for (const item of buttons) {
      const button = this.toolbarEl.createEl("button", {
        cls: "html-v-editor-adapter-toolbar-button",
        text: item.label,
        attr: {
          title: item.title,
          type: "button"
        }
      });
      protectObsidianButton(button);
      button.addEventListener("click", item.action);
    }
  }
}
