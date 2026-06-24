import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { DOMParser as ProseMirrorDOMParser, DOMSerializer, Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes, wrapInList } from "prosemirror-schema-list";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { addColumnAfter, addRowAfter, deleteColumn, deleteRow, deleteTable, tableEditing, tableNodes } from "prosemirror-tables";
import "prosemirror-view/style/prosemirror.css";

import type { EditorOptions, HtmlEditorAdapter } from "./HtmlEditorAdapter";
import { protectObsidianButton, stopObsidianContextMenu } from "./editorDom";

const schema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block").append(tableNodes({
    tableGroup: "block",
    cellContent: "block+",
    cellAttributes: {}
  })),
  marks: basicSchema.spec.marks
});

export class ProseMirrorAdapter implements HtmlEditorAdapter {
  readonly id = "prosemirror";
  readonly displayName = "ProseMirror";

  private view: EditorView | null = null;
  private toolbarEl: HTMLElement | null = null;
  private hostEl: HTMLElement | null = null;

  async mount(container: HTMLElement, html: string, options: EditorOptions): Promise<void> {
    this.destroy();
    container.empty();

    this.toolbarEl = container.createDiv({ cls: "html-v-editor-adapter-toolbar" });
    this.hostEl = container.createDiv({ cls: "html-v-editor-prosemirror" });
    stopObsidianContextMenu(container);
    this.view = new EditorView(this.hostEl, {
      state: EditorState.create({
        doc: parseHtmlToDoc(html),
        plugins: [
          history(),
          keymap({
            "Mod-z": undo,
            "Mod-y": redo,
            "Mod-b": toggleMark(schema.marks.strong),
            "Mod-i": toggleMark(schema.marks.em)
          }),
          tableEditing(),
          keymap(baseKeymap)
        ]
      }),
      dispatchTransaction: (transaction) => {
        if (!this.view) {
          return;
        }

        const state = this.view.state.apply(transaction);
        this.view.updateState(state);
        if (transaction.docChanged) {
          options.onChange?.(this.getHtml());
        }
      }
    });
    this.renderToolbar();
  }

  getHtml(): string {
    if (!this.view) {
      return "";
    }

    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(this.view.state.doc.content);
    const container = document.createElement("div");
    container.appendChild(fragment);
    return container.innerHTML;
  }

  setHtml(html: string): void {
    if (!this.view) {
      return;
    }

    this.view.updateState(EditorState.create({
      doc: parseHtmlToDoc(html),
      plugins: this.view.state.plugins
    }));
  }

  focus(): void {
    this.view?.focus();
  }

  destroy(): void {
    this.view?.destroy();
    this.view = null;
    this.hostEl?.remove();
    this.hostEl = null;
    this.toolbarEl?.remove();
    this.toolbarEl = null;
  }

  private renderToolbar(): void {
    if (!this.toolbarEl) {
      return;
    }

    const buttons: Array<{ label: string; title: string; action: () => void }> = [
      { label: "B", title: "Bold", action: () => this.runCommand(toggleMark(schema.marks.strong)) },
      { label: "I", title: "Italic", action: () => this.runCommand(toggleMark(schema.marks.em)) },
      { label: "UL", title: "Bullet list", action: () => this.runCommand(wrapInList(schema.nodes.bullet_list)) },
      { label: "OL", title: "Ordered list", action: () => this.runCommand(wrapInList(schema.nodes.ordered_list)) },
      { label: "+Row", title: "Add row after", action: () => this.runCommand(addRowAfter) },
      { label: "-Row", title: "Delete row", action: () => this.runCommand(deleteRow) },
      { label: "+Col", title: "Add column after", action: () => this.runCommand(addColumnAfter) },
      { label: "-Col", title: "Delete column", action: () => this.runCommand(deleteColumn) },
      { label: "DelTbl", title: "Delete table", action: () => this.runCommand(deleteTable) },
      { label: "Undo", title: "Undo", action: () => this.runCommand(undo) },
      { label: "Redo", title: "Redo", action: () => this.runCommand(redo) }
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

  private runCommand(command: Parameters<typeof keymap>[0][string]): void {
    if (!this.view) {
      return;
    }

    command(this.view.state, this.view.dispatch, this.view);
    this.view.focus();
  }
}

function parseHtmlToDoc(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html || "<p></p>";
  return ProseMirrorDOMParser.fromSchema(schema).parse(container);
}
