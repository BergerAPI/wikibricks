import MarkdownIt from "markdown-it";

// User descriptions never enable raw HTML or embedded remote images.
const markdown = new MarkdownIt("commonmark", {
  html: false,
  breaks: true,
  xhtmlOut: false,
})
  .enable("strikethrough")
  .disable("image");

type Env = { link?: (href: string) => string };

// Links within the site are stored without a language, the page that shows them fills it in.
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const { link } = (env ?? {}) as Env;
  const href = tokens[index].attrGet("href");
  if (link && typeof href === "string" && href.startsWith("/")) tokens[index].attrSet("href", link(href));
  return self.renderToken(tokens, index, options);
};

export const renderMarkdown = (source: string, link?: Env["link"]) => markdown.render(source, { link });

/**
 * The start of a description as plain text, for search results and link previews.
 */
export const summarize = (source: string, length = 160) => {
  const text = source
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
};

export function renderMarkdownBlocks(source: string) {
  const env = {};
  const tokens = markdown.parse(source, env);
  const blocks: { html: string; inline?: { html: string; text?: string }[] }[] = [];
  let start = 0;

  for (const [end, token] of tokens.entries()) {
    if (token.level !== 0 || token.nesting === 1) continue;

    const children = token.type === "paragraph_close" ? tokens[start + 1]?.children : null;
    blocks.push({
      html: markdown.renderer.render(tokens.slice(start, end + 1), markdown.options, env),
      inline: children?.map((child) => ({
        html: markdown.renderer.renderInline([child], markdown.options, env),
        text: child.type === "text" ? child.content : undefined,
      })),
    });
    start = end + 1;
  }
  return blocks;
}
