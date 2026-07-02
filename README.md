# HTML V Editor

HTML V Editor 是一个 Obsidian 桌面端插件，用来在 vault 内直接预览、编辑和保存 `.html` / `.htm` 文件，并为 Markdown 中的 `html-v` 代码块和 HTML 嵌入提供可视化编辑体验。

English: HTML V Editor is a desktop-only Obsidian plugin for previewing, visually editing, and saving `.html` / `.htm` files inside your vault. It also supports editable Markdown `html-v` code blocks and embedded HTML files.

## 功能亮点 / Features

- 在 Obsidian 中打开 `.html` / `.htm` 文件，并在 Preview、Edit、Source 三种模式之间切换。
- 使用本地打包的 HugeRTE 作为可视化 HTML 编辑器，不依赖 CDN。
- 支持 Markdown `html-v` fenced code block 的阅读模式和 Live Preview 渲染。
- 支持 Markdown 中嵌入 HTML 文件，并从嵌入预览进入编辑。
- 提供 Safe / Sandbox / Trusted 三档预览安全模式。
- 支持 HugeRTE checklist、特殊字符选择器、图片路径处理、表格内 checklist。
- 内置 HTML V Tasks 任务面板，可聚合 HTML checklist、`html-v` block checklist 和普通 Markdown task。
- 任务面板支持状态、来源、tag、project、当前文件和分页过滤。

English features:

- Open `.html` / `.htm` files in a custom Obsidian view.
- Switch between Preview, visual Edit, Source, and Save.
- Bundle HugeRTE locally with no CDN dependency.
- Render and edit Markdown `html-v` fenced code blocks.
- Render and edit embedded HTML files.
- Use Safe, Sandbox, or Trusted preview modes.
- Manage HTML checklist tasks through the built-in HTML V Tasks side panel.

## 安装 / Installation

当前版本仍建议先手动安装；进入 Obsidian 插件市场后可从社区插件列表安装。

Manual installation:

1. Download the release assets from GitHub.
2. Copy these files into `<vault>/.obsidian/plugins/html-v-editor/`:

```text
main.js
manifest.json
styles.css
hugerte/
```

3. Restart Obsidian or reload community plugins.
4. Enable `HTML V Editor` in Obsidian settings.

本地安装细节见 [docs/local-install.md](docs/local-install.md)。

## 使用 / Usage

打开 vault 中的 `.html` 或 `.htm` 文件后，插件会显示 HTML V Editor 标签页。顶部按钮用于切换：

- `Preview`：预览 HTML 内容。
- `Edit`：使用 HugeRTE 可视化编辑。
- `Source`：直接编辑 HTML 源码。
- `Save`：写回当前文件。

在 Markdown 文件中可以使用：

````markdown
```html-v
<table>
  <tr><td>Hello HTML V</td></tr>
</table>
```
````

也可以嵌入 vault 内 HTML 文件：

```markdown
![[example.html]]
```

English usage: open an HTML file in your vault, switch modes from the toolbar, edit with HugeRTE or source mode, then save back to the same vault file. Markdown `html-v` blocks and embedded HTML files can be edited from reading or Live Preview surfaces.

## HTML V Tasks

HTML V Tasks 是插件内置任务面板，用于集中查看和勾选：

- HTML 文件中的 HugeRTE checklist。
- Markdown `html-v` code block 中的 checklist。
- 普通 Markdown task。

任务面板支持：

- `All` / `Open` / `Done` 状态过滤。
- 只看 HugeRTE / HTML V checklist。
- 只看当前文件，以及当前 Markdown 文件嵌入的 HTML 文件。
- 按来源、`#tag`、`#project/name` 过滤。
- 分页渲染大量任务条目。

数据模型和回写边界见 [docs/task-panel-data-model.md](docs/task-panel-data-model.md)。

## 设置 / Settings

插件设置页目前按中文分组整理，覆盖：

- 编辑器与 Source 后端。
- HugeRTE checklist 按钮。
- 特殊字符按钮、默认字符组和自定义字符。
- 任务面板索引范围、默认状态、分页大小。
- Live Preview 行为。
- Safe / Sandbox / Trusted 安全选项和 trust 规则。

详细说明见 [docs/settings-guide.md](docs/settings-guide.md)。

## 安全说明 / Security

默认 `Safe` 模式会使用 DOMPurify 清理 HTML，移除脚本和高风险属性，并在不允许脚本执行的 iframe 中渲染。

`Sandbox` 和 `Trusted` 模式适用于你信任的内容。脚本、同源、表单和弹窗能力由设置项控制。请只对可信来源启用更高权限。

English: Safe mode sanitizes HTML with DOMPurify and renders it in a restricted iframe. Sandbox and Trusted modes expose more browser capabilities and should only be used with content you trust.

## 发布状态 / Release Status

当前插件版本：`0.1.0`

当前状态：

- 本地安装和手动测试可用。
- G-P1 到 G-P4 稳定性、任务面板、设置整理和 release 包流程已完成。
- G-P5 正在整理 Obsidian 社区插件市场发布材料。

社区插件市场发布前需要：

- GitHub Release tag 与 `manifest.json` 中的版本号一致。
- Release assets 包含 `main.js`、`manifest.json`、`styles.css`。
- 仓库根目录包含 `versions.json`。
- 向 `obsidianmd/obsidian-releases` 提交社区插件记录。

## 开发 / Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Create local release package:

```bash
npm run release
```

Report artifact sizes:

```bash
npm run size
```

Copy to a local vault plugin folder:

```powershell
$env:OBSIDIAN_PLUGIN_DIR = "C:\Path\To\Vault\.obsidian\plugins\html-v-editor"
npm run copy:local
```

发布前检查见 [docs/release-checklist.md](docs/release-checklist.md)。

## License

MIT
