# HTML V Editor 1.0.0 Release Notes

## 中文

HTML V Editor 1.0.0 是面向 Obsidian 社区插件市场准备的首个正式版本。

### 主要功能

- 在 Obsidian 中预览、可视化编辑和保存 `.html` / `.htm` 文件。
- 支持 Markdown `html-v` code block 的阅读模式与 Live Preview 渲染和编辑。
- 支持 Markdown 中嵌入 HTML 文件，并从预览进入编辑。
- 内置 HugeRTE 可视化编辑器、Source 编辑模式和安全预览模式。
- 支持特殊字符选择器、HugeRTE checklist、表格内 checklist。
- 内置 HTML V Tasks 面板，支持 HTML checklist、`html-v` block checklist 和普通 Markdown task 的聚合、过滤、分页与回写。
- 支持 Safe / Sandbox / Trusted 三档预览安全配置。

### 发布方式

本版本已把 HugeRTE 运行资源打入标准发布资产中，社区插件安装只需要：

```text
main.js
manifest.json
styles.css
```

### 验证

```text
npm run release 通过
npm run size 通过
npm audit --omit=dev --registry=https://registry.npmjs.org 通过
versions.json 映射校验通过
```

## English

HTML V Editor 1.0.0 is the first marketplace-ready release for Obsidian Community Plugins.

### Highlights

- Preview, visually edit, and save `.html` / `.htm` files inside Obsidian.
- Render and edit Markdown `html-v` code blocks in Reading view and Live Preview.
- Render and edit embedded HTML files from Markdown.
- Bundle HugeRTE locally with source editing and configurable safe preview modes.
- Support character map insertion, HugeRTE checklist, and checklist items inside tables.
- Provide the HTML V Tasks side panel for HTML checklist, `html-v` checklist, and Markdown task aggregation.
- Support task filtering, pagination, and write-back.

### Release Assets

HugeRTE runtime resources are bundled into the standard plugin assets. The release only needs:

```text
main.js
manifest.json
styles.css
```
