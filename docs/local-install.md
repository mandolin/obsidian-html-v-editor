# 本地安装

HTML V Editor 可以不经过 Obsidian 插件市场，直接本地安装。

## 构建本地包

```powershell
npm install
npm run release
```

命令会生成：

```text
release/html-v-editor/
release/html-v-editor-0.1.0.zip
```

## 从文件夹安装

复制：

```text
release/html-v-editor/
```

到：

```text
<your-vault>/.obsidian/plugins/html-v-editor/
```

然后打开 Obsidian，在社区插件设置中启用 `HTML V Editor`。

## 从 zip 安装

解压：

```text
release/html-v-editor-0.1.0.zip
```

到：

```text
<your-vault>/.obsidian/plugins/
```

解压后应存在：

```text
<your-vault>/.obsidian/plugins/html-v-editor/
```

该目录必须包含：

```text
main.js
manifest.json
styles.css
hugerte/
```
