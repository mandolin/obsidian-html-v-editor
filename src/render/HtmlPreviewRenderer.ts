export interface PreviewOptions {
  sandbox: string;
}

export class HtmlPreviewRenderer {
  private iframe: HTMLIFrameElement | null = null;

  render(container: HTMLElement, html: string, options: PreviewOptions): void {
    container.empty();

    this.iframe = container.createEl("iframe", {
      cls: "html-v-editor-preview-frame"
    });

    this.iframe.setAttribute("sandbox", options.sandbox);
    this.iframe.srcdoc = html;
  }

  destroy(): void {
    this.iframe?.remove();
    this.iframe = null;
  }
}
