import hugerte, { type Editor } from "hugerte";

const CHECKLIST_SELECTOR = "ul.tox-checklist,ul.htmlv-checklist";
const CHECKLIST_ITEM_SELECTOR = "li.tox-checklist-item,li.htmlv-checklist-item";
const CHECKBOX_CLICK_AREA = 40;

export const HUGERTE_CHECKLIST_CONTENT_STYLE = [
  "ul.tox-checklist{list-style:none;list-style-type:none;margin:0;padding-left:0;}",
  "ul.htmlv-checklist{list-style:none;list-style-type:none;margin:0;padding-left:0;}",
  "ul.tox-checklist li{list-style:none;list-style-type:none;}",
  "ul.htmlv-checklist li{list-style:none;list-style-type:none;}",
  "ul.tox-checklist .tox-checklist-item,ul.htmlv-checklist .htmlv-checklist-item{position:relative;display:flex;align-items:flex-start;gap:.5em;min-height:1.5em;margin:0;padding:.1em 0;list-style:none;}",
  "ul.tox-checklist .tox-checklist-item::before,ul.htmlv-checklist .htmlv-checklist-item::before{content:'';display:inline-block;flex:0 0 auto;width:1em;height:1em;margin-top:.2em;border:1px solid #4c4c4c;border-radius:2px;background:#fff;box-sizing:border-box;cursor:pointer;}",
  "ul.tox-checklist .tox-checklist-item[data-checked='true']::before,ul.htmlv-checklist .htmlv-checklist-item[data-checked='true']::before{border-color:#4099ff;background:#4099ff;box-shadow:inset 0 0 0 2px #4099ff;}",
  "ul.tox-checklist .tox-checklist-item[data-checked='true']::after,ul.htmlv-checklist .htmlv-checklist-item[data-checked='true']::after{content:'';position:absolute;left:.22em;top:.42em;width:.55em;height:.28em;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg);pointer-events:none;}",
  "ul.tox-checklist .tox-checklist-item[data-checked='true'],ul.htmlv-checklist .htmlv-checklist-item[data-checked='true']{text-decoration:line-through;color:var(--text-muted,#666);}"
].join(" ");

let checklistIdCounter = 0;
let isChecklistPluginRegistered = false;

export function registerHugeRteChecklistPlugin(): void {
  if (isChecklistPluginRegistered) {
    return;
  }

  isChecklistPluginRegistered = true;

  hugerte.PluginManager.add("checklist", (editor: Editor) => {
    editor.on("init", () => {
      const doc = editor.getDoc();
      if (!doc?.head) {
        return;
      }

      const style = doc.createElement("style");
      style.textContent = HUGERTE_CHECKLIST_CONTENT_STYLE;
      doc.head.appendChild(style);
    });

    editor.addCommand("toggleChecklist", () => {
      const list = editor.dom.getParent(editor.selection.getNode(), "ul,ol");
      if (list?.classList.contains("tox-checklist")) {
        exitChecklist(editor);
        return;
      }

      createChecklist(editor, list);
    });

    editor.addCommand("toggleChecklistItem", () => {
      const item = getChecklistItem(editor);
      if (item) {
        toggleChecklistItem(editor, item);
      }
    });

    editor.ui.registry.addButton("checklist", {
      icon: "checklist",
      tooltip: "Checklist",
      onAction: () => editor.execCommand("toggleChecklist")
    });

    editor.ui.registry.addMenuItem("checklist", {
      icon: "checklist",
      text: "Checklist",
      onAction: () => editor.execCommand("toggleChecklist")
    });

    editor.on("KeyDown", (event) => {
      const item = getChecklistItem(editor);
      if (!item) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        toggleChecklistItem(editor, item);
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (isEmptyChecklistItem(item)) {
          exitChecklistAndCreateParagraph(editor, item);
        } else {
          const nextItem = createChecklistItem(editor);
          item.parentNode?.insertBefore(nextItem, item.nextSibling);
          setCursorAtStart(editor, nextItem);
          markChecklistChanged(editor);
        }
        return;
      }

      if (event.key === "Backspace" && isEmptyChecklistItem(item) && isCaretAtStart(editor)) {
        event.preventDefault();
        exitChecklist(editor);
        return;
      }

      if (event.key === " " && isCaretAtStart(editor)) {
        event.preventDefault();
        toggleChecklistItem(editor, item);
      }
    });

    editor.on("mousedown", (event) => {
      const item = editor.dom.getParent(event.target as Node, CHECKLIST_ITEM_SELECTOR) as HTMLLIElement | null;
      if (!item || !editor.dom.getParent(item, CHECKLIST_SELECTOR)) {
        return;
      }

      const rect = item.getBoundingClientRect();
      if (event.clientX - rect.left < CHECKBOX_CLICK_AREA) {
        event.preventDefault();
        event.stopPropagation();
        toggleChecklistItem(editor, item);
      }
    });
  });
}

