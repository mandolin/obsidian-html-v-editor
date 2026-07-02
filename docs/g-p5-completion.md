# G-P5 阶段完成记录

创建时间：2026-07-02

## 阶段目标

G-P5 聚焦 Obsidian 插件市场发布准备，包括市场面向 README、版本兼容声明、发布检查清单、提交说明和本地 release 验证。

本阶段不直接创建 GitHub Release，也不直接向 `obsidianmd/obsidian-releases` 提交 PR；这些外部动作需要用户确认后再执行。

## 已完成

- 重写 README，使首页更适合用户阅读和插件市场审核。
- README 增加中文与英文说明，覆盖功能、安装、使用、安全、任务面板、开发和发布状态。
- 新增根目录 `versions.json`，声明 `1.0.0` 对应最低 Obsidian 版本 `1.5.0`。
- 正式版本号提升到 `1.0.0`。
- HugeRTE 运行资源已改为内嵌到标准资产中，正式发布不再依赖额外 `hugerte/` 目录。
- 新增 `docs/marketplace-submission.md`，记录社区插件市场提交材料、release assets、`community-plugins.json` 模板和外部发布步骤。
- 更新 `docs/release-checklist.md`，补充 G-P5 市场发布检查项。
- 更新 `CHANGELOG.md`，将当前未发布区间扩展到 G-P5。

## 验证结果

G-P5 已执行：

```powershell
npm run release
npm run size
npm audit --omit=dev --registry=https://registry.npmjs.org
$m = Get-Content manifest.json -Raw | ConvertFrom-Json; $v = Get-Content versions.json -Raw | ConvertFrom-Json; $min = $v.($m.version); if ($min -ne $m.minAppVersion) { throw "versions.json mismatch" }; "versions.json ok"
```

结果：

```text
npm run release 通过
npm run size 通过
npm audit 通过，found 0 vulnerabilities
versions.json ok
```

当前体积：

```text
main.js          1.96 MB
manifest.json    223 B
styles.css       102.10 KB
total            2.06 MB
```

构建后已同步到固定本地 vault：

```text
K:\Project\Github_mandolin\obsidian-html-v-editor\.test-vault\.obsidian\plugins\html-v-editor
I:\AI\Secret汇集区\.obsidian\plugins\html-v-editor
K:\DOC_workspace\.obsidian\plugins\html-v-editor
```

## 重要发现

当前项目的标准 Obsidian release assets 是：

```text
main.js
manifest.json
styles.css
```

HTML V Editor 原本依赖 `hugerte/` runtime 目录。社区插件安装器通常只按标准 assets 下载核心文件，因此 G-P5 已将 HugeRTE skin 资源改为内嵌模块，并把插件、图标、模型、主题通过 esbuild 打入 `main.js`。

当前正式 release assets 只需要：

```text
main.js
manifest.json
styles.css
```

## 后续建议

1. 公开页当前已经发布到 Obsidian Community Plugins，后续发布新版本时继续保持标准三件套 release assets：`main.js`、`manifest.json`、`styles.css`。
2. 将公开页 `Review: Caution` 降级作为发布后优化事项，而不是当前阻塞事项。优先级建议：
   - 补 GitHub artifact attestations，降低 release provenance 相关提示。
   - 评估并尽量减少 Vault Enumeration 与 Clipboard Access 行为提示。
   - 清理自动审核中的非阻塞 warning：命令名去插件名前缀、`document` 改 `activeDocument`、TypeScript unsafe 访问、CSS lint。
3. 下一轮小版本可单独设为“市场质量与 Caution 降级”专项，避免和功能开发混在一起。
