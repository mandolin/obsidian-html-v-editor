# 测试清单

使用一次性测试 vault 做手动验证，避免影响真实资料库。

## G-P1 稳定性测试样例

G-P1 专用 smoke test 样例位于：

```text
I:\AI\Secret汇集区\temp\html-v-editor-gp1-smoke
```

入口文件：

```text
GP1-测试入口.md
```

重点验证：

- `html-v` block 宽高在阅读模式、Live Preview、编辑模式中是否一致。
- HTML 文件 embed 是否能在阅读模式和 Live Preview 中正常渲染。
- HTML 文件和 `html-v` block 中的图片资源路径是否正常。
- 表格内 checklist 是否能被任务面板索引和回写。
- 任务面板勾选后，已打开的 HTML tab、Markdown 阅读模式、Live Preview widget 是否刷新。
- `large-task-benchmark.md` 仅作为 G-P2 性能基准，不要求 G-P1 完成性能优化。

## G-P2 任务面板测试

使用同一个 G-P1 smoke test 目录，重点打开：

```text
large-task-benchmark.md
```

验证：

- HTML V Tasks 面板能显示普通 Markdown task 和 `html-v` checklist task。
- Source 下拉可以过滤 `HTML file`、`html-v block`、`Markdown task`。
- Tag 下拉可以过滤 `#gp1`、`#benchmark` 等标签。
- Project 下拉可以过滤 `#project/...` 任务。
- `Only current file` 只显示当前文件及其嵌入 HTML 文件中的任务。
- 大量任务时，每页最多显示 100 条，并出现 Prev / Next 分页控件。
- 翻页、搜索、状态过滤、来源过滤后，任务列表仍可正常勾选和复制。

## 构建

```powershell
npm install
npm run build
npm run release
```

预期结果：

- `main.js` 存在。
- `manifest.json` 存在。
- `styles.css` 存在。
- `hugerte/` 存在。
- `release/html-v-editor/` 存在。
- `release/html-v-editor-0.1.0.zip` 存在。

## 本地安装

将以下目录复制到测试 vault：

```text
release/html-v-editor/
```

目标位置：

```text
<vault>/.obsidian/plugins/html-v-editor/
```

然后在 Obsidian 社区插件设置中启用 `HTML V Editor`。

## HTML 文件编辑

创建 `sample.html`：

```html
<h1>Hello</h1>
<p>Original</p>
```

验证：

- 打开 `sample.html` 时使用 HTML V Editor 视图。
- Preview 模式可以渲染文件。
- Edit 模式可以加载 HugeRTE。
- Edit 模式可以切换到 TipTap、ProseMirror、Source。
- Source 模式可以编辑原始 HTML。
- Save 可以写回 `sample.html`。

## Source 后端

验证：

- 将 `Default Source backend` 设置为 `CodeMirror`。
- 文件视图 Source 模式显示带行号的 CodeMirror 编辑器。
- 模态编辑器切换到 Source 时也使用 CodeMirror。
- 将 `Default Source backend` 设置为 `Textarea`。
- 文件视图 Source 模式和模态 Source 模式使用普通 textarea。
- 两种后端下编辑和保存都正常。

## 预览安全

创建包含以下内容的 HTML 文件：

```html
<script>window.test = true;</script>
<iframe srcdoc="<p>frame</p>"></iframe>
<p onclick="alert(1)">click</p>
```

验证：

- Safe 模式会移除 script、iframe 和事件属性。
- Sandbox 模式保留原始 HTML，但 iframe 权限受 sandbox 限制。
- Trusted 模式默认仍不执行脚本，除非用户明确启用脚本执行。

## Trust 规则

在 vault 根目录创建 `.htmlv`：

```json
{
  "trust": [
    {
      "scope": "file",
      "pattern": "sample.html",
      "securityLevel": "sandbox"
    }
  ]
}
```

验证：

- 设置中已启用文件夹 trust 配置。
- 即使全局默认是 Safe，`sample.html` 也使用 Sandbox 渲染。
- `.htmlv` 中存在非法 JSON 时，不会破坏插件加载。

## Markdown `html-v`

创建：

````markdown
```html-v
<section><p>Original block</p></section>
```
````

验证：

- 阅读模式显示 HTML V 预览块。
- 阅读模式不显示 `HTML V` 标题栏或编辑按钮。
- Live Preview 中，光标不在 fenced block 内时，该块会替换为 HTML V widget。
- Live Preview 中，` ```html-v 800x600 ` 可以应用指定预览尺寸。
- 从 Live Preview 编辑后，可以保存回 fenced block。

## HTML 文件 Embed

创建：

```markdown
![[sample.html]]
```

验证：

- 阅读模式显示 HTML V embed 预览。
- Refresh 可以重新读取文件。
- Edit 打开内联模态编辑器，并将修改保存回 `sample.html`。
- Live Preview 中，光标不在 embed 行内时，该行会替换为 HTML V widget。

## Raw HTML 命令

创建包含以下内容的 Markdown 文件：

```html
<section>
  <p>Original raw block</p>
</section>
```

验证：

- `Edit selected HTML with HTML V Editor` 可以替换选区。
- `Edit HTML block at cursor with HTML V Editor` 可以替换完整 HTML block。
- 找不到完整 HTML block 时，不修改文档内容。
- Live Preview 和阅读模式中，普通 raw HTML block 仍由 Obsidian 自身渲染，不会自动替换为 HTML V Editor。
- 需要插件管理预览和内联编辑时，应使用 `html-v` fenced block。
