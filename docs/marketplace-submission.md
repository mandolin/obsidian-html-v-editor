# Obsidian 插件市场提交准备

创建时间：2026-07-02

本文记录 HTML V Editor 进入 Obsidian Community Plugins 前需要准备和执行的事项。因为这部分直接面向插件市场，关键字段同时保留英文。

## 当前插件信息

```json
{
  "id": "html-v-editor",
  "name": "HTML V Editor",
  "version": "1.0.0",
  "minAppVersion": "1.5.0",
  "description": "Edit and preview HTML/HTM files inside Obsidian.",
  "author": "mandolin",
  "isDesktopOnly": true
}
```

GitHub repository:

```text
https://github.com/mandolin/obsidian-html-v-editor
```

## 仓库根目录必备文件

发布前应确认根目录存在：

```text
manifest.json
versions.json
README.md
LICENSE
main.js
styles.css
```

其中：

- `manifest.json` 是 Obsidian 识别插件的主清单。
- `versions.json` 用于声明每个插件版本对应的最低 Obsidian 版本。
- `README.md` 是社区插件审核和用户了解插件的入口。
- `LICENSE` 当前为 MIT。
- `main.js` 与 `styles.css` 由构建流程生成。

当前 `versions.json` 内容：

```json
{
  "1.0.0": "1.5.0"
}
```

## GitHub Release 要求

Obsidian 社区插件安装器会从 GitHub Release 下载插件文件。正式发布时需要：

1. 确认 `manifest.json` 中的 `version`。
2. 创建同名 Git tag 和 GitHub Release，例如 `1.0.0`。
3. Release assets 至少附加：

```text
main.js
manifest.json
styles.css
```

4. 本项目已把 HugeRTE 运行资源打入标准资产，正式安装不需要额外 `hugerte/` 目录。

## community-plugins.json 记录模板

向 `obsidianmd/obsidian-releases` 提交 PR 时，需要在 `community-plugins.json` 中追加类似记录：

```json
{
  "id": "html-v-editor",
  "name": "HTML V Editor",
  "author": "mandolin",
  "description": "Edit and preview HTML/HTM files inside Obsidian.",
  "repo": "mandolin/obsidian-html-v-editor"
}
```

英文简介建议：

```text
Edit and preview HTML/HTM files, Markdown html-v blocks, and embedded HTML files inside Obsidian.
```

如果需要强调任务功能，可用较长版本：

```text
Edit and preview HTML/HTM files, Markdown html-v blocks, and embedded HTML files inside Obsidian, with checklist support and an HTML task panel.
```

## 发布前验证

执行：

```powershell
npm run release
npm run size
npm audit --omit=dev --registry=https://registry.npmjs.org
```

还应确认：

- `versions.json` 中存在当前 manifest 版本。
- `versions.json` 中当前版本的最低 Obsidian 版本等于 `manifest.json.minAppVersion`。
- `release/html-v-editor/` 中包含本地安装所需文件。
- 三个本地 vault 已同步最新构建。
- README 和 release note 已说明 Desktop-only、预览安全模式、HTML 编辑边界。

## 外部发布步骤

这些步骤需要人工确认后再执行：

1. 提交并推送当前仓库。
2. 在 GitHub 创建 tag / release：`1.0.0`。
3. 上传 release assets。
4. Fork `obsidianmd/obsidian-releases`。
5. 修改 `community-plugins.json`。
6. 提交 PR 并按审核反馈调整。

## G-P5 当前结论

G-P5 的仓库侧准备目标是：让项目具备清晰的市场发布说明、版本兼容声明、release checklist 和可复现构建流程。

HugeRTE runtime 已改为标准资产内嵌方案，创建正式 GitHub Release 时只需要上传 `main.js`、`manifest.json`、`styles.css`。
