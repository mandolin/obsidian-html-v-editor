# 设置说明

创建时间：2026-07-02

## 编辑器

- 默认可视化编辑器：控制 HTML 文件、`html-v` block、HTML embed 编辑时优先使用的富文本编辑器。
- 默认 Source 后端：控制 Source 模式使用 CodeMirror 还是普通 textarea。
- Checklist 按钮：控制 HugeRTE 工具栏是否显示 checklist 按钮。关闭后不影响已有 checklist 的显示。

## 特殊字符

- 特殊字符按钮：控制 HugeRTE 工具栏是否显示特殊字符按钮。
- 默认字符组：控制特殊字符对话框中的内置字符组。
- 自定义特殊字符：使用 JSON 数组维护额外字符，例如：

```json
[
  { "char": "☕", "name": "Coffee" }
]
```

## 任务面板

- 索引普通 Markdown task：开启后，HTML V Tasks 会索引 Markdown 中的 `- [ ]` / `- [x]`。
- 任务面板默认状态：控制任务面板初始显示 All、Open 或 Done。
- 任务面板每页数量：分页渲染时每页任务数量，范围为 20-500，默认 100。

说明：

- HTML checklist 和 `html-v` block checklist 始终属于 HTML V Tasks 的核心索引范围。
- 普通 Markdown task 可以通过设置关闭，方便只查看 HTML V checklist。
- 大列表当前使用分页渲染，后续仍可升级为虚拟列表。

## 预览与安全

- 默认预览安全级别：控制 HTML 预览使用 Safe、Sandbox 或 Trusted。
- Live Preview 中渲染 `html-v` block：控制是否把 `html-v` fenced block 替换为插件预览。
- Live Preview 中渲染 HTML 文件 embed：控制是否把 `![[file.html]]` 替换为插件预览。
- Live Preview 编辑触发方式：选择悬浮按钮或点击预览区域编辑。
- 文件夹 trust 配置：读取 `.htmlv` 文件中的 trust 规则。
- 全局 trust 规则 JSON：在设置页中维护全局 trust 规则。
- Safe 模式允许远程图片：只放开远程图片，不放开脚本和 frame。
- Sandbox / Trusted 脚本相关选项：默认保持关闭，只有明确需要时再开启。
