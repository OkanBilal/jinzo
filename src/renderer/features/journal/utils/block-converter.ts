import type { Block } from "@blocknote/core";

export const defaultParagraphProps = {
  backgroundColor: "default" as const,
  textColor: "default" as const,
  textAlignment: "left" as const,
};

export const defaultHeadingProps = {
  backgroundColor: "default" as const,
  textColor: "default" as const,
  textAlignment: "left" as const,
  level: 1 as 1 | 2 | 3,
};

export function blocksToMarkdown(blocks: Block[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    let line = "";
    const content = block.content;

    if (block.type === "heading") {
      const level = (block.props as any)?.level || 1;
      line = "#".repeat(level) + " ";
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === "string") {
          line += item;
        } else if (item && typeof item === "object" && "text" in item) {
          line += (item as any).text || "";
        }
      }
    } else if (typeof content === "string") {
      line += content;
    }

    if (line.trim() || block.type === "paragraph") {
      lines.push(line);
    }

    if (block.children && block.children.length > 0) {
      lines.push(blocksToMarkdown(block.children));
    }
  }

  return lines.join("\n");
}

export function markdownToBlocks(markdown: string): Block[] {
  if (!markdown) {
    return [
      {
        id: crypto.randomUUID(),
        type: "paragraph",
        props: { ...defaultParagraphProps },
        content: [],
        children: [],
      } as Block,
    ];
  }

  const lines = markdown.split("\n");
  const blocks: Block[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      const text = headingMatch[2];
      blocks.push({
        id: crypto.randomUUID(),
        type: "heading",
        props: { ...defaultHeadingProps, level },
        content: [{ type: "text", text, styles: {} }],
        children: [],
      } as Block);
    } else {
      blocks.push({
        id: crypto.randomUUID(),
        type: "paragraph",
        props: { ...defaultParagraphProps },
        content: line ? [{ type: "text", text: line, styles: {} }] : [],
        children: [],
      } as Block);
    }
  }

  return blocks.length > 0
    ? blocks
    : [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          props: { ...defaultParagraphProps },
          content: [],
          children: [],
        } as Block,
      ];
}
