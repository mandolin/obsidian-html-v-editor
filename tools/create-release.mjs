import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const releaseRoot = path.join(root, "release");
const packageDir = path.join(releaseRoot, manifest.id);
const zipPath = path.join(releaseRoot, `${manifest.id}-${manifest.version}.zip`);
const files = ["main.js", "manifest.json", "styles.css", "hugerte"];

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });

for (const file of files) {
  await cp(path.join(root, file), path.join(packageDir, file), {
    recursive: true
  });
}

await writeFile(
  path.join(releaseRoot, "INSTALL.txt"),
  [
    "HTML V Editor 本地安装",
    "",
    `版本：${manifest.version}`,
    "",
    "将 html-v-editor 文件夹复制到：",
    "",
    "<your-vault>/.obsidian/plugins/html-v-editor/",
    "",
    "然后在 Obsidian 社区插件设置中启用 HTML V Editor。",
    ""
  ].join("\n"),
  "utf8"
);

await execFileAsync("powershell", [
  "-NoProfile",
  "-Command",
  `Compress-Archive -LiteralPath '${packageDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
]);

console.log(`Created ${packageDir}`);
console.log(`Created ${zipPath}`);
