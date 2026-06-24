import { cp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "node_modules", "hugerte");
const targetRoot = path.join(root, "hugerte");
const assetDirs = ["icons", "models", "plugins", "skins", "themes"];

await rm(targetRoot, { recursive: true, force: true });

for (const dir of assetDirs) {
  await cp(path.join(sourceRoot, dir), path.join(targetRoot, dir), {
    recursive: true
  });
}

console.log(`Copied HugeRTE assets -> ${targetRoot}`);

const stylesPath = path.join(root, "styles.css");
const generatedStart = "/* HTML V Editor generated HugeRTE CSS start */";
const generatedEnd = "/* HTML V Editor generated HugeRTE CSS end */";
const hugerteCssFiles = [
  path.join(sourceRoot, "skins", "ui", "oxide", "skin.min.css")
];

const currentStyles = await readFile(stylesPath, "utf8");
const strippedStyles = currentStyles.replace(
  new RegExp(`\\n?${escapeRegExp(generatedStart)}[\\s\\S]*?${escapeRegExp(generatedEnd)}\\n?`, "g"),
  "\n"
).trimEnd();
const generatedCss = await Promise.all(hugerteCssFiles.map(async (file) => readFile(file, "utf8")));
await writeFile(
  stylesPath,
  `${strippedStyles}\n\n${generatedStart}\n${generatedCss.join("\n")}\n${generatedEnd}\n`,
  "utf8"
);
console.log("Merged HugeRTE skin CSS -> styles.css");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
