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
