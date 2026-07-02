# G-P1 完成记录

完成时间：2026-07-02

## 阶段边界

G-P1 按照既定边界执行：只处理现有功能稳定性和缺口修补，不进入 G-P2 的任务面板数据模型重构。

## 完成项

- 补齐 G-P1 smoke test 样例：
  - 入口：`I:\AI\Secret汇集区\temp\html-v-editor-gp1-smoke\GP1-测试入口.md`
  - 覆盖 `html-v` 宽高、HTML embed、HTML 文件 tab、图片路径、表格 checklist、任务面板刷新。
- 准备 G-P2 性能基准样例：
  - `large-task-benchmark.md`
  - 100 条 Markdown task。
  - 20 条 `html-v` checklist task。
- 修复 embed/code block 宽高残留：
  - `applyEmbedDimensions` 现在会清理旧的 `width`、`height`、`max-width` 内联样式。
  - 避免同一容器从有尺寸切换到无尺寸时残留旧尺寸。
- 加强 HTML 资源路径稳定性：
  - 对 Obsidian `app://...` 资源路径增加 vault 相对路径归一。
  - 对 Windows 绝对路径增加 vault 根目录内的相对化处理。
  - 减少复制/编辑后图片路径仍指向旧 `app://` 地址导致预览失败的风险。
- 修复 checklist 退出清理：
  - 退出 checklist 时同时清理 `tox-*` 和 `htmlv-*` 类名。
  - 清理 `data-checked` 和 `data-htmlv-task-id`。
  - 拆分 checklist 时保留 `htmlv-checklist` 兼容类。
- 加强任务面板勾选稳定性：
  - 回写失败时恢复 checkbox 状态。
  - 回写失败时解除 disabled 状态并显示错误提示。
- 补充维护注释：
  - 任务索引、防抖重建、任务回写 locator、Live Preview 刷新、阅读模式尺寸延迟应用等关键路径已补中文注释。
- 文档整理：
  - 新增 `docs/g-p1-preparation.md`。
  - 新增本文件 `docs/g-p1-completion.md`。
  - `docs/testing-checklist.md` 已改为中文，并加入 G-P1 测试入口。

## 验证结果

- `npm run build` 已通过。
- 外部 smoke test 样例文件已创建。
- 大量任务基准文件已创建，并确认任务数量：
  - Markdown task：100 条。
  - HTML V checklist task：20 条。

## 未在 G-P1 中处理的事项

- 任务面板分页、虚拟列表、增量渲染：保留到 G-P2。
- checklist 数据模型统一和迁移策略：保留到 G-P2。
- 设置页系统整理：保留到 G-P3。
- Obsidian 插件市场发布材料：保留到 G-P5。

## 建议提交信息

```text
chore: complete G-P1 stability baseline

- fix embed dimension cleanup and resource path normalization
- harden checklist exit and task panel checkbox updates
- add G-P1 smoke samples and Chinese testing docs
```
