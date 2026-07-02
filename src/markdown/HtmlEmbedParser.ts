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
  // 同时兼容 Obsidian wiki embed 和内部直接传入的 linktext/参数片段。
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
  // 支持 `600x400`、`600`、`|600x400` 等更接近 Obsidian embed 的写法。
  const sizeMatch = normalized.match(/(?:^|\s|[|,{])(\d{2,5})(?:\s*x\s*(\d{2,5}))?(?=\s|$|[},])/);
  if (sizeMatch) {
    return {
      width: Number(sizeMatch[1]),
      height: sizeMatch[2] ? Number(sizeMatch[2]) : undefined
    };
  }

  // 也支持 `width=600 height=400`、`w:600 h:400` 等显式参数，便于后续扩展。
  const widthMatch = normalized.match(/(?:^|\s|[,{|])(width|w)\s*[:=]\s*(\d{2,5})(?=\s|$|[},|])/);
  const heightMatch = normalized.match(/(?:^|\s|[,{|])(height|h)\s*[:=]\s*(\d{2,5})(?=\s|$|[},|])/);
  if (!widthMatch && !heightMatch) {
    return {};
  }

  return {
    width: widthMatch ? Number(widthMatch[2]) : undefined,
    height: heightMatch ? Number(heightMatch[2]) : undefined
  };
}

export function applyEmbedDimensions(el: HTMLElement, spec: Pick<HtmlEmbedSpec, "width" | "height">): void {
  el.removeClass("html-v-has-embed-width");
  el.removeClass("html-v-has-embed-height");
  el.style.removeProperty("--html-v-embed-width");
  el.style.removeProperty("--html-v-embed-height");
  el.style.removeProperty("width");
  el.style.removeProperty("height");
  el.style.removeProperty("max-width");

  if (spec.width) {
    el.addClass("html-v-has-embed-width");
    el.style.setProperty("--html-v-embed-width", `${spec.width}px`);
    el.setCssStyles({
      width: `${spec.width}px`,
      maxWidth: "100%"
    });
  }

  if (spec.height) {
    el.addClass("html-v-has-embed-height");
    el.style.setProperty("--html-v-embed-height", `${spec.height}px`);
    el.setCssStyles({
      height: `${spec.height}px`
    });
  }
}
