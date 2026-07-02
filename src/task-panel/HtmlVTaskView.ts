import { ItemView, MarkdownView, Notice, TFile, setIcon, type WorkspaceLeaf } from "obsidian";

import { HTML_V_EDITOR_VIEW_TYPE, HTML_V_TASK_PANEL_VIEW_TYPE } from "../constants";
import { HTML_FILE_EXTENSIONS } from "../constants";
import { parseHtmlEmbedText } from "../markdown/HtmlEmbedParser";
import { refreshLivePreviewHtmlEmbeds } from "../markdown/LivePreviewHtmlWidgets";
import { HtmlVEditorView } from "../views/HtmlVEditorView";
import { TaskIndex } from "./TaskIndex";
import { TaskWriter } from "./TaskWriter";
import type { HtmlVTask, TaskFilter } from "./TaskTypes";

export class HtmlVTaskView extends ItemView {
  private readonly writer: TaskWriter;
  private rootEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private filter: TaskFilter = {
    query: "",
    status: "open",
    checklistOnly: false,
    currentFileOnly: false,
    currentPath: undefined,
    currentPaths: []
  };

  constructor(
    leaf: WorkspaceLeaf,
    private readonly taskIndex: TaskIndex
  ) {
    super(leaf);
    this.writer = new TaskWriter(this.app);
  }

  getViewType(): string {
    return HTML_V_TASK_PANEL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "HTML V Tasks";
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen(): Promise<void> {
    this.rootEl = this.contentEl.createDiv({ cls: "html-v-task-panel" });
    this.renderShell();
    this.registerEvent(this.taskIndex.on("changed", () => this.renderTasks()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
      this.updateCurrentPath();
      this.renderTasks();
    }));
    this.registerEvent(this.app.workspace.on("file-open", () => {
      this.updateCurrentPath();
      this.renderTasks();
    }));
    this.updateCurrentPath();
    this.renderTasks();
  }

  async onClose(): Promise<void> {
    this.rootEl = null;
    this.listEl = null;
    this.summaryEl = null;
    this.searchInput = null;
  }

  private renderShell(): void {
    const root = this.rootEl;
    if (!root) {
      return;
    }

    root.empty();

    const toolbar = root.createDiv({ cls: "html-v-task-panel-toolbar" });
    this.searchInput = toolbar.createEl("input", {
      type: "search",
      placeholder: "Search tasks...",
      cls: "html-v-task-panel-search"
    });
    this.searchInput.value = this.filter.query;
    this.searchInput.addEventListener("input", () => {
      this.filter.query = this.searchInput?.value ?? "";
      this.renderTasks();
    });

    const refreshButton = toolbar.createEl("button", {
      cls: "html-v-task-panel-icon-button",
      attr: { "aria-label": "Refresh task index" }
    });
    setIcon(refreshButton, "refresh-cw");
    refreshButton.addEventListener("click", () => {
      void this.taskIndex.rebuildAll();
    });

    const statusGroup = root.createDiv({ cls: "html-v-task-panel-status-group" });
    (["all", "open", "done"] as const).forEach((status) => {
      const button = statusGroup.createEl("button", {
        text: status === "all" ? "All" : status === "open" ? "Open" : "Done",
        cls: "html-v-task-panel-status-button"
      });
      button.addEventListener("click", () => {
        this.filter.status = status;
        this.renderStatusButtons(statusGroup);
        this.renderTasks();
      });
    });
    this.renderStatusButtons(statusGroup);

    const optionGroup = root.createDiv({ cls: "html-v-task-panel-option-group" });
    this.createOptionCheckbox(optionGroup, {
      label: "Only HugeRTE checklist",
      checked: this.filter.checklistOnly,
      onChange: (checked) => {
        this.filter.checklistOnly = checked;
        this.renderTasks();
      }
    });
    this.createOptionCheckbox(optionGroup, {
      label: "Only current file",
      checked: this.filter.currentFileOnly,
      onChange: (checked) => {
        this.filter.currentFileOnly = checked;
        this.updateCurrentPath();
        this.renderTasks();
      }
    });

    this.summaryEl = root.createDiv({ cls: "html-v-task-panel-summary" });
    this.listEl = root.createDiv({ cls: "html-v-task-panel-list" });
  }

