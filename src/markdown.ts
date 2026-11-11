import MarkdownIt from "markdown-it";

// User descriptions never enable raw HTML or embedded remote images.
const markdown = new MarkdownIt("commonmark", {
  html: false,
  breaks: true,
  xhtmlOut: false,
})
  .enable("strikethrough")
  .disable("image");

export const renderMarkdown = (source: string) => markdown.render(source);

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
