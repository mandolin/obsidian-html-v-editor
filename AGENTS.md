# 项目级 Codex 工作规则

本文件记录 `obsidian-html-v-editor` 项目内 Codex 协作时需要长期遵守的规则。

## Shell

- Windows 环境下优先使用 PowerShell 7：`C:\Program Files\PowerShell\7\pwsh.exe`。
- 如果工具运行器仍启动 Windows PowerShell 5.1，且命令语义或版本会影响结果，则显式调用 PowerShell 7。

## Git 提醒

- 当察觉到已经改动了较多文件、实现了较多功能，或者完成了一个相对完整的阶段，但尚未提交 Git 时，需要提醒用户考虑提交。
- 提醒只作为协作提示，不自动提交，除非用户明确要求提交。

## 本地部署

- 每次修改代码并完成构建后，将新版本复制到本地测试/使用 vault 的插件目录。
- 当前固定同步目标：
  - `K:\Project\Github_mandolin\obsidian-html-v-editor\.test-vault\.obsidian\plugins\html-v-editor`
  - `I:\AI\Secret汇集区\.obsidian\plugins\html-v-editor`
  - `K:\DOC_workspace\.obsidian\plugins\html-v-editor`
- 使用 `npm run copy:local` 时，通过 `OBSIDIAN_PLUGIN_DIR` 分别指定上述目标。

## 工作日志

- 每次对话结束前，在项目下 `ai/codex/chatlog/{date}/` 记录本轮工作日志。
- 日志文件名格式为 `{本次会话简述(10字以内)}-{time}.md`。
- 日志内容应尽量逐条记录可公开的工作过程、关键取舍、文件改动和执行命令。
- 不记录或公开不可披露的私有思考链；如需表达推理过程，使用可审阅的工作说明、决策依据和结果摘要。
- 每次最终回复中给出当前日志文件链接，方便用户打开查看。

## 注释语言

- 新增代码块、新文件，或调整旧代码时，尽量添加简洁中文注释。
- 注释应解释意图、边界或复杂逻辑，避免重复描述代码表面含义。
- 后续如项目升级为多语言注释机制，再按新方案调整。

## 文档语言

- 除了与最终提交 Obsidian 插件市场密切相关、需要同步英文版的材料外，项目文档目前统一使用中文。
- 新增规划、说明、测试记录、阶段总结时默认使用中文。