function createChecklist(editor: Editor, list: Element | null): void {
  if (list) {
    convertListToChecklist(editor, list);
    markChecklistChanged(editor);
    return;
  }

  const selectedBlocks = getSelectedContentBlocks(editor);
  if (selectedBlocks.length > 0) {
    convertBlocksToChecklist(editor, selectedBlocks);
    return;
  }

  const currentBlock = getCurrentContentBlock(editor);
  if (currentBlock) {
    convertBlocksToChecklist(editor, [currentBlock]);
    return;
  }

  insertEmptyChecklist(editor);
}

function insertEmptyChecklist(editor: Editor): void {
  const currentNode = editor.selection.getNode();
  const ul = createChecklistElement(editor);
  const item = createChecklistItem(editor);
  ul.appendChild(item);

  const cell = editor.dom.getParent(currentNode, "td,th");
  if (cell) {
    cell.appendChild(ul);
  } else {
    currentNode.parentNode?.insertBefore(ul, currentNode.nextSibling);
  }

  setCursorAtStart(editor, item);
  markChecklistChanged(editor);
}

function convertBlocksToChecklist(editor: Editor, blocks: Element[]): void {
  const normalizedBlocks = blocks.filter((block) => block.parentNode && !isChecklistElement(block));
  if (normalizedBlocks.length === 0) {
    return;
  }

  const tableCells = normalizedBlocks.filter(isTableCellElement);
  const regularBlocks = normalizedBlocks.filter((block) => !isTableCellElement(block));
  let firstChecklistItem: Node | null = null;

  for (const cell of tableCells) {
    const item = convertTableCellToChecklist(editor, cell);
    firstChecklistItem ??= item;
  }

  for (const blockGroup of groupBlocksByParent(regularBlocks)) {
    const item = convertSiblingBlocksToChecklist(editor, blockGroup);
    firstChecklistItem ??= item;
  }

  if (firstChecklistItem) {
    setCursorAtStart(editor, firstChecklistItem);
    markChecklistChanged(editor);
  }
}

function convertSiblingBlocksToChecklist(editor: Editor, blocks: Element[]): Node | null {
  const firstBlock = blocks[0];
  const parent = firstBlock?.parentNode;
  if (!firstBlock || !parent) {
    return null;
  }

  const ul = createChecklistElement(editor);

  for (const block of blocks) {
    ul.appendChild(createChecklistItemFromElement(editor, block));
  }
  parent.insertBefore(ul, firstBlock);
  blocks.forEach((block) => block.remove());

  return ul.firstChild ?? ul;
}

function convertTableCellToChecklist(editor: Editor, cell: Element): Node | null {
  const ul = createChecklistElement(editor);
  ul.appendChild(createChecklistItemFromElement(editor, cell));
  cell.appendChild(ul);
  return ul.firstChild ?? ul;
}

function createChecklistElement(editor: Editor): HTMLUListElement {
  return editor.dom.create("ul", {
    class: "tox-checklist htmlv-checklist",
    id: generateChecklistId()
  }) as HTMLUListElement;
}

