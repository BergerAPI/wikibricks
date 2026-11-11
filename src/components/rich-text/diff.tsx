import { diffArrays, diffWordsWithSpace } from "diff";
import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { renderMarkdownBlocks } from "../../markdown";

const removedClass = "bg-red-100 text-red-950 line-through";
const addedClass = "bg-green-100 text-green-950 no-underline";

type Block = ReturnType<typeof renderMarkdownBlocks>[number];
const renderBlocks = (blocks: Block[]) => raw(blocks.map((block) => block.html).join(""));

export const DescriptionDiff = ({ before, after, beforeLabel, afterLabel }: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}) => {
  const mark = (value: Child, added: boolean, block = false) => {
    const Tag = added ? "ins" : "del";
    return (
      <Tag class={`${added ? addedClass : removedClass} ${block ? "block" : "mx-px"}`}>
        <span class="sr-only">{added ? afterLabel : beforeLabel}{" "}</span>{value}
      </Tag>
    );
  };

  const diffParagraph = (oldBlock: Block, newBlock: Block) => {
    const before = oldBlock.inline;
    const after = newBlock.inline;
    if (!before || !after || before.length !== after.length) return;

    const parts: Child[] = [];
    for (const [index, oldPart] of before.entries()) {
      const newPart = after[index];
      if (oldPart.text === undefined || newPart.text === undefined) {
        if (oldPart.html !== newPart.html) return;
        parts.push(raw(newPart.html));
        continue;
      }
      const words = diffWordsWithSpace(oldPart.text, newPart.text, { maxEditLength: 512 });
      if (!words) return;
      for (const { added, removed, value } of words) {
        parts.push(added || removed ? mark(value, added) : value);
      }
    }
    return <p>{parts}</p>;
  };

  const oldBlocks = renderMarkdownBlocks(before);
  const newBlocks = renderMarkdownBlocks(after);
  const changes = diffArrays(oldBlocks, newBlocks, {
    comparator: (oldBlock, newBlock) => oldBlock.html === newBlock.html,
    maxEditLength: 256,
  }) ?? [
    { value: oldBlocks, added: false, removed: true },
    { value: newBlocks, added: true, removed: false },
  ];
  const content: Child[] = [];

  for (let index = 0; index < changes.length; index++) {
    const change = changes[index];
    const next = changes[index + 1];
    // When the inline formatting matches, highlight just the changed words inside it.
    if (change.removed && next?.added && change.value.length === next.value.length) {
      change.value.forEach((before, index) => {
        const after = next.value[index];
        const paragraph = diffParagraph(before, after);
        if (paragraph) content.push(paragraph);
        else content.push(mark(raw(before.html), false, true), mark(raw(after.html), true, true));
      });
      index++;
      continue;
    }

    const blocks = renderBlocks(change.value);
    content.push(change.removed || change.added ? mark(blocks, change.added, true) : blocks);
  }
  return <>{content}</>;
};
