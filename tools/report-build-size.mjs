import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const targets = ["main.js", "manifest.json", "styles.css", "hugerte"];

let total = 0;

for (const target of targets) {
  const fullPath = path.join(root, target);
  const size = await getSize(fullPath);
  total += size;
  console.log(`${target.padEnd(16)} ${formatBytes(size)}`);
}

console.log(`${"total".padEnd(16)} ${formatBytes(total)}`);

async function getSize(targetPath) {
  const info = await stat(targetPath);
  if (info.isFile()) {
    return info.size;
  }

  let size = 0;
  const entries = await readdir(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    size += await getSize(path.join(targetPath, entry.name));
  }
  return size;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
