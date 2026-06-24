export interface HtmlEmbedSpec {
  linktext: string;
  width?: number;
  height?: number;
}

export function parseHtmlEmbedText(value: string | null): HtmlEmbedSpec | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const wikiMatch = trimmed.match(/^!?\[\[(.+?)]]$/);
  const raw = wikiMatch?.[1] ?? trimmed;
  const [rawLinktext, ...rawParams] = raw.split("|");
  const linktext = rawLinktext?.split("#")[0]?.trim();

  if (!linktext || !/\.(html|htm)$/i.test(linktext)) {
    return null;
  }

  return {
    linktext,
    ...parseEmbedDimensions(rawParams.join("|"))
  };
}

export function parseEmbedDimensions(value: string | undefined): Pick<HtmlEmbedSpec, "width" | "height"> {
  if (!value) {
    return {};
  }

  const normalized = value.trim().toLowerCase();
  const sizeMatch = normalized.match(/^(\d{2,5})(?:\s*x\s*(\d{2,5}))?$/);
  if (!sizeMatch) {
    return {};
  }

  return {
    width: Number(sizeMatch[1]),
    height: sizeMatch[2] ? Number(sizeMatch[2]) : undefined
  };
}

export function applyEmbedDimensions(el: HTMLElement, spec: Pick<HtmlEmbedSpec, "width" | "height">): void {
  el.removeClass("html-v-has-embed-width");
  el.removeClass("html-v-has-embed-height");
  el.style.removeProperty("--html-v-embed-width");
  el.style.removeProperty("--html-v-embed-height");

  if (spec.width) {
    el.addClass("html-v-has-embed-width");
    el.style.setProperty("--html-v-embed-width", `${spec.width}px`);
    el.style.width = `${spec.width}px`;
    el.style.maxWidth = "100%";
  }

  if (spec.height) {
    el.addClass("html-v-has-embed-height");
    el.style.setProperty("--html-v-embed-height", `${spec.height}px`);
    el.style.height = `${spec.height}px`;
  }
}
