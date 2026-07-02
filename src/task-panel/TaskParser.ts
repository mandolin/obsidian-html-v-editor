import type { HtmlVTask, HtmlVTaskSourceType } from "./TaskTypes";

interface HtmlTaskParseOptions {
  path: string;
  sourceType: Extract<HtmlVTaskSourceType, "html-file" | "html-v-block">;
  sourceLabel: string;
  blockIndex?: number;
}

const HTML_V_FENCE_REGEX = /(^|\n)(```+)(html-v[^\n]*)\n([\s\S]*?)\n\2[ \t]*(?=\n|$)/gi;
const MARKDOWN_TASK_REGEX = /^(\s*[-*+]\s+\[)( |x|X)(\]\s+)(.+)$/;
const TAG_REGEX = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;
const CHECKLIST_ITEM_SELECTOR = [
  "ul.htmlv-checklist li",
  "ul.tox-checklist li",
  "li.htmlv-checklist-item",
  "li.tox-checklist-item",
  "li[data-htmlv-task-id]"
].join(",");

export function parseHtmlTasks(html: string, options: HtmlTaskParseOptions): HtmlVTask[] {
  // 统一使用浏览器 DOM 解析 HTML，避免用字符串规则误伤嵌套标签和表格内 checklist。
  const doc = document.implementation.createHTMLDocument("HTML V Task Parser");
  doc.body.innerHTML = html;

  return Array.from(doc.body.querySelectorAll(CHECKLIST_ITEM_SELECTOR))
    // 同一 li 可能同时匹配 htmlv/tox 选择器，需要去重后再生成任务。
    .filter((item, index, items) => items.indexOf(item) === index)
    .map((item, occurrence) => {
      const text = normalizeTaskText(item.textContent ?? "");
      const taskId = item.getAttribute("data-htmlv-task-id") ?? undefined;
      return {
        id: buildTaskId(options.path, options.sourceType, taskId ?? String(occurrence), options.blockIndex),
        path: options.path,
        sourceType: options.sourceType,
        checked: item.getAttribute("data-checked") === "true",
        text,
        tags: extractTags(text),
        project: extractProject(text),
        sourceLabel: options.sourceLabel,
        locator: {
          type: options.sourceType,
          path: options.path,
          taskId,
          occurrence,
          blockIndex: options.blockIndex
        }
      };
    });
}

export function parseMarkdownTasks(markdown: string, path: string): HtmlVTask[] {
  const tasks: HtmlVTask[] = [];
  const lines = markdown.split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(MARKDOWN_TASK_REGEX);
    if (!match) {
      return;
    }

    const text = normalizeTaskText(match[4]);
    tasks.push({
      id: buildTaskId(path, "markdown-task", String(index)),
      path,
      sourceType: "markdown-task",
      checked: match[2].toLowerCase() === "x",
      text,
      tags: extractTags(text),
      project: extractProject(text),
      sourceLabel: "Markdown task",
      locator: {
        type: "markdown-task",
        path,
        line: index
      }
    });
  });

  return tasks;
}

export function parseHtmlVCodeBlockTasks(markdown: string, path: string): HtmlVTask[] {
  const tasks: HtmlVTask[] = [];
  let blockIndex = 0;

  for (const match of markdown.matchAll(HTML_V_FENCE_REGEX)) {
    tasks.push(...parseHtmlTasks(match[4], {
      path,
      sourceType: "html-v-block",
      sourceLabel: `html-v block ${blockIndex + 1}`,
      blockIndex
    }));
    blockIndex += 1;
  }

  return tasks;
}

export function replaceHtmlVCodeBlock(markdown: string, blockIndex: number, replacer: (html: string) => string): string {
  let currentBlockIndex = 0;
  return markdown.replace(HTML_V_FENCE_REGEX, (match, prefix: string, fence: string, openingInfo: string, html: string) => {
    if (currentBlockIndex !== blockIndex) {
      currentBlockIndex += 1;
      return match;
    }

    currentBlockIndex += 1;
    return `${prefix}${fence}${openingInfo}\n${replacer(html)}\n${fence}`;
  });
}

export function updateHtmlTaskChecked(html: string, taskId: string | undefined, occurrence: number, checked: boolean): string {
  // 优先按稳定 id 回写；旧数据没有 id 时再退回到 occurrence，保证兼容早期 checklist。
  const doc = document.implementation.createHTMLDocument("HTML V Task Writer");
  doc.body.innerHTML = html;
  const items = Array.from(doc.body.querySelectorAll(CHECKLIST_ITEM_SELECTOR))
    .filter((item, index, allItems) => allItems.indexOf(item) === index);
  const target = taskId
    ? items.find((item) => item.getAttribute("data-htmlv-task-id") === taskId)
    : items[occurrence];

  if (!target) {
    return html;
  }

  target.setAttribute("data-checked", checked ? "true" : "false");
  target.classList.toggle("tox-checklist--checked", checked);
  // 回写时补上 htmlv 类名，让后续索引逐步转向项目自己的结构标记。
  target.classList.add("htmlv-checklist-item");
  if (!target.hasAttribute("data-htmlv-task-id")) {
    target.setAttribute("data-htmlv-task-id", buildGeneratedHtmlTaskId());
  }

  const list = target.closest("ul");
  list?.classList.add("htmlv-checklist");

  return doc.body.innerHTML;
}

export function updateMarkdownTaskChecked(markdown: string, line: number, checked: boolean): string {
  const lineEnding = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.split(/\r?\n/);
  if (!lines[line]) {
    return markdown;
  }

  lines[line] = lines[line].replace(MARKDOWN_TASK_REGEX, (_match, prefix: string, _state: string, suffix: string, text: string) => {
    return `${prefix}${checked ? "x" : " "}${suffix}${text}`;
  });

  return lines.join(lineEnding);
}

function buildTaskId(path: string, sourceType: HtmlVTaskSourceType, uniquePart: string, blockIndex?: number): string {
  return [
    sourceType,
    path,
    blockIndex === undefined ? "" : String(blockIndex),
    uniquePart
  ].join("::");
}

function normalizeTaskText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractTags(text: string): string[] {
  const tags = new Set<string>();
  for (const match of text.matchAll(TAG_REGEX)) {
    tags.add(`#${match[2]}`);
  }
  return Array.from(tags);
}

function extractProject(text: string): string | undefined {
  return extractTags(text).find((tag) => tag.startsWith("#project/"))?.slice("#project/".length);
}

function buildGeneratedHtmlTaskId(): string {
  return `htmlv-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
