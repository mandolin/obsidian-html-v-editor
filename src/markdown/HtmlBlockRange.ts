import type { Editor, EditorPosition, EditorRange } from "obsidian";

export interface HtmlBlockRange extends EditorRange {
  html: string;
  tagName: string;
}

const BLOCK_TAGS = new Set([
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "div",
  "figure",
  "footer",
  "form",
  "header",
  "main",
  "nav",
  "ol",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul"
]);

const OPEN_TAG_PATTERN = /<([a-z][\w:-]*)(?:\s[^<>]*)?>/gi;

export function findHtmlBlockAtCursor(editor: Editor): HtmlBlockRange | null {
  const cursor = editor.getCursor();
  const lines = getEditorLines(editor);
  const cursorOffset = positionToOffset(lines, cursor);

  for (const candidate of findOpenTagCandidates(lines, cursor.line)) {
    if (cursorOffset < candidate.openStart) {
      continue;
    }

    const close = findMatchingClose(lines.join("\n"), candidate.tagName, candidate.openEnd);
    if (!close || cursorOffset > close.closeEnd) {
      continue;
    }

    const from = offsetToPosition(lines, candidate.openStart);
    const to = offsetToPosition(lines, close.closeEnd);
    return {
      from,
      to,
      html: editor.getRange(from, to),
      tagName: candidate.tagName
    };
  }

  return null;
}

function getEditorLines(editor: Editor): string[] {
  const lines: string[] = [];
  for (let line = 0; line < editor.lineCount(); line += 1) {
    lines.push(editor.getLine(line));
  }
  return lines;
}

function findOpenTagCandidates(lines: string[], cursorLine: number): Array<{ tagName: string; openStart: number; openEnd: number }> {
  const candidates: Array<{ tagName: string; openStart: number; openEnd: number }> = [];
  const startLine = Math.max(0, cursorLine - 120);
  const textBeforeAndAtCursor = lines.slice(0, cursorLine + 1).join("\n");
  const offsetAtStartLine = positionToOffset(lines, { line: startLine, ch: 0 });
  const searchText = lines.slice(startLine, cursorLine + 1).join("\n");

  for (const match of searchText.matchAll(OPEN_TAG_PATTERN)) {
    const tagName = match[1]?.toLowerCase();
    if (!tagName || !BLOCK_TAGS.has(tagName)) {
      continue;
    }

    const raw = match[0];
    if (raw.endsWith("/>") || raw.startsWith("</")) {
      continue;
    }

    const openStart = offsetAtStartLine + (match.index ?? 0);
    const openEnd = openStart + raw.length;
    const before = textBeforeAndAtCursor.slice(openStart, openEnd);
    if (before.includes("```")) {
      continue;
    }

    candidates.unshift({ tagName, openStart, openEnd });
  }

  return candidates;
}

function findMatchingClose(text: string, tagName: string, fromOffset: number): { closeStart: number; closeEnd: number } | null {
  const tagPattern = new RegExp(`<(/?)${escapeRegExp(tagName)}(?:\\s[^<>]*)?>`, "gi");
  tagPattern.lastIndex = fromOffset;
  let depth = 1;

  for (const match of text.matchAll(tagPattern)) {
    const raw = match[0];
    const isClosing = match[1] === "/";
    const index = match.index ?? 0;

    if (!isClosing && !raw.endsWith("/>")) {
      depth += 1;
    } else if (isClosing) {
      depth -= 1;
      if (depth === 0) {
        return {
          closeStart: index,
          closeEnd: index + raw.length
        };
      }
    }
  }

  return null;
}

function positionToOffset(lines: string[], position: EditorPosition): number {
  let offset = 0;
  for (let line = 0; line < position.line; line += 1) {
    offset += lines[line]?.length ?? 0;
    offset += 1;
  }
  return offset + position.ch;
}

function offsetToPosition(lines: string[], offset: number): EditorPosition {
  let remaining = offset;
  for (let line = 0; line < lines.length; line += 1) {
    const length = lines[line]?.length ?? 0;
    if (remaining <= length) {
      return { line, ch: remaining };
    }
    remaining -= length + 1;
  }

  const lastLine = Math.max(0, lines.length - 1);
  return {
    line: lastLine,
    ch: lines[lastLine]?.length ?? 0
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
