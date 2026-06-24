# Local Install

HTML V Editor can be installed locally without the Obsidian plugin marketplace.

## Build A Local Package

```powershell
npm install
npm run release
```

This creates:

```text
release/html-v-editor/
release/html-v-editor-0.1.0.zip
```

## Install From Folder

Copy:

```text
release/html-v-editor/
```

to:

```text
<your-vault>/.obsidian/plugins/html-v-editor/
```

Then open Obsidian and enable `HTML V Editor` in community plugin settings.

## Install From Zip

Extract:

```text
release/html-v-editor-0.1.0.zip
```

into:

```text
<your-vault>/.obsidian/plugins/
```

After extraction, this folder should exist:

```text
<your-vault>/.obsidian/plugins/html-v-editor/
```

It must contain:

```text
main.js
manifest.json
styles.css
hugerte/
```
