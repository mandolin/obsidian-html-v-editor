import { ItemView, MarkdownView, Notice, TFile, setIcon, type WorkspaceLeaf } from "obsidian";

import { HTML_V_EDITOR_VIEW_TYPE, HTML_V_TASK_PANEL_VIEW_TYPE } from "../constants";
import { HTML_FILE_EXTENSIONS } from "../constants";
import { parseHtmlEmbedText } from "../markdown/HtmlEmbedParser";
import { refreshLivePreviewHtmlEmbeds } from "../markdown/LivePreviewHtmlWidgets";
import type { HtmlVEditorSettings } from "../settings/settings";
import { HtmlVEditorView } from "../views/HtmlVEditorView";
import { TaskIndex } from "./TaskIndex";
import { TaskWriter } from "./TaskWriter";
import type { HtmlVTask, TaskFilter } from "./TaskTypes";

const DEFAULT_TASK_PAGE_SIZE = 100;

export class HtmlVTaskView extends ItemView {
  private readonly writer: TaskWriter;
  private rootEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private paginationEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private sourceTypeSelect: HTMLSelectElement | null = null;
  private tagSelect: HTMLSelectElement | null = null;
  private projectSelect: HTMLSelectElement | null = null;
  private page = 1;
  private filter: TaskFilter = {
    query: "",
    status: "open",
    checklistOnly: false,
    currentFileOnly: false,
    sourceType: "all",
    tag: "",
    project: "",
    currentPath: undefined,
    currentPaths: []
  };

