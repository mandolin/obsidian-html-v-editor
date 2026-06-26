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
    this.iframe.srcdoc = addDocumentBaseUrl(html, options.documentBaseUrl);
  }

  destroy(): void {
    this.iframe?.remove();
    this.iframe = null;
  }
}

function addDocumentBaseUrl(html: string, documentBaseUrl: string | undefined): string {
  if (!documentBaseUrl || /<base(?:\s|>)/i.test(html)) {
    return html;
  }

  const baseEl = `<base href="${escapeHtmlAttribute(documentBaseUrl)}">`;
  if (/<head(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${baseEl}`);
  }

  if (/<html(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<html(\s[^>]*)?>/i, (match) => `${match}<head>${baseEl}</head>`);
  }

  return `<!doctype html><html><head>${baseEl}</head><body>${html}</body></html>`;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
