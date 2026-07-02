# obsidian-html-v-editor

HTML V Editor is an Obsidian plugin for editing and previewing HTML/HTM files inside a vault.

Current status: local-testable MVP plus post-stage-7 feature work. The plugin can open `.html` and `.htm` files in a custom workspace tab with Preview, Edit, Source, and Save controls. Preview mode has configurable security levels and trust rules. Markdown `html-v` fenced code blocks and embedded HTML files can be previewed and edited from Markdown reading or Live Preview surfaces. Plain raw HTML blocks are left to Obsidian by default, with command-based editing still available when explicitly invoked. Editor adapters can be switched at runtime.

## Development

Install dependencies:

```bash
npm install
```

Build the plugin:

```bash
npm run build
```

Build a local release package:

```bash
npm run release
```

Report build artifact sizes:

```bash
npm run size
```

Watch source files during development:

```bash
npm run dev
```

The build outputs `main.js` at the repository root and copies HugeRTE runtime assets into `hugerte/`. Obsidian also needs `manifest.json` and `styles.css`.

## Local Install

Copy these files into your test vault plugin folder:

```text
main.js
manifest.json
styles.css
hugerte/
```

Target folder:

```text
<your-vault>/.obsidian/plugins/html-v-editor/
```

You can also set `OBSIDIAN_PLUGIN_DIR` and run the helper script.

PowerShell example:

```powershell
$env:OBSIDIAN_PLUGIN_DIR = "C:\Path\To\Vault\.obsidian\plugins\html-v-editor"
npm run copy:local
```

After copying, enable `HTML V Editor` in Obsidian's community plugins settings.

Release packages are written to:

```text
release/html-v-editor/
release/html-v-editor-0.1.0.zip
```

See [docs/local-install.md](docs/local-install.md) for the full local install flow and [docs/testing-checklist.md](docs/testing-checklist.md) for manual verification.

## HTML V Tasks

HTML V Tasks 是插件内置的任务面板，用于聚合 HTML checklist、Markdown `html-v` code block checklist，以及普通 Markdown task。

当前支持：

- 按 All / Open / Done 过滤。
- 只查看 HugeRTE / HTML V checklist。
- 只查看当前文件，以及当前 Markdown 文件嵌入的 HTML 文件。
- 按任务来源过滤：HTML file、html-v block、Markdown task。
- 按 `#tag` 和 `#project/name` 过滤。
- 从面板勾选任务，并回写到对应 HTML 文件、`html-v` code block 或 Markdown task 行。
- 大量任务时使用分页渲染，降低面板一次性创建 DOM 的压力。

数据模型和回写边界见 [docs/task-panel-data-model.md](docs/task-panel-data-model.md)。

## Stage 0 Scope

Completed baseline:

- Single-plugin TypeScript project.
- Obsidian `manifest.json` with plugin id `html-v-editor`.
- esbuild production and watch builds.
- Minimal plugin entrypoint that loads, unloads, and exposes a status command.
- Root-level Obsidian plugin artifacts: `main.js`, `manifest.json`, `styles.css`.
- Local copy helper using `OBSIDIAN_PLUGIN_DIR`.

Next stage:

- Prepare marketplace release assets and submission workflow.

## Stage 1 Scope

Completed MVP:

- Registered `HTML_V_EDITOR_VIEW_TYPE`.
- Registered `.html` and `.htm` extensions for the custom view.
- Added command `Open current HTML file with HTML V Editor`.
- Added Preview mode using a sandboxed iframe.
- Added Edit mode using HugeRTE.
- Added Source mode using a textarea.
- Added Save action that writes the current content back to the Obsidian `TFile`.
- Bundled HugeRTE locally and copied its runtime assets during build.

Known limitations:

- HugeRTE is the only visual editor adapter.
- Markdown embeds and Markdown HTML blocks are not implemented yet.

## Preview Security

Preview mode supports three security levels.

`Safe` is the default. It sanitizes HTML with DOMPurify, removes scripts and embedded frames, blocks event handler attributes, and renders the result in an iframe without script permissions.

`Sandbox` renders the original HTML in a sandboxed iframe. Scripts, same-origin, forms, and popups are controlled by separate settings and are off unless explicitly enabled, except popups which default to on for normal link behavior.

`Trusted` is for content the user explicitly trusts. It still uses an iframe, but allows same-origin, forms, and popups. Script execution remains off by default and must be enabled separately.

The plugin does not use CDN-hosted editor code. HugeRTE and its runtime assets are bundled locally.

## Stage 2 Scope

Completed safety baseline:

- Added plugin settings.
- Added default preview security level.
- Added Safe/Sandbox/Trusted preview modes.
- Added DOMPurify-based Safe sanitizer.
- Added sandbox token controls for scripts, same-origin, forms, and popups.
- Kept script execution disabled by default.
- Documented the security model.

