// Turns the assistant's plain-text answer into blocks the chat can render
// safely (no HTML from the model): paragraphs and bullet lists made of text,
// bold and citation pieces.

export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "cite"; ref: string };
export type Block = { kind: "paragraph"; parts: Inline[] } | { kind: "list"; items: Inline[][] };

export function parseInline(line: string): Inline[] {
  const parts: Inline[] = [];
  // Bold, *emphasis* (shown as plain text), and citations as models write them:
  // [S1], [ S1 ], [S1, S2], [S1; S2], [S1 → requirements].
  const pattern =
    /\*\*(.+?)\*\*|(?<![*\w])\*([^*\n]+?)\*(?![*\w])|\[\s*(S\d+(?:\s*[,;]\s*S\d+)*)[^\]\n]{0,40}\]|\(\s*(?:ref\.?\s*)?(S\d+(?:\s*[,;]\s*S\d+)*)\s*\)/g;
  let last = 0;
  for (const m of line.matchAll(pattern)) {
    if (m.index > last) parts.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[1] != null) parts.push({ kind: "bold", text: m[1] });
    else if (m[2] != null) parts.push({ kind: "text", text: m[2] });
    else for (const ref of (m[3] ?? m[4]).split(/[,;]/)) parts.push({ kind: "cite", ref: ref.trim() });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ kind: "text", text: line.slice(last) });
  return parts;
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function parseAnswer(answer: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", parts: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: "list", items: list.map(parseInline) });
    list = [];
  };
  for (const raw of answer.split("\n")) {
    const line = raw.replace(/^#+\s*/, "").trimEnd(); // headings render as plain lines
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (BULLET.test(line)) {
      flushParagraph();
      list.push(line.replace(BULLET, ""));
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
