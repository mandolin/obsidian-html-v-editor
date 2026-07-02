import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "node_modules", "hugerte");
const targetRoot = path.join(root, "hugerte");
const generatedModulePath = path.join(root, "src", "editors", "generatedHugeRteAssets.ts");

await rm(targetRoot, { recursive: true, force: true });

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

const skinCss = generatedCss.join("\n");
await mkdir(path.dirname(generatedModulePath), { recursive: true });
await writeFile(
  generatedModulePath,
  [
    "// 本文件由 tools/copy-hugerte-assets.mjs 生成，用于让正式发布包不依赖额外的 hugerte/ 目录。",
    "export const HUGERTE_INLINE_SKIN_CSS =",
    `${JSON.stringify(skinCss)};`,
    ""
  ].join("\n"),
  "utf8"
);
console.log(`Generated HugeRTE inline assets -> ${generatedModulePath}`);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
