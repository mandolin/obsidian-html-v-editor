import DOMPurify from "dompurify";

import type { HtmlVEditorSettings } from "../settings/settings";

export interface RenderedHtmlPreview {
  html: string;
  sandbox: string;
}

const SAFE_ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
];

const SAFE_ALLOWED_ATTR = [
  "alt",
  "class",
  "colspan",
  "data-checked",
  "height",
  "href",
  "id",
  "rel",
  "rowspan",
  "src",
  "style",
  "target",
  "title",
  "width"
];

export function renderHtmlForPreview(html: string, settings: HtmlVEditorSettings): RenderedHtmlPreview {
  if (settings.defaultSecurityLevel === "safe") {
    return {
      html: sanitizeSafeHtml(html, settings),
      sandbox: ""
    };
  }

  if (settings.defaultSecurityLevel === "trusted") {
    return {
      html,
      sandbox: buildTrustedSandbox(settings)
    };
  }

  return {
    html,
    sandbox: buildSandbox(settings)
  };
}

function sanitizeSafeHtml(html: string, settings: HtmlVEditorSettings): string {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: SAFE_ALLOWED_TAGS,
    ALLOWED_ATTR: SAFE_ALLOWED_ATTR,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["srcdoc"],
    ALLOW_DATA_ATTR: false
  });

  const doc = document.implementation.createHTMLDocument("HTML V Editor Safe Preview");
  doc.body.innerHTML = sanitized;

  for (const element of Array.from(doc.body.querySelectorAll("*"))) {
    removeEventHandlerAttributes(element);
  }

  for (const anchor of Array.from(doc.body.querySelectorAll("a[href]"))) {
    const href = anchor.getAttribute("href");
    if (!isSafeHref(href)) {
      anchor.removeAttribute("href");
    }
    anchor.setAttribute("rel", "noopener noreferrer");
  }

  for (const image of Array.from(doc.body.querySelectorAll("img[src]"))) {
    const src = image.getAttribute("src");
    if (!isSafeImageSrc(src, settings.safeAllowRemoteImages)) {
      image.removeAttribute("src");
    }
  }

  return doc.body.innerHTML;
}

function removeEventHandlerAttributes(element: Element): void {
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.toLowerCase().startsWith("on")) {
      element.removeAttribute(attr.name);
    }
  }
}

function isSafeHref(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("#")
    || normalized.startsWith("/")
    || normalized.startsWith("./")
    || normalized.startsWith("../")
    || normalized.startsWith("http://")
    || normalized.startsWith("https://")
    || normalized.startsWith("mailto:");
}

function isSafeImageSrc(value: string | null, allowRemote: boolean): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("data:image/")) {
    return true;
  }

  if (normalized.startsWith("./") || normalized.startsWith("../") || normalized.startsWith("/") || !normalized.includes(":")) {
    return true;
  }

  return allowRemote && (normalized.startsWith("http://") || normalized.startsWith("https://"));
}

function buildSandbox(settings: HtmlVEditorSettings): string {
  const tokens = new Set<string>();

  if (settings.allowScriptsInSandbox) {
    tokens.add("allow-scripts");
  }

  if (settings.allowSameOriginInSandbox || settings.allowScriptsInSandbox) {
    tokens.add("allow-same-origin");
  }

  if (settings.allowFormsInSandbox) {
    tokens.add("allow-forms");
  }

  if (settings.allowPopupsInSandbox) {
    tokens.add("allow-popups");
    tokens.add("allow-popups-to-escape-sandbox");
  }

  return Array.from(tokens).join(" ");
}

function buildTrustedSandbox(settings: HtmlVEditorSettings): string {
  const tokens = new Set<string>([
    "allow-forms",
    "allow-popups",
    "allow-popups-to-escape-sandbox"
  ]);

  if (settings.trustedAllowScripts) {
    tokens.add("allow-scripts");
  }
  tokens.add("allow-same-origin");

  return Array.from(tokens).join(" ");
}
