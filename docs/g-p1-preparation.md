# G-P1 开始前准备事项

创建时间：2026-07-02

## 阶段边界

G-P1 只处理现有功能稳定性和缺口修补，不提前进入 G-P2 的任务面板数据模型重构。

本阶段优先关注：

- `html-v` code block 在阅读模式、Live Preview、编辑模式下的宽高一致性。
- HTML 文件 embed 在阅读模式和 Live Preview 下的刷新稳定性。
- checklist 在表格、嵌套结构、空单元格、选区转换时不破坏原结构。
- 图片资源路径在 HTML 文件、`html-v` block、HTML embed 中保持一致。
- 任务面板勾选后，已打开 HTML tab、Markdown 阅读模式、Live Preview widget 能及时刷新。
- UI 文本编码和显示文案不出现明显异常。

## 当前问题清单来源

目前没有用户标记的紧急待修问题。G-P1 的问题清单先从以下来源滚动整理：

- 最近实际修过的问题回归：
  - 图片路径被 Obsidian 转换为 `app://...` 后预览失败。
  - 编辑模式正常但阅读模式 `html-v` 宽高不生效。
  - checklist 在表格单元格中转换时结构异常。
  - 任务面板勾选后嵌入内容未刷新。
- G-P1 smoke test 中复现出的新问题。
- 用户后续实际使用时反馈的新问题。

## 手动测试样例

测试样例位置：

```text
I:\AI\Secret汇集区\temp\html-v-editor-gp1-smoke
```

入口文件：

```text
GP1-测试入口.md
```

样例覆盖：

- `html-v` block 宽高：`520x220`、`width=420 height=180`。
- HTML 文件 embed：`standalone-editor-sample.html`、`embedded-checklist.html`。
- 图片资源路径：`assets/gp1-image.svg`。
- 表格内 checklist：`embedded-checklist.html`。
- 任务面板当前文件过滤和 HugeRTE checklist 过滤。
- 大量任务性能基准：`large-task-benchmark.md`。

## G-P2 性能基准预留

`large-task-benchmark.md` 当前包含：

- 100 条普通 Markdown task。
- 20 条 `html-v` checklist task。

这个文件不要求在 G-P1 中优化性能，只作为 G-P2 前后的对比样本。G-P1 中如果发现任务面板明显卡顿，只记录为 G-P2 输入，除非它影响基础可用性。

## G-P1 开始条件

- 当前注释和准备文档提交到 Git。
- `npm run build` 通过。
- Smoke test 样例能在指定目录中打开。
- 确认 G-P1 不做任务面板数据模型重构。

## 建议提交信息

```text
docs: prepare G-P1 baseline

- add project-level Codex collaboration rules
- add Chinese comments for task panel and preview maintenance paths
- document G-P1 preparation scope and smoke test samples
```
