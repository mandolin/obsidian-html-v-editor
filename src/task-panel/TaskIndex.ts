import { Events, TFile, type App, type EventRef } from "obsidian";

import { HTML_FILE_EXTENSIONS } from "../constants";
import { parseHtmlTasks, parseHtmlVCodeBlockTasks, parseMarkdownTasks } from "./TaskParser";
import type { HtmlVTask, TaskFilter, TaskIndexSnapshot } from "./TaskTypes";

export class TaskIndex extends Events {
  private tasksByPath = new Map<string, HtmlVTask[]>();
  private eventRefs: EventRef[] = [];
  private reindexTimers = new Map<string, number>();
  private isReady = false;
  private isIndexing = false;

  constructor(private readonly app: App) {
    super();
  }

  start(): void {
    this.eventRefs.push(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && isTaskSourceFile(file)) {
          this.scheduleReindex(file);
        }
      }),
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && isTaskSourceFile(file)) {
          this.scheduleReindex(file);
        }
      }),
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.tasksByPath.delete(file.path);
          this.trigger("changed");
        }
      }),
      this.app.vault.on("rename", (file, oldPath) => {
        this.tasksByPath.delete(oldPath);
        if (file instanceof TFile && isTaskSourceFile(file)) {
          this.scheduleReindex(file, 0);
        } else {
          this.trigger("changed");
        }
      })
    );

    window.setTimeout(() => {
      void this.rebuildAll();
    }, 500);
  }

  stop(): void {
    this.eventRefs.forEach((ref) => this.app.vault.offref(ref));
    this.eventRefs = [];
    this.reindexTimers.forEach((timer) => window.clearTimeout(timer));
    this.reindexTimers.clear();
  }

  async rebuildAll(): Promise<void> {
    this.isIndexing = true;
    this.trigger("changed");

    const nextTasksByPath = new Map<string, HtmlVTask[]>();
    for (const file of this.app.vault.getFiles().filter(isTaskSourceFile)) {
      nextTasksByPath.set(file.path, await this.parseFile(file));
    }

    this.tasksByPath = nextTasksByPath;
    this.isReady = true;
    this.isIndexing = false;
    this.trigger("changed");
  }

  async reindexFile(file: TFile): Promise<void> {
    if (!isTaskSourceFile(file)) {
      this.tasksByPath.delete(file.path);
      this.trigger("changed");
      return;
    }

    this.tasksByPath.set(file.path, await this.parseFile(file));
    this.isReady = true;
    this.trigger("changed");
  }

  getSnapshot(filter?: Partial<TaskFilter>): TaskIndexSnapshot {
    const tasks = Array.from(this.tasksByPath.values()).flat();
    return {
      tasks: filter ? filterTasks(tasks, filter) : tasks,
      isReady: this.isReady,
      isIndexing: this.isIndexing
    };
  }

  private scheduleReindex(file: TFile, delay = 350): void {
    const existingTimer = this.reindexTimers.get(file.path);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(() => {
      this.reindexTimers.delete(file.path);
      void this.reindexFile(file);
    }, delay);
    this.reindexTimers.set(file.path, timer);
  }

  private async parseFile(file: TFile): Promise<HtmlVTask[]> {
    const text = await this.app.vault.cachedRead(file);
    const extension = file.extension.toLowerCase();
    if (HTML_FILE_EXTENSIONS.includes(extension)) {
      return parseHtmlTasks(text, {
        path: file.path,
        sourceType: "html-file",
        sourceLabel: "HTML file"
      });
    }

    if (extension === "md") {
      return [
        ...parseMarkdownTasks(text, file.path),
        ...parseHtmlVCodeBlockTasks(text, file.path)
      ];
    }

    return [];
  }
}

function isTaskSourceFile(file: TFile): boolean {
  const extension = file.extension.toLowerCase();
  return extension === "md" || HTML_FILE_EXTENSIONS.includes(extension);
}

function filterTasks(tasks: HtmlVTask[], filter: Partial<TaskFilter>): HtmlVTask[] {
  const normalizedQuery = filter.query?.trim().toLowerCase() ?? "";
  return tasks.filter((task) => {
    if (filter.status === "open" && task.checked) {
      return false;
    }
    if (filter.status === "done" && !task.checked) {
      return false;
    }
    if (filter.checklistOnly && task.sourceType === "markdown-task") {
      return false;
    }
    if (filter.currentFileOnly && !getCurrentPathSet(filter).has(task.path)) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    return [
      task.text,
      task.path,
      task.sourceLabel,
      task.project ?? "",
      task.tags.join(" ")
    ].join(" ").toLowerCase().includes(normalizedQuery);
  });
}

function getCurrentPathSet(filter: Partial<TaskFilter>): Set<string> {
  return new Set([
    ...(filter.currentPaths ?? []),
    ...(filter.currentPath ? [filter.currentPath] : [])
  ]);
}
