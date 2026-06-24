import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";

import type { EditorOptions, HtmlEditorAdapter } from "./HtmlEditorAdapter";
import { stopObsidianContextMenu } from "./editorDom";

export class SourceEditorAdapter implements HtmlEditorAdapter {
  readonly id = "source";
  readonly displayName = "Source";

  private textarea: HTMLTextAreaElement | null = null;
  private editorView: EditorView | null = null;
  private html = "";

  async mount(container: HTMLElement, html: string, options: EditorOptions): Promise<void> {
    this.destroy();
    container.empty();
    this.html = html;

    if ((options.sourceEditorMode ?? "textarea") === "codemirror") {
      this.mountCodeMirror(container, html, options);
      return;
    }

    this.textarea = container.createEl("textarea", {
      cls: "html-v-editor-adapter-source"
    });
    stopObsidianContextMenu(this.textarea);
    this.textarea.value = html;
    this.textarea.addEventListener("input", () => {
      options.onChange?.(this.textarea?.value ?? "");
    });
  }

  getHtml(): string {
    if (this.editorView) {
      return this.editorView.state.doc.toString();
    }

    return this.textarea?.value ?? this.html;
  }

  setHtml(html: string): void {
    this.html = html;

    if (this.editorView) {
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: this.editorView.state.doc.length,
          insert: html
        }
      });
      return;
    }

    if (this.textarea) {
      this.textarea.value = html;
    }
  }

  focus(): void {
    this.editorView?.focus();
    this.textarea?.focus();
  }

  destroy(): void {
    this.editorView?.destroy();
    this.editorView = null;
    this.textarea?.remove();
    this.textarea = null;
  }

  private mountCodeMirror(container: HTMLElement, html: string, options: EditorOptions): void {
    const hostEl = container.createDiv({
      cls: "html-v-editor-adapter-codemirror"
    });
    stopObsidianContextMenu(hostEl);

    this.editorView = new EditorView({
      parent: hostEl,
      state: EditorState.create({
        doc: html,
        extensions: [
          lineNumbers(),
          htmlLanguage(),
          syntaxHighlighting(defaultHighlightStyle, {
            fallback: true
          }),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.html = update.state.doc.toString();
              options.onChange?.(this.html);
            }
          }),
          EditorView.theme({
            "&": {
              height: "100%"
            },
            ".cm-scroller": {
              fontFamily: "var(--font-monospace)",
              fontSize: "var(--font-text-size)",
              lineHeight: "1.5"
            },
            ".cm-content": {
              minHeight: "100%",
              padding: "12px"
            },
            ".cm-gutters": {
              backgroundColor: "var(--background-secondary)",
              borderRight: "1px solid var(--background-modifier-border)",
              color: "var(--text-muted)"
            }
          })
        ]
      })
    });
  }
}