  private createOptionCheckbox(parent: HTMLElement, options: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }): void {
    const label = parent.createEl("label", { cls: "html-v-task-panel-option" });
    const checkbox = label.createEl("input", {
      type: "checkbox",
      cls: "html-v-task-panel-option-checkbox"
    });
    checkbox.checked = options.checked;
    checkbox.addEventListener("change", () => {
      options.onChange(checkbox.checked);
    });
    label.createSpan({ text: options.label });
  }

  private renderStatusButtons(statusGroup: HTMLElement): void {
    Array.from(statusGroup.querySelectorAll<HTMLButtonElement>(".html-v-task-panel-status-button"))
      .forEach((button) => {
        button.classList.toggle("is-active", button.textContent?.toLowerCase() === displayStatus(this.filter.status).toLowerCase());
      });
  }

  private renderTasks(): void {
    if (!this.listEl || !this.summaryEl) {
      return;
    }

    const allTasks = this.taskIndex.getSnapshot().tasks;
    const snapshot = this.taskIndex.getSnapshot(this.filter);
    const openCount = allTasks.filter((task) => !task.checked).length;
    const doneCount = allTasks.length - openCount;

    this.summaryEl.setText(snapshot.isIndexing
      ? "Indexing tasks..."
      : `${snapshot.tasks.length} shown · ${openCount} open · ${doneCount} done`);

    // 当前仍是简单全量渲染；G-P2 需要在这里引入分页、虚拟列表或增量渲染。
    this.listEl.empty();
    if (!snapshot.isReady && snapshot.tasks.length === 0) {
      this.listEl.createDiv({ cls: "html-v-task-panel-empty", text: "Building task index..." });
      return;
    }

    if (snapshot.tasks.length === 0) {
      this.listEl.createDiv({ cls: "html-v-task-panel-empty", text: "No tasks found." });
      return;
    }

    for (const task of snapshot.tasks) {
      this.renderTask(task);
    }
  }

  private renderTask(task: HtmlVTask): void {
    const row = this.listEl?.createDiv({ cls: "html-v-task-panel-task" });
    if (!row) {
      return;
    }
    row.classList.toggle("is-done", task.checked);

    const checkbox = row.createEl("input", {
      type: "checkbox",
      cls: "html-v-task-panel-checkbox"
    });
    checkbox.checked = task.checked;
    checkbox.addEventListener("change", async () => {
      checkbox.disabled = true;
      try {
        await this.writer.setChecked(task, checkbox.checked);
        // 回写后主动刷新已打开的 HTML tab、Live Preview widget 和阅读模式嵌入。
        await this.refreshOpenHtmlViews(task.path);
        refreshLivePreviewHtmlEmbeds(task.path);
        this.refreshOpenMarkdownEmbeds(task.path);
        await this.reindexTaskFile(task);
      } catch (error) {
        console.error("Failed to update task state", error);
        checkbox.checked = task.checked;
        new Notice(error instanceof Error ? error.message : "Unable to update task.");
      } finally {
        checkbox.disabled = false;
      }
    });

    const content = row.createDiv({ cls: "html-v-task-panel-task-content" });
    content.addEventListener("click", () => {
      void this.openTaskSource(task);
    });

    content.createDiv({ cls: "html-v-task-panel-task-text", text: task.text || "(empty task)" });

    const meta = content.createDiv({ cls: "html-v-task-panel-task-meta" });
    meta.createSpan({ text: task.path });
    meta.createSpan({ text: ` · ${task.sourceLabel}` });

    if (task.tags.length > 0) {
      const tags = content.createDiv({ cls: "html-v-task-panel-tags" });
      task.tags.forEach((tag) => tags.createSpan({ cls: "html-v-task-panel-tag", text: tag }));
    }

    const actions = row.createDiv({ cls: "html-v-task-panel-actions" });
    const copyButton = actions.createEl("button", {
      cls: "html-v-task-panel-icon-button",
      attr: { "aria-label": "Copy task text" }
    });
    setIcon(copyButton, "copy");
    copyButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await navigator.clipboard.writeText(task.text);
      new Notice("Task text copied.");
    });
  }

  private async reindexTaskFile(task: HtmlVTask): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (file instanceof TFile) {
      await this.taskIndex.reindexFile(file);
    }
  }

  private async refreshOpenHtmlViews(path: string): Promise<void> {
    const refreshes = this.app.workspace.getLeavesOfType(HTML_V_EDITOR_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is HtmlVEditorView => view instanceof HtmlVEditorView)
      .map((view) => view.refreshFromDiskIfClean(path));
    await Promise.all(refreshes);
  }

  private refreshOpenMarkdownEmbeds(path: string): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !(view.file instanceof TFile)) {
        return;
      }

      if (this.getTaskPathsForCurrentFile(view.file).includes(path)) {
        view.previewMode.rerender(true);
      }
    });
  }

  private async openTaskSource(task: HtmlVTask): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) {
      new Notice(`Task source not found: ${task.path}`);
      return;
    }

    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    await this.app.workspace.revealLeaf(leaf);
  }

  private updateCurrentPath(): void {
    const currentFile = this.app.workspace.getActiveFile();
    this.filter.currentPath = currentFile?.path;
    this.filter.currentPaths = currentFile instanceof TFile
      ? this.getTaskPathsForCurrentFile(currentFile)
      : [];
  }

  private getTaskPathsForCurrentFile(file: TFile): string[] {
    const paths = new Set<string>([file.path]);
    if (file.extension.toLowerCase() !== "md") {
      return Array.from(paths);
    }

    const cache = this.app.metadataCache.getFileCache(file);
    // “当前文件”过滤需要把当前 Markdown 中嵌入的 HTML 文件一并视为当前上下文。
    for (const embed of cache?.embeds ?? []) {
      const spec = parseHtmlEmbedText(embed.original);
      if (!spec) {
        continue;
      }

      const embeddedFile = this.app.metadataCache.getFirstLinkpathDest(spec.linktext, file.path);
      if (embeddedFile instanceof TFile && HTML_FILE_EXTENSIONS.includes(embeddedFile.extension.toLowerCase())) {
        paths.add(embeddedFile.path);
      }
    }

    return Array.from(paths);
  }
}

function displayStatus(status: TaskFilter["status"]): string {
  return status === "all" ? "All" : status === "open" ? "Open" : "Done";
}
