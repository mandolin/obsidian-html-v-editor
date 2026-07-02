# 发布前检查清单

创建时间：2026-07-02

## 构建检查

执行：

```powershell
npm run build
npm run release
npm run size
```

预期：

- TypeScript 编译通过。
- `main.js` 生成成功。
- `styles.css` 生成成功。
- HugeRTE 内嵌资源模块生成成功。
- `release/html-v-editor/` 生成成功。
- `release/html-v-editor-1.0.0.zip` 生成成功。

G-P4 实测结果：

```text
npm run release 通过
npm run size 通过
```

G-P5 实测结果：

```text
npm run release 通过
npm run size 通过
npm audit --omit=dev --registry=https://registry.npmjs.org 通过，found 0 vulnerabilities
versions.json 映射校验通过
```

当前体积：

```text
main.js          1.96 MB
manifest.json    223 B
styles.css       102.10 KB
total            2.06 MB
```

## release 包内容

`release/html-v-editor/` 必须包含：

```text
main.js
manifest.json
styles.css
```

`release/` 还应包含：

```text
INSTALL.txt
html-v-editor-1.0.0.zip
```

## Obsidian 插件市场发布检查

G-P5 补充：

- 根目录必须包含 `versions.json`。
- `versions.json` 必须包含当前 `manifest.json.version`。
- `versions.json` 中当前版本的值必须等于 `manifest.json.minAppVersion`。
- GitHub Release tag 必须与 `manifest.json.version` 完全一致。
- GitHub Release assets 至少包含：

```text
main.js
manifest.json
styles.css
```

- `community-plugins.json` 记录中的 `id` 必须等于 `manifest.json.id`。
- `community-plugins.json` 记录中的 `repo` 当前应为：

```text
mandolin/obsidian-html-v-editor
```

- HugeRTE runtime 已改为标准资产内嵌方案，正式发布不再依赖额外 `hugerte/` 目录。
- 市场发布材料见 [marketplace-submission.md](marketplace-submission.md)。

## 本地部署检查

每次构建后同步到固定本地 vault：

```text
K:\Project\Github_mandolin\obsidian-html-v-editor\.test-vault\.obsidian\plugins\html-v-editor
I:\AI\Secret汇集区\.obsidian\plugins\html-v-editor
K:\DOC_workspace\.obsidian\plugins\html-v-editor
```

## 手动 smoke test

使用：

```text
I:\AI\Secret汇集区\temp\html-v-editor-gp1-smoke\GP1-测试入口.md
```

重点验证：

- HTML 文件 tab 可打开、预览、编辑、Source、保存。
- `html-v` block 在阅读模式和 Live Preview 中显示正常。
- HTML 文件 embed 在阅读模式和 Live Preview 中显示正常。
- 图片资源路径正常。
- checklist 在表格中不破坏结构。
- 任务面板能索引、过滤、分页、勾选并回写任务。
- 设置页中的 checklist、特殊字符、任务面板、Live Preview、安全设置能保存。

## 发布风险

- 当前仍为本地安装版本，未进入 Obsidian 插件市场发布。
- `isDesktopOnly` 当前保持 `true`。
- release 包只包含标准三件套，HugeRTE 运行资源打包进 `main.js` / `styles.css`。
- README 已在 G-P5 整理为中英双语市场面向说明。
- 版本号已提升到 `1.0.0`。
- `npm audit --omit=dev --registry=https://registry.npmjs.org` 已通过，结果为 `found 0 vulnerabilities`。
