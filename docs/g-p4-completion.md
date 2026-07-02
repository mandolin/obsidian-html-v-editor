# G-P4 完成记录

完成时间：2026-07-02

## 阶段边界

G-P4 聚焦发布前工程质量与 release 整理，不进入 Obsidian 插件市场提交。市场发布材料和审核流程留到 G-P5。

本阶段不擅自修改版本号，当前仍保持：

```text
manifest.json: 0.1.0
package.json: 0.1.0
```

## 完成项

- release 流程验证：
  - `npm run release` 通过。
  - 生成 `release/html-v-editor/`。
  - 生成 `release/html-v-editor-0.1.0.zip`。
- 构建体积检查：
  - `npm run size` 通过。
  - 当前总量约 `7.98 MB`。
  - 主要体积来自 `hugerte/`，约 `6.00 MB`。
- release 包内容检查：
  - `main.js`
  - `manifest.json`
  - `styles.css`
  - `hugerte/`
  - `INSTALL.txt`
- zip 内容抽样检查：
  - zip 根目录包含 `html-v-editor/`。
  - 目录内包含核心插件文件和 HugeRTE 资源。
- 文档整理：
  - `docs/local-install.md` 改为中文。
  - release 包中的 `INSTALL.txt` 改为中文。
  - 新增 `docs/release-checklist.md`。
  - 更新 `CHANGELOG.md`，记录 G-P1 到 G-P4 的未发布变更。

## 验证结果

```text
npm run release
npm run size
npm audit --omit=dev --registry=https://registry.npmjs.org
```

均已完成。

体积输出：

```text
main.js          1.88 MB
manifest.json    223 B
styles.css       102.10 KB
hugerte          6.00 MB
total            7.98 MB
```

生产依赖审计结果：

```text
found 0 vulnerabilities
```

## 本地部署

构建产物已复制到：

```text
K:\Project\Github_mandolin\obsidian-html-v-editor\.test-vault\.obsidian\plugins\html-v-editor
I:\AI\Secret汇集区\.obsidian\plugins\html-v-editor
K:\DOC_workspace\.obsidian\plugins\html-v-editor
```

## 风险与遗留事项

- README 中仍保留旧 Stage 0-7 英文历史章节，G-P5 前需要统一梳理市场发布用文案。
- 当前仍保持 `isDesktopOnly: true`。
- 当前仍保持版本号 `0.1.0`，正式发布前需要确认是否提升版本。
- Obsidian 插件市场发布材料、GitHub Release、versions.json 等留到 G-P5。

## 建议提交信息

```text
chore: complete G-P4 release readiness

- verify release package and build size
- add release checklist and G-P4 completion notes
- update local install docs and changelog
```
