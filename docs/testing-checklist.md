# Testing Checklist

Use a disposable vault for manual verification.

## Build

```powershell
npm install
npm run build
npm run release
```

Expected:

- `main.js` exists.
- `manifest.json` exists.
- `styles.css` exists.
- `hugerte/` exists.
- `release/html-v-editor/` exists.
- `release/html-v-editor-0.1.0.zip` exists.

## Local Install

Copy this folder into a test vault:

```text
release/html-v-editor/
```

Target:

```text
<vault>/.obsidian/plugins/html-v-editor/
```

Enable `HTML V Editor` in Obsidian community plugin settings.

## HTML File Editing

Create `sample.html`:

```html
<h1>Hello</h1>
<p>Original</p>
```

Verify:

- Opening `sample.html` uses the HTML V Editor view.
- Preview mode renders the file.
- Edit mode loads HugeRTE.
- Edit mode can switch to TipTap, ProseMirror, and Source.
- Source mode can edit raw HTML.
- Save writes back to `sample.html`.

## Source Backend

Verify:

- Set `Default Source backend` to `CodeMirror`.
- File view Source mode shows a CodeMirror editor with line numbers.
- Switching a modal editor to Source also uses CodeMirror.
- Set `Default Source backend` to `Textarea`.
- File view Source mode and modal Source use a plain textarea.
- Editing and saving work with both backends.

## Preview Security

Create an HTML file containing:

```html
<script>window.test = true;</script>
<iframe srcdoc="<p>frame</p>"></iframe>
<p onclick="alert(1)">click</p>
```

Verify:

- Safe mode removes script, iframe, and event attributes.
- Sandbox mode keeps original HTML but restricts iframe permissions.
- Trusted mode still keeps scripts disabled unless explicitly enabled.

## Trust Rules

Create `.htmlv` at the vault root:

```json
{
  "trust": [
    {
      "scope": "file",
      "pattern": "sample.html",
      "securityLevel": "sandbox"
    }
  ]
}
```

Verify:

- Folder trust files are enabled in settings.
- `sample.html` uses Sandbox rendering even when the global default is Safe.
- Invalid JSON in `.htmlv` does not break plugin loading.

## Markdown `html-v`

Create:

````markdown
```html-v
<section><p>Original block</p></section>
```
````

Verify:

- Reading mode shows an HTML V preview block.
- Edit opens a modal.
- Saving replaces only the code block content.

## HTML File Embed

Create:

```markdown
![[sample.html]]
```

Verify:

- Reading mode shows an HTML V embed preview.
- Refresh rereads the file.
- Edit opens an inline modal and saves changes back to `sample.html`.
- In Live Preview, the embed line is replaced with an HTML V widget when the cursor is outside the line.

## Raw HTML Commands

Create a Markdown file with:

```html
<section>
  <p>Original raw block</p>
</section>
```

Verify:

- `Edit selected HTML with HTML V Editor` replaces the selection.
- `Edit HTML block at cursor with HTML V Editor` replaces the full block.
- If no complete HTML block is found, no document content is changed.
- In Live Preview, a complete closed raw HTML block is replaced with an HTML V widget when the cursor is outside the block.
- The Live Preview widget Source button restores the raw Markdown source focus.
- The Live Preview widget Edit button saves back into the original Markdown range.
