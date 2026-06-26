import hugerte, { type Editor } from "hugerte";
import "hugerte/icons/default";
import "hugerte/models/dom";
import "hugerte/plugins/advlist";
import "hugerte/plugins/autolink";
import "hugerte/plugins/charmap";
import "hugerte/plugins/code";
import "hugerte/plugins/fullscreen";
import "hugerte/plugins/image";
import "hugerte/plugins/link";
import "hugerte/plugins/lists";
import "hugerte/plugins/media";
import "hugerte/plugins/table";
import "hugerte/themes/silver";

import type { EditorOptions, HtmlEditorAdapter } from "./HtmlEditorAdapter";
import { HUGERTE_CHECKLIST_CONTENT_STYLE, registerHugeRteChecklistPlugin } from "./HugeRteChecklistPlugin";
import { stopObsidianContextMenuBubble } from "./editorDom";

const HUGERTE_CONTENT_STYLE = [
  "body{font-family:var(--font-text,Arial,sans-serif);font-size:16px;line-height:1.5;margin:12px;}",
  "table{border-collapse:collapse;}",
  "td,th{border:1px solid #999;padding:4px 8px;}",
  "th{font-weight:700;}",
  "td[data-mce-selected],th[data-mce-selected]{position:relative;background:rgba(76,141,255,.22)!important;outline:2px solid #4c8dff;outline-offset:-2px;}",
  "td[data-mce-selected]::after,th[data-mce-selected]::after{content:'';position:absolute;inset:-1px;border:1px solid rgba(76,141,255,.7);pointer-events:none;}",
  ".ephox-snooker-resizer-bar{background-color:#4c8dff;opacity:0;-webkit-user-select:none;-moz-user-select:none;user-select:none;}",
  ".ephox-snooker-resizer-cols{cursor:col-resize!important;}",
  ".ephox-snooker-resizer-rows{cursor:row-resize!important;}",
  ".ephox-snooker-resizer-bar.ephox-snooker-resizer-bar-dragging{opacity:.85!important;}",
  "body.html-v-table-resizing-cols,body.html-v-table-resizing-cols *{cursor:col-resize!important;}",
  "body.html-v-table-resizing-rows,body.html-v-table-resizing-rows *{cursor:row-resize!important;}",
  HUGERTE_CHECKLIST_CONTENT_STYLE
].join(" ");

const HUGERTE_AUXILIARY_UI_SELECTOR = [
  ".tox-hugerte-aux",
  ".tox-tinymce-aux",
  ".tox-silver-sink",
  ".tox-dialog-wrap",
  ".tox-pop",
  ".tox-menu",
  ".tox-tooltip"
].join(",");

const HUGERTE_FONT_SIZE_FORMATS = [
  "8pt",
  "9pt",
  "10pt",
  "11pt",
  "12pt",
  "14pt",
  "15pt",
  "16pt",
  "18pt",
  "20pt",
  "24pt",
  "28pt",
  "32pt",
  "36pt"
].join(" ");

const HUGERTE_FONT_FAMILY_FORMATS = [
  "Arial=arial,helvetica,sans-serif",
  "Courier New='courier new',courier,monospace",
  "Georgia=georgia,palatino,serif",
  "Times New Roman='times new roman',times,serif",
  "Verdana=verdana,geneva,sans-serif",
  "等距更纱黑体 SC='Sarasa Mono SC','等距更纱黑体 SC',monospace",
  "等距更纱黑体 Slab SC='Sarasa Mono Slab SC','等距更纱黑体 Slab SC',monospace",
  "宋体=SimSun,'宋体',serif",
  "新宋体=NSimSun,'新宋体',serif",
  "楷体=KaiTi,'楷体',serif",
  "黑体=SimHei,'黑体',sans-serif",
  "仿宋=FangSong,'仿宋',serif",
  "隶书=LiSu,'隶书',serif",
  "幼圆=YouYuan,'幼圆',sans-serif",
  "微软雅黑='Microsoft YaHei','微软雅黑',sans-serif",
  "霞鹜文楷等宽='LXGW WenKai Mono','霞鹜文楷等宽',monospace"
].join("; ");

const activeHugeRteEditors = new Set<Editor>();

export class HugeRteAdapter implements HtmlEditorAdapter {
  readonly id = "hugerte";
  readonly displayName = "HugeRTE";

  private editor: Editor | null = null;
  private target: HTMLTextAreaElement | null = null;
  private frame: HTMLIFrameElement | null = null;
  private isIsolatedFrame = false;

