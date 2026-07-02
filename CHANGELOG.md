# Changelog

## 未发布 - G-P1 到 G-P5

### Added

- 新增 G-P* 下一开发周期规划文档。
- 新增 HTML V Tasks 任务面板数据模型说明。
- 新增设置说明文档和发布前检查清单。
- 新增 G-P1/G-P2/G-P3/G-P4 阶段完成记录。
- 新增 G-P5 市场发布准备记录和 Obsidian 插件市场提交说明。
- 新增根目录 `versions.json`，声明当前版本的最低 Obsidian 版本。
- 新增任务面板 source、tag、project 过滤。
- 新增任务面板分页渲染，降低大量任务条目时的 DOM 压力。
- 新增任务面板设置：普通 Markdown task 索引、默认状态、每页数量。
- 新增 HugeRTE checklist 按钮设置。

### Changed

- 设置页主要文案改为中文，并按编辑器、特殊字符、任务面板、预览与安全分组。
- README 改为更适合 Obsidian 插件市场审核和用户阅读的中英双语首页。
- 测试清单改为中文，并补充 G-P1/G-P2/G-P3/G-P4 验证入口。
- 本地安装文档和 release 包中的 `INSTALL.txt` 改为中文。
- HTML checklist 回写时逐步补齐 `htmlv-*` 类名和 `data-htmlv-task-id`。

### Fixed

- 修复 embed / `html-v` block 尺寸残留问题。
- 修复 vault 内 `app://` 和 Windows 绝对资源路径导致的图片预览风险。
- 修复 checklist 退出时 `htmlv-*` 标记残留问题。
- 修复任务面板勾选失败后 checkbox 可能停留 disabled 的问题。

### Notes

- 当前版本号仍保持 `0.1.0`，正式发布前仍建议由用户确认是否提升版本。
- Obsidian 插件市场发布材料已在 G-P5 准备，但尚未创建 GitHub Release 或提交社区插件 PR。
- 正式提交前需要确认 `hugerte/` runtime 目录在社区插件安装流程中的分发方式。

## 0.1.0 - 2026-06-24

Initial MVP for local testing.

### Added

- Obsidian plugin scaffold with TypeScript and esbuild.
- Custom `.html` / `.htm` workspace view.
- Preview, Edit, Source, and Save controls for HTML files.
- HugeRTE visual editor bundled locally.
- Source editor adapter.
- Runtime editor switching between HugeRTE and Source.
- Safe, Sandbox, and Trusted preview security modes.
- DOMPurify-based Safe sanitizer.
- Settings tab for editor and preview security options.
- Markdown `html-v` fenced code block preview and modal editing.
- Markdown `![[file.html]]` / `![[file.htm]]` embed preview and edit entry.
- Commands for selected raw HTML and cursor HTML block editing.
- Local install helper script.
- Release packaging script.

### Notes

- This release is intended for local/manual installation.
- Obsidian Community Plugin marketplace submission is intentionally deferred.
