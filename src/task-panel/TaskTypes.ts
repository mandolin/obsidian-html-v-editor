export type HtmlVTaskSourceType = "html-file" | "html-v-block" | "markdown-task";

export interface HtmlVTask {
  id: string;
  path: string;
  sourceType: HtmlVTaskSourceType;
  checked: boolean;
  text: string;
  tags: string[];
  project?: string;
  sourceLabel: string;
  locator: TaskLocator;
}

export type TaskLocator = HtmlTaskLocator | MarkdownTaskLocator;

export interface HtmlTaskLocator {
  type: "html-file" | "html-v-block";
  path: string;
  taskId?: string;
  occurrence: number;
  blockIndex?: number;
}

export interface MarkdownTaskLocator {
  type: "markdown-task";
  path: string;
  line: number;
}

export interface TaskFilter {
  query: string;
  status: "all" | "open" | "done";
  checklistOnly: boolean;
  currentFileOnly: boolean;
  currentPath?: string;
  currentPaths?: string[];
}

export interface TaskIndexSnapshot {
  tasks: HtmlVTask[];
  isReady: boolean;
  isIndexing: boolean;
}