  async mount(container: HTMLElement, html: string, options: EditorOptions): Promise<void> {
    this.destroy();

    container.empty();
    stopObsidianContextMenuBubble(container);
    this.isIsolatedFrame = Boolean(options.isolateUiInFrame);
    const targetHost = options.isolateUiInFrame
      ? this.createIsolatedFrame(container)
      : container;
    this.target = targetHost.ownerDocument.createElement("textarea");
    this.target.className = "html-v-editor-hugerte-target";
    targetHost.appendChild(this.target);
    this.target.value = html;
    registerHugeRteChecklistPlugin();

    const editors = await hugerte.init({
      target: this.target,
      base_url: options.assetsBaseUrl,
      suffix: ".min",
      promotion: false,
      branding: false,
      menubar: false,
      statusbar: true,
      resize: false,
      height: "100%",
      convert_urls: false,
      document_base_url: options.documentBaseUrl,
      skin: options.isolateUiInFrame ? "oxide" : false,
      content_css: options.isolateUiInFrame ? "default" : false,
      object_resizing: "table",
      table_grid: true,
      table_resize_bars: true,
      mobile: {
        table_grid: true,
        object_resizing: "table",
        resize: false
      },
      content_style: HUGERTE_CONTENT_STYLE,
      custom_ui_selector: HUGERTE_AUXILIARY_UI_SELECTOR,
      contextmenu: "link image table",
      font_size_formats: HUGERTE_FONT_SIZE_FORMATS,
      font_family_formats: HUGERTE_FONT_FAMILY_FORMATS,
      charmap: options.characterMap,
      plugins: [
        "advlist autolink lists link image media table code fullscreen checklist",
        options.characterMap ? "charmap" : ""
      ].filter(Boolean).join(" "),
      toolbar: [
        "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist checklist outdent indent | link image media table",
        options.characterMap ? "charmap" : "",
        "| removeformat code fullscreen"
      ].filter(Boolean).join(" "),
      setup: (editor) => {
        const emitChange = () => {
          options.onChange?.(editor.getContent());
        };
        editor.on("Change Input Undo Redo", emitChange);
        editor.on("init", () => {
          stopObsidianContextMenuBubble(editor.getDoc());
          installTableResizeCursor(editor);
          installTableDragSelection(editor);
        });
      }
    });

    this.editor = editors[0] ?? null;
    if (this.editor) {
      activeHugeRteEditors.add(this.editor);
    }
  }

  getHtml(): string {
    return this.editor?.getContent() ?? this.target?.value ?? "";
  }

  setHtml(html: string): void {
    if (this.editor) {
      this.editor.setContent(html);
    } else if (this.target) {
      this.target.value = html;
    }
  }

  focus(): void {
    this.editor?.focus();
    this.target?.focus();
  }

  destroy(): void {
    const wasIsolatedFrame = this.isIsolatedFrame;
    this.isIsolatedFrame = false;

    if (this.editor) {
      const editor = this.editor;
      this.editor = null;
      activeHugeRteEditors.delete(editor);
      try {
        editor.remove();
      } catch (error) {
        console.warn("Failed to remove HugeRTE editor cleanly", error);
        try {
          editor.destroy(false);
        } catch (destroyError) {
          console.warn("Failed to destroy HugeRTE editor cleanly", destroyError);
        }
      }
      if (!wasIsolatedFrame && activeHugeRteEditors.size === 0) {
        cleanupHugeRteAuxiliaryUi({ preserveOpenModal: true });
      }
    }
    this.frame?.remove();
    this.frame = null;
    this.target = null;
  }

  private createIsolatedFrame(container: HTMLElement): HTMLElement {
    const frame = container.ownerDocument.createElement("iframe");
    frame.className = "html-v-editor-hugerte-frame";
    frame.setAttribute("title", "HugeRTE editor");
    container.appendChild(frame);
    this.frame = frame;

    const doc = frame.contentDocument;
    if (!doc) {
      throw new Error("Unable to create isolated HugeRTE frame.");
    }

    doc.open();
    doc.write([
      "<!doctype html>",
      "<html>",
      "<head>",
      "<meta charset=\"utf-8\">",
      "<style>",
      "html,body,#html-v-hugerte-frame-host{height:100%;margin:0;overflow:hidden;background:#fff;}",
      "body{font-family:Arial,sans-serif;}",
      "#html-v-hugerte-frame-host{display:flex;flex-direction:column;}",
      "</style>",
      "</head>",
      "<body>",
      "<div id=\"html-v-hugerte-frame-host\"></div>",
      "</body>",
      "</html>"
    ].join(""));
    doc.close();

    const host = doc.getElementById("html-v-hugerte-frame-host");
    if (!host) {
      throw new Error("Unable to initialize isolated HugeRTE frame.");
    }

    return host;
  }
}

interface CleanupHugeRteAuxiliaryUiOptions {
  preserveOpenModal?: boolean;
  onlyWhenNoActiveEditors?: boolean;
}

export function cleanupHugeRteAuxiliaryUi(options: CleanupHugeRteAuxiliaryUiOptions = {}): void {
  if (options.onlyWhenNoActiveEditors && activeHugeRteEditors.size > 0) {
    return;
  }

  if (options.preserveOpenModal && document.querySelector(".html-v-block-edit-modal-container")) {
    return;
  }

  document.querySelectorAll<HTMLElement>([
    ".tox-hugerte-aux",
    ".tox-tinymce-aux",
    ".tox-silver-sink",
    ".tox-dialog-wrap",
    ".tox-pop",
    ".tox-menu",
    ".tox-tooltip"
  ].join(",")).forEach((el) => el.remove());
}

