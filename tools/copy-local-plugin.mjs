import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const pluginDir = process.env.OBSIDIAN_PLUGIN_DIR;

if (!pluginDir) {
  console.error("Set OBSIDIAN_PLUGIN_DIR to your vault plugin path, for example:");
  console.error("OBSIDIAN_PLUGIN_DIR=C:\\\\Vault\\\\.obsidian\\\\plugins\\\\html-v-editor npm run copy:local");
  process.exit(1);
}

const root = process.cwd();
const target = path.resolve(pluginDir);
const files = ["main.js", "manifest.json", "styles.css"];

await mkdir(target, { recursive: true });

for (const file of files) {
  await copyFile(path.join(root, file), path.join(target, file));
  console.log(`Copied ${file} -> ${target}`);
}

await rm(path.join(target, "hugerte"), { recursive: true, force: true });
console.log(`Removed legacy hugerte assets from ${target}`);
