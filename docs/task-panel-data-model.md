# HTML V Tasks 数据模型与回写边界

创建时间：2026-07-02

## 任务来源类型

G-P2 后任务面板明确支持三类来源：

- `html-file`：独立 `.html` / `.htm` 文件中的 HTML checklist。
- `html-v-block`：Markdown 文件中 `html-v` fenced code block 内的 HTML checklist。
- `markdown-task`：普通 Markdown `- [ ]` / `- [x]` 任务。

暂缓项：

- 普通 raw HTML block 中的 checklist 暂不纳入任务面板。
- 日历、提醒、循环任务、依赖关系、看板等完整任务管理能力暂不纳入。

## HTML checklist 标准结构

新写入或回写后的 HTML checklist 应逐步具备以下标记：

```html
<ul class="tox-checklist htmlv-checklist">
  <li
    class="tox-checklist-item htmlv-checklist-item"
    data-htmlv-task-id="htmlv-task-..."
    data-checked="false"
  >
    task text
  </li>
</ul>
```

说明：

- `htmlv-checklist` 和 `htmlv-checklist-item` 是本插件自己的结构标记。
- `tox-checklist` 和 `tox-checklist-item` 保留为 HugeRTE / TinyMCE 系兼容标记。
- `data-htmlv-task-id` 是 HTML checklist 的优先回写定位字段。
- `data-checked` 是 HTML checklist 的状态字段。

## 兼容策略

旧数据可能只有 `tox-checklist` / `tox-checklist-item`，或没有 `data-htmlv-task-id`。

G-P2 的兼容策略：

- 读取时同时识别 `htmlv-*`、`tox-*` 和 `data-htmlv-task-id`。
- 回写时优先使用 `data-htmlv-task-id`。
- 如果旧任务没有 `data-htmlv-task-id`，回写时按 occurrence 定位，并补写新的 `data-htmlv-task-id`。
- 回写时补齐 `htmlv-checklist` / `htmlv-checklist-item`，让旧数据逐步迁移到本插件结构。

## 回写边界

任务面板通过 `locator` 控制回写范围：

- `markdown-task`：按文件路径和行号回写 Markdown task 状态。
- `html-v-block`：先定位 Markdown 文件中的第几个 `html-v` code block，再只替换该 block 内的 HTML。
- `html-file`：直接在对应 HTML 文件中更新目标 checklist item。

原则：

- 不跨来源修改任务。
- 不在普通 Markdown 文本中搜索替换 HTML task。
- 找不到目标任务时保持原文件内容不变。

## 过滤能力

G-P2 后任务面板支持：

- 状态过滤：All / Open / Done。
- 来源过滤：All sources / HTML file / html-v block / Markdown task。
- 标签过滤：来自任务文本中的 `#tag`。
- 项目过滤：来自 `#project/name`。
- 当前文件过滤：当前文件自身，以及当前 Markdown 中嵌入的 HTML 文件。
- HugeRTE checklist 过滤：排除普通 Markdown task。

## 大列表性能策略

G-P2 当前采用分页渲染：

- 每页最多渲染 100 条任务。
- 搜索、过滤、状态切换时回到第一页。
- 只有当前页任务会生成 DOM，避免大量任务时一次性重建全部节点。

后续可选升级：

- 虚拟列表。
- 增量渲染。
- 面板过滤状态持久化。
- 更细的任务分组视图，例如按文件、标签、来源分组。
