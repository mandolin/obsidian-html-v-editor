import { Notice, TFile, type App } from "obsidian";

import {
  replaceHtmlVCodeBlock,
  updateHtmlTaskChecked,
  updateMarkdownTaskChecked
} from "./TaskParser";
import type { HtmlVTask } from "./TaskTypes";

export class TaskWriter {
  constructor(private readonly app: App) {}

  async setChecked(task: HtmlVTask, checked: boolean): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) {
      new Notice(`Task source not found: ${task.path}`);
      return;
    }

    await this.app.vault.process(file, (data) => {
      const locator = task.locator;
      if (locator.type === "markdown-task") {
        return updateMarkdownTaskChecked(data, locator.line, checked);
      }

      if (locator.type === "html-v-block") {
        return replaceHtmlVCodeBlock(data, locator.blockIndex ?? 0, (html) => {
          return updateHtmlTaskChecked(html, locator.taskId, locator.occurrence, checked);
        });
      }

      return updateHtmlTaskChecked(data, locator.taskId, locator.occurrence, checked);
    });
  }
}