## Stage 3 Scope

Completed Markdown code block support:

- Registered the `html-v` fenced code block processor.
- Renders `html-v` blocks as safe HTML previews in reading mode without plugin chrome.
- Supports inline editing for `html-v` blocks in Live Preview.
- Saves edited HTML back into the original fenced code block from Live Preview.

Example:

````markdown
```html-v
<section>
  <h2>Hello HTML</h2>
</section>
```
````

Optional Live Preview dimensions can be added after the language name:

````markdown
```html-v 800x600
<table><tr><td>Fixed preview area</td></tr></table>
```
````

## Stage 4 Scope

Completed HTML file embeds:

- Detects Markdown internal embeds that point to `.html` or `.htm` files.
- Replaces the embed with an HTML V preview panel in reading mode.
- Renders embedded files with the configured preview security policy.
- Adds `Refresh` and `Edit` buttons to the embed panel.
- Refreshes the embedded preview when the target HTML file changes.
- Edits the target file inline from the embed panel when `Edit` is clicked.

Example:

```markdown
![[example.html]]
```

Live Preview support:

- `![[example.html]]` and `![[example.htm]]` are replaced with rendered editable widgets when Live Preview is active.
- Use `Source` on the widget to return the cursor to the original Markdown line.
- Use `Edit` to edit the external file without opening a separate HTML V Editor tab.

If preview security settings change while an embed is already visible, use `Refresh` or rerender the Markdown preview.

## Stage 5 Scope

Completed command-based raw HTML editing:

- Added command `Edit selected HTML with HTML V Editor`.
- Added command `Edit HTML block at cursor with HTML V Editor`.
- The selected HTML command opens the current selection in a HugeRTE modal and replaces the selection on save.
- The cursor command conservatively detects a complete block-level HTML element around the cursor and replaces that source range on save.
- If no complete block can be found, the command shows a notice and does not edit the file.

Supported cursor-detection tags include common block elements such as `div`, `section`, `article`, `table`, `ul`, `ol`, and related table tags.

Live Preview support:

- Automatic Live Preview widgets are intentionally scoped to `html-v` fenced blocks.
- Plain raw HTML blocks are left to Obsidian's native renderer to avoid compatibility issues with normal Markdown documents.
- Use `Edit selected HTML with HTML V Editor` or `Edit HTML block at cursor with HTML V Editor` when you explicitly want to edit a raw HTML block.

Known limitations:

- Cursor command detection intentionally handles only complete, closed block-level HTML elements.
- It does not attempt to parse arbitrary malformed HTML.

## Stage 6 Scope

Completed editor adapter switching:

- Solidified `HtmlEditorAdapter`.
- Added editor registry.
- HugeRTE remains the default editor.
- Added TipTap and ProseMirror as third-party structured editor adapters.
- Added built-in `Source` adapter as a plain HTML fallback.
- Added setting for default editor.
- File Edit mode can switch between HugeRTE and Source without losing current HTML.
- Modal editors can switch between HugeRTE and Source without losing current HTML.
- `html-v` block editing and raw HTML command editing use the configured default editor.

Current editor adapters:

```text
HugeRTE
TipTap
ProseMirror
Source
```

Future adapters can be added through the registry without changing view or modal orchestration.

## Source Backend

The `Source` editor can use either backend:

- `CodeMirror`: default, richer source editing surface with line numbers and wrapping.
- `Textarea`: minimal native fallback.

This setting applies to the file view `Source` mode and to modal editors whenever the selected editor is `Source`.

## Trust Rules

The default security level is still global, but it can be overridden by trust rules.

Global trust rules are configured in plugin settings as JSON:

```json
[
  {
    "scope": "folder",
    "pattern": "trusted-html",
    "securityLevel": "trusted"
  },
  {
    "scope": "source",
    "pattern": "https://example.com",
    "securityLevel": "sandbox"
  }
]
```

Rules can also live in `.htmlv` files at the vault root or in parent folders:

```json
{
  "trust": [
    {
      "scope": "file",
      "pattern": "trusted-html/report.html",
      "securityLevel": "trusted"
    }
  ]
}
```

Rule scopes:

- `file`: exact vault path match.
- `folder`: applies to the folder and descendants.
- `source`: matches external `http` or `https` origins found in HTML `src` or `href` attributes. Regex patterns may be written as `/pattern/flags`.

Later matching rules override earlier matches. Folder `.htmlv` files are read from vault root to the nearest parent folder, so closer folders can override broader policy.

## Stage 7 Scope

Completed stabilization and local distribution:

- Added `CHANGELOG.md`.
- Added local install documentation.
- Added testing checklist.
- Added `npm run size`.
- Added `npm run release`.
- Release output includes a folder package and zip package.
