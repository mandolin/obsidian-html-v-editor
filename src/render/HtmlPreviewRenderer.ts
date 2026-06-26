import { HUGERTE_CHECKLIST_CONTENT_STYLE } from "../editors/HugeRteChecklistPlugin";

export interface PreviewOptions {
  sandbox: string;
  documentBaseUrl?: string;
}

export class HtmlPreviewRenderer {
  private iframe: HTMLIFrameElement | null = null;

  render(container: HTMLElement, html: string, options: PreviewOptions): void {
    container.empty();

    this.iframe = container.createEl("iframe", {
      cls: "html-v-editor-preview-frame"
    });

    if (options.sandbox.trim()) {
      this.iframe.setAttribute("sandbox", options.sandbox);
    }
    this.iframe.srcdoc = addPreviewHeadContent(html, options.documentBaseUrl);
  }

  destroy(): void {
    this.iframe?.remove();
    this.iframe = null;
  }
}

function addPreviewHeadContent(html: string, documentBaseUrl: string | undefined): string {
  const headContent = [
    buildBaseElement(html, documentBaseUrl),
    `<style>${HUGERTE_CHECKLIST_CONTENT_STYLE}</style>`
  ].filter(Boolean).join("");
  if (/<head(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${headContent}`);
  }

  if (/<html(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<html(\s[^>]*)?>/i, (match) => `${match}<head>${headContent}</head>`);
  }

  return `<!doctype html><html><head>${headContent}</head><body>${html}</body></html>`;
}

function buildBaseElement(html: string, documentBaseUrl: string | undefined): string {
  if (!documentBaseUrl || /<base(?:\s|>)/i.test(html)) {
    return "";
  }

  return `<base href="${escapeHtmlAttribute(documentBaseUrl)}">`;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