  constructor(
    leaf: WorkspaceLeaf,
    private readonly taskIndex: TaskIndex,
    private readonly getSettings: () => HtmlVEditorSettings
  ) {
    super(leaf);
    this.writer = new TaskWriter(this.app);
    this.filter.status = getSettings().taskPanelDefaultStatus;
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
    this.paginationEl = null;
    this.searchInput = null;
    this.sourceTypeSelect = null;
    this.tagSelect = null;
    this.projectSelect = null;
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
      this.resetPage();
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
        this.resetPage();
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
        this.resetPage();
        this.renderTasks();
      }
    });
    this.createOptionCheckbox(optionGroup, {
      label: "Only current file",
      checked: this.filter.currentFileOnly,
      onChange: (checked) => {
        this.filter.currentFileOnly = checked;
        this.updateCurrentPath();
        this.resetPage();
        this.renderTasks();
      }
    });

    const advancedGroup = root.createDiv({ cls: "html-v-task-panel-filter-grid" });
    this.sourceTypeSelect = this.createFilterSelect(advancedGroup, "Source", (value) => {
      this.filter.sourceType = isTaskSourceTypeFilter(value) ? value : "all";
      this.resetPage();
      this.renderTasks();
    });
    this.tagSelect = this.createFilterSelect(advancedGroup, "Tag", (value) => {
      this.filter.tag = value;
      this.resetPage();
      this.renderTasks();
    });
    this.projectSelect = this.createFilterSelect(advancedGroup, "Project", (value) => {
      this.filter.project = value;
      this.resetPage();
      this.renderTasks();
    });

    this.summaryEl = root.createDiv({ cls: "html-v-task-panel-summary" });
    this.listEl = root.createDiv({ cls: "html-v-task-panel-list" });
    this.paginationEl = root.createDiv({ cls: "html-v-task-panel-pagination" });
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

  private createFilterSelect(parent: HTMLElement, labelText: string, onChange: (value: string) => void): HTMLSelectElement {
    const label = parent.createEl("label", { cls: "html-v-task-panel-filter" });
    label.createSpan({ text: labelText });
    const select = label.createEl("select", { cls: "html-v-task-panel-filter-select" });
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }

  private renderStatusButtons(statusGroup: HTMLElement): void {
    Array.from(statusGroup.querySelectorAll<HTMLButtonElement>(".html-v-task-panel-status-button"))
      .forEach((button) => {
        button.classList.toggle("is-active", button.textContent?.toLowerCase() === displayStatus(this.filter.status).toLowerCase());
      });
  }

  private renderTasks(): void {
    if (!this.listEl || !this.summaryEl || !this.paginationEl) {
      return;
    }

    const snapshot = this.taskIndex.getSnapshot(this.filter);
    this.renderFilterOptions(snapshot);

    const pageSize = getTaskPanelPageSize(this.getSettings().taskPanelPageSize);
    const totalPages = Math.max(1, Math.ceil(snapshot.tasks.length / pageSize));
    this.page = Math.min(this.page, totalPages);
    const pageStart = (this.page - 1) * pageSize;
    const visibleTasks = snapshot.tasks.slice(pageStart, pageStart + pageSize);

    this.summaryEl.setText(snapshot.isIndexing
      ? "Indexing tasks..."
      : `${snapshot.tasks.length} shown · ${snapshot.openTasks} open · ${snapshot.doneTasks} done`);

    // G-P2 使用分页限制单次 DOM 数量，先解决大列表卡顿，再为后续虚拟列表预留空间。
    this.listEl.empty();
    this.paginationEl.empty();
    if (!snapshot.isReady && snapshot.tasks.length === 0) {
      this.listEl.createDiv({ cls: "html-v-task-panel-empty", text: "Building task index..." });
      return;
    }

    if (snapshot.tasks.length === 0) {
      this.listEl.createDiv({ cls: "html-v-task-panel-empty", text: "No tasks found." });
      return;
    }

    for (const task of visibleTasks) {
      this.renderTask(task);
    }
    this.renderPagination(snapshot.tasks.length, totalPages, pageSize);
  }

  private renderFilterOptions(snapshot: ReturnType<TaskIndex["getSnapshot"]>): void {
    updateSelectOptions(this.sourceTypeSelect, [
      { value: "all", text: "All sources" },
      ...snapshot.availableSourceTypes.map((sourceType) => ({
        value: sourceType,
        text: getSourceTypeLabel(sourceType)
      }))
    ], this.filter.sourceType);
    updateSelectOptions(this.tagSelect, [
      { value: "", text: "All tags" },
      ...snapshot.availableTags.map((tag) => ({ value: tag, text: tag }))
    ], this.filter.tag);
    updateSelectOptions(this.projectSelect, [
      { value: "", text: "All projects" },
      ...snapshot.availableProjects.map((project) => ({ value: project, text: project }))
    ], this.filter.project);
  }

  private renderPagination(totalTasks: number, totalPages: number, pageSize: number): void {
    if (!this.paginationEl || totalTasks <= pageSize) {
      return;
    }

    const previousButton = this.paginationEl.createEl("button", {
      cls: "html-v-task-panel-page-button",
      text: "Prev"
    });
    previousButton.disabled = this.page <= 1;
    previousButton.addEventListener("click", () => {
      this.page = Math.max(1, this.page - 1);
      this.renderTasks();
    });

    this.paginationEl.createSpan({
      cls: "html-v-task-panel-page-label",
      text: `${this.page} / ${totalPages}`
    });

    const nextButton = this.paginationEl.createEl("button", {
      cls: "html-v-task-panel-page-button",
      text: "Next"
    });
    nextButton.disabled = this.page >= totalPages;
    nextButton.addEventListener("click", () => {
      this.page = Math.min(totalPages, this.page + 1);
      this.renderTasks();
    });
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

  private resetPage(): void {
    this.page = 1;
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

function updateSelectOptions(select: HTMLSelectElement | null, options: Array<{ value: string; text: string }>, selectedValue: string): void {
  if (!select) {
    return;
  }

  const nextSignature = options.map((option) => `${option.value}:${option.text}`).join("\n");
  if (select.dataset.optionsSignature !== nextSignature) {
    select.empty();
    for (const option of options) {
      select.createEl("option", {
        value: option.value,
        text: option.text
      });
    }
    select.dataset.optionsSignature = nextSignature;
  }

  select.value = options.some((option) => option.value === selectedValue) ? selectedValue : options[0]?.value ?? "";
}

function isTaskSourceTypeFilter(value: string): value is TaskFilter["sourceType"] {
  return value === "all" || value === "html-file" || value === "html-v-block" || value === "markdown-task";
}

function getSourceTypeLabel(sourceType: HtmlVTask["sourceType"]): string {
  switch (sourceType) {
    case "html-file":
      return "HTML file";
    case "html-v-block":
      return "html-v block";
    case "markdown-task":
      return "Markdown task";
  }
}

function getTaskPanelPageSize(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(500, Math.max(20, Math.floor(value)))
    : DEFAULT_TASK_PAGE_SIZE;
}
