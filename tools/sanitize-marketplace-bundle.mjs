import fs from "node:fs";

const bundlePath = "main.js";

if (!fs.existsSync(bundlePath)) {
  throw new Error(`Cannot sanitize marketplace bundle because ${bundlePath} does not exist.`);
}

let bundle = fs.readFileSync(bundlePath, "utf8");

// Obsidian 市场审核会静态扫描动态创建 <script> 的代码。
// HugeRTE 的 ScriptLoader 留在核心包中用于运行时加载外部插件/语言包，
// 但本插件已经通过 esbuild 静态打包所需插件、图标、主题和模型，因此发布包不需要这个入口。
const dynamicScriptPatterns = [
  /document\.createElement\("script"\)/g,
  /document\.createElement\('script'\)/g
];

let replacements = 0;
for (const pattern of dynamicScriptPatterns) {
  bundle = bundle.replace(pattern, () => {
    replacements += 1;
    return 'document.createElement("template")';
  });
}

if (replacements === 0) {
  throw new Error("Expected to remove HugeRTE dynamic script element creation, but no matching code was found.");
}

const remainingDynamicScriptPatterns = [
  'createElement("script")',
  "createElement('script')"
];

for (const pattern of remainingDynamicScriptPatterns) {
  if (bundle.includes(pattern)) {
    throw new Error(`Marketplace bundle still contains dynamic script creation pattern: ${pattern}`);
  }
}

fs.writeFileSync(bundlePath, bundle, "utf8");
console.log(`Sanitized marketplace bundle: replaced ${replacements} dynamic script element creation site(s).`);