function installTableResizeCursor(editor: Editor): void {
  const doc = editor.getDoc();
  const win = editor.getWin();
  const body = doc.body;

  const clear = () => {
    body?.classList.remove("html-v-table-resizing-cols");
    body?.classList.remove("html-v-table-resizing-rows");
  };

  const onMouseDown = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest(".ephox-snooker-resizer-cols")) {
      body?.classList.add("html-v-table-resizing-cols");
      body?.classList.remove("html-v-table-resizing-rows");
    } else if (target.closest(".ephox-snooker-resizer-rows")) {
      body?.classList.add("html-v-table-resizing-rows");
      body?.classList.remove("html-v-table-resizing-cols");
    }
  };

  doc.addEventListener("mousedown", onMouseDown, true);
  doc.addEventListener("mouseup", clear, true);
  win.addEventListener("mouseup", clear, true);
  win.addEventListener("blur", clear);
  editor.on("remove", () => {
    clear();
    doc.removeEventListener("mousedown", onMouseDown, true);
    doc.removeEventListener("mouseup", clear, true);
    win.removeEventListener("mouseup", clear, true);
    win.removeEventListener("blur", clear);
  });
}

function installTableDragSelection(editor: Editor): void {
  const doc = editor.getDoc();
  let startCell: HTMLTableCellElement | null = null;
  let selecting = false;

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || isHugeRteNativeDragTarget(event.target)) {
      return;
    }

    startCell = getTableCell(event.target);
    selecting = false;
  };

  const onMouseOver = (event: MouseEvent) => {
    if (!startCell || (event.buttons & 1) !== 1 || isHugeRteNativeDragTarget(event.target)) {
      return;
    }

    const endCell = getTableCell(event.target);
    if (!endCell || endCell === startCell || endCell.closest("table") !== startCell.closest("table")) {
      return;
    }

    selecting = true;
    selectCellRange(doc, startCell, endCell);
  };

  const onMouseUp = (event: MouseEvent) => {
    if (selecting) {
      selectCellRange(doc, startCell, getTableCell(event.target) ?? startCell);
      editor.nodeChanged();
    }

    startCell = null;
    selecting = false;
  };

  doc.addEventListener("mousedown", onMouseDown);
  doc.addEventListener("mouseover", onMouseOver);
  doc.addEventListener("mouseup", onMouseUp);
  editor.on("remove", () => {
    doc.removeEventListener("mousedown", onMouseDown);
    doc.removeEventListener("mouseover", onMouseOver);
    doc.removeEventListener("mouseup", onMouseUp);
  });
}

function isHugeRteNativeDragTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") {
    return false;
  }

  return Boolean((target as Element).closest([
    ".ephox-snooker-resizer-bar",
    ".ephox-snooker-resizer-bar-dragging",
    ".mce-resizehandle",
    ".mce-resize-backdrop",
    ".mce-clonedresizable",
    ".mce-resize-helper",
    "[data-mce-bogus='all']"
  ].join(",")));
}

function getTableCell(target: EventTarget | null): HTMLTableCellElement | null {
  if (!target || typeof (target as Element).closest !== "function") {
    return null;
  }

  const cell = (target as Element).closest("td,th");
  return cell?.tagName === "TD" || cell?.tagName === "TH" ? cell as HTMLTableCellElement : null;
}

function selectCellRange(doc: Document, startCell: HTMLTableCellElement | null, endCell: HTMLTableCellElement | null): void {
  if (!startCell || !endCell) {
    return;
  }

  const table = startCell.closest("table");
  if (!table || table !== endCell.closest("table")) {
    return;
  }

  clearSelectedCells(doc);

  const rows = Array.from(table.querySelectorAll("tr"));
  const startRow = rows.indexOf(startCell.parentElement as HTMLTableRowElement);
  const endRow = rows.indexOf(endCell.parentElement as HTMLTableRowElement);
  if (startRow < 0 || endRow < 0) {
    return;
  }

  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCell = Math.min(startCell.cellIndex, endCell.cellIndex);
  const maxCell = Math.max(startCell.cellIndex, endCell.cellIndex);

  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
    const row = rows[rowIndex];
    for (const cell of Array.from(row?.cells ?? [])) {
      if (cell.cellIndex >= minCell && cell.cellIndex <= maxCell) {
        cell.setAttribute("data-mce-selected", "1");
      }
    }
  }
}

function clearSelectedCells(doc: Document): void {
  for (const cell of Array.from(doc.querySelectorAll("td[data-mce-selected],th[data-mce-selected]"))) {
    cell.removeAttribute("data-mce-selected");
  }
}