function groupBlocksByParent(blocks: Element[]): Element[][] {
  const groups: Element[][] = [];
  let currentParent: ParentNode | null = null;
  let currentGroup: Element[] = [];

  for (const block of blocks) {
    if (block.parentNode !== currentParent) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentParent = block.parentNode;
      currentGroup = [];
    }

    currentGroup.push(block);
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function convertListToChecklist(editor: Editor, list: Element): void {
  list.classList.add("tox-checklist", "htmlv-checklist");
  if (!list.id) {
    list.id = generateChecklistId();
  }

  editor.dom.select("li", list).forEach((item) => {
    item.classList.add("tox-checklist-item", "htmlv-checklist-item");
    if (!item.hasAttribute("data-checked")) {
      setChecklistItemChecked(item, false);
    }
    ensureChecklistItemId(item);
  });
}

function getSelectedContentBlocks(editor: Editor): Element[] {
  if (editor.selection.isCollapsed()) {
    return [];
  }

  return editor.selection.getSelectedBlocks()
    .filter((block) => isConvertibleContentBlock(editor, block));
}

function getCurrentContentBlock(editor: Editor): Element | null {
  const currentNode = editor.selection.getNode();
  const block = editor.dom.getParent(currentNode, editor.dom.isBlock);
  return block && isConvertibleContentBlock(editor, block) ? block : null;
}

function isConvertibleContentBlock(editor: Editor, block: Element): boolean {
  if (block === editor.getBody() || isChecklistElement(block)) {
    return false;
  }

  if (isTableStructuralElement(block) && !isTableCellElement(block)) {
    return false;
  }

  return Boolean(block.textContent?.trim() || block.querySelector("img,table,hr,iframe,video,audio"));
}

function isChecklistElement(element: Element): boolean {
  return element.matches(CHECKLIST_SELECTOR) || Boolean(element.closest(CHECKLIST_SELECTOR));
}

function isTableCellElement(element: Element): boolean {
  return element.matches("td,th");
}

function isTableStructuralElement(element: Element): boolean {
  return element.matches("table,thead,tbody,tfoot,tr,td,th");
}

function createChecklistItem(editor: Editor, checked = false): HTMLLIElement {
  const item = editor.getDoc().createElement("li");
  item.className = "tox-checklist-item htmlv-checklist-item";
  setChecklistItemChecked(item, checked);
  ensureChecklistItemId(item);
  item.appendChild(editor.dom.create("br", { "data-mce-bogus": "1" }));
  return item;
}

function createChecklistItemFromElement(editor: Editor, element: Element): HTMLLIElement {
  const item = createChecklistItem(editor);
  while (item.firstChild) {
    item.firstChild.remove();
  }

  while (element.firstChild) {
    item.appendChild(element.firstChild);
  }

  return item;
}

function getChecklistItem(editor: Editor, node?: Node | null): HTMLLIElement | null {
  const item = editor.dom.getParent(node ?? editor.selection.getNode(), "li");
  if (!item || !editor.dom.getParent(item, CHECKLIST_SELECTOR)) {
    return null;
  }
  return item as HTMLLIElement;
}

function toggleChecklistItem(editor: Editor, item: HTMLLIElement): void {
  setChecklistItemChecked(item, item.getAttribute("data-checked") !== "true");
  markChecklistChanged(editor);
}

function setChecklistItemChecked(item: Element, checked: boolean): void {
  item.setAttribute("data-checked", checked ? "true" : "false");
  item.classList.toggle("tox-checklist--checked", checked);
}

function ensureChecklistItemId(item: Element): void {
  if (!item.hasAttribute("data-htmlv-task-id")) {
    item.setAttribute("data-htmlv-task-id", generateTaskId());
  }
}

function exitChecklist(editor: Editor): void {
  const item = getChecklistItem(editor);
  const list = item ? editor.dom.getParent(item, CHECKLIST_SELECTOR) : null;
  if (!list) {
    return;
  }

  editor.dom.select("li", list).forEach((li) => {
    li.classList.remove("tox-checklist-item", "htmlv-checklist-item", "tox-checklist--checked");
    li.removeAttribute("data-checked");
    li.removeAttribute("data-htmlv-task-id");
  });
  list.classList.remove("tox-checklist", "htmlv-checklist");
  markChecklistChanged(editor);
}

function exitChecklistAndCreateParagraph(editor: Editor, item: HTMLLIElement): void {
  const list = editor.dom.getParent(item, CHECKLIST_SELECTOR);
  if (!list) {
    return;
  }

  const parent = list.parentNode;
  const allItems = Array.from(list.querySelectorAll(CHECKLIST_ITEM_SELECTOR));
  const itemsAfter = allItems.slice(allItems.indexOf(item) + 1);
  item.remove();

  if (itemsAfter.length > 0) {
    const nextList = editor.dom.create("ul", {
      class: "tox-checklist htmlv-checklist",
      id: generateChecklistId()
    });
    itemsAfter.forEach((nextItem) => nextList.appendChild(nextItem));
    list.parentNode?.insertBefore(nextList, list.nextSibling);
  }

  const anchor = list.querySelector("li") ? list : null;
  if (!anchor) {
    list.remove();
  }

  const paragraph = editor.dom.create("p");
  paragraph.appendChild(editor.dom.create("br", { "data-mce-bogus": "1" }));
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(paragraph, anchor.nextSibling);
  } else {
    parent?.appendChild(paragraph);
  }

  setCursorAtStart(editor, paragraph);
  markChecklistChanged(editor);
}

function setCursorAtStart(editor: Editor, element: Node): void {
  const range = editor.dom.createRng();
  range.setStart(element, 0);
  range.collapse(true);
  editor.selection.setRng(range);
  editor.focus();
}

function isEmptyChecklistItem(item: HTMLLIElement): boolean {
  return !item.textContent?.trim();
}

function isCaretAtStart(editor: Editor): boolean {
  const range = editor.selection.getRng();
  return range.startOffset === 0;
}

function markChecklistChanged(editor: Editor): void {
  editor.setDirty(true);
  editor.dispatch("Change");
}

function generateChecklistId(): string {
  checklistIdCounter += 1;
  return `tox-checklist-${checklistIdCounter}`;
}

function generateTaskId(): string {
  return `htmlv-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
