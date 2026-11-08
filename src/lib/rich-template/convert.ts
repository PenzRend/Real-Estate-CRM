// The Word-like editor (components/rich-template) works on a document tree;
// what is stored stays the plain template language of
// lib/office-docs/template-render.ts (# headings, **bold**, *italic*,
// - bullets, {fields}, [[AI: …]] paragraphs), so drafting, previews and Word
// files work unchanged. Both directions live here. Pure, so it is tested.

type Mark = { type: "bold" | "italic" };
export type InlineNode =
  | { type: "text"; text: string; marks?: Mark[] }
  | { type: "field"; attrs: { key: string }; marks?: Mark[] }
  | { type: "aiBlock"; attrs: { instruction: string } }
  | { type: "hardBreak" };
type Para = { type: "paragraph"; content?: InlineNode[] };
export type BlockNode = Para | { type: "heading"; attrs: { level: 1 | 2 }; content?: InlineNode[] } | { type: "bulletList"; content: { type: "listItem"; content: Para[] }[] };
export type DocNode = { type: "doc"; content: BlockNode[] };

const AI = /\[\[\s*AI\s*:\s*([\s\S]*?)\]\]/gi;
const TOKEN = /\u0000(\d+)\u0000/;

/** One line (or a paragraph's lines) → inline nodes, with bold/italic marks around text and fields. */
function inline(s: string, ai: string[], marks: Mark[] = []): InlineNode[] {
  const out: InlineNode[] = [];
  const parts = s.split(/(\*\*[^*]+?\*\*|\*[^*\s][^*]*?\*|\{[a-z0-9_]+\}|\u0000\d+\u0000|\n)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p === "\n") out.push({ type: "hardBreak" });
    else if (p.startsWith("**") && p.endsWith("**") && p.length > 4) out.push(...inline(p.slice(2, -2), ai, [...marks, { type: "bold" }]));
    else if (p.startsWith("*") && p.endsWith("*") && p.length > 2 && !p.startsWith("**")) out.push(...inline(p.slice(1, -1), ai, [...marks, { type: "italic" }]));
    else if (/^\{[a-z0-9_]+\}$/.test(p)) out.push({ type: "field", attrs: { key: p.slice(1, -1) }, ...(marks.length ? { marks } : {}) });
    else if (TOKEN.test(p)) out.push({ type: "aiBlock", attrs: { instruction: ai[Number(TOKEN.exec(p)![1])] ?? "" } });
    else out.push({ type: "text", text: p, ...(marks.length ? { marks } : {}) });
  }
  return out;
}

const para = (content: InlineNode[]): Para => (content.length ? { type: "paragraph", content } : { type: "paragraph" });

export function textToDoc(text: string): DocNode {
  const ai: string[] = [];
  const src = text.replace(/\r\n?/g, "\n").replace(AI, (_, instruction: string) => `\u0000${ai.push(instruction.trim()) - 1}\u0000`);
  const blocks: BlockNode[] = [];
  let lines: string[] = [];
  const flush = () => {
    if (lines.length) blocks.push(para(inline(lines.join("\n"), ai)));
    lines = [];
  };
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    const heading = line.startsWith("## ") ? 2 : line.startsWith("# ") ? 1 : null;
    const bullet = /^[-•]\s+/.test(line);
    if (!line || heading || bullet) flush();
    if (heading) blocks.push({ type: "heading", attrs: { level: heading }, content: inline(line.slice(heading + 1), ai) });
    else if (bullet) {
      const item = { type: "listItem" as const, content: [para(inline(line.replace(/^[-•]\s+/, ""), ai))] };
      const last = blocks.at(-1);
      if (last?.type === "bulletList") last.content.push(item);
      else blocks.push({ type: "bulletList", content: [item] });
    } else if (line) lines.push(line);
  }
  flush();
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
}

/** Inline nodes → template text: neighbours with the same marks share one pair of markers, spaces kept outside them. */
function inlineText(nodes: InlineNode[] = []): string {
  const segs: { text: string; b: boolean; i: boolean }[] = [];
  for (const n of nodes) {
    if (n.type === "hardBreak") segs.push({ text: "\n", b: false, i: false });
    else if (n.type === "aiBlock") segs.push({ text: `[[AI: ${n.attrs.instruction.replace(/\]\]/g, "]")}]]`, b: false, i: false });
    else {
      const b = Boolean(n.marks?.some((m) => m.type === "bold"));
      // Bold and italic together is not in the template language: bold wins.
      const i = !b && Boolean(n.marks?.some((m) => m.type === "italic"));
      segs.push({ text: n.type === "field" ? `{${n.attrs.key}}` : n.text, b, i });
    }
  }
  let out = "";
  for (let k = 0; k < segs.length; ) {
    const { b, i } = segs[k];
    let text = "";
    while (k < segs.length && segs[k].b === b && segs[k].i === i) text += segs[k++].text;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
    const marker = b ? "**" : i ? "*" : "";
    out += marker && m[2] ? `${m[1]}${marker}${m[2]}${marker}${m[3]}` : text;
  }
  return out;
}

export function docToText(doc: { type?: string; content?: unknown[] }): string {
  const blocks: string[] = [];
  for (const raw of (doc.content ?? []) as BlockNode[]) {
    if (raw.type === "heading") {
      const t = inlineText(raw.content).replace(/\n/g, " ").trim();
      if (t) blocks.push(`${raw.attrs.level === 1 ? "#" : "##"} ${t}`);
    } else if (raw.type === "bulletList") {
      const items = raw.content.map((li) => `- ${li.content.map((p) => inlineText(p.content).replace(/\n/g, " ").trim()).join(" ")}`).filter((l) => l !== "- ");
      if (items.length) blocks.push(items.join("\n"));
    } else if (raw.type === "paragraph") {
      const t = inlineText(raw.content).trim();
      if (t) blocks.push(t);
    }
  }
  return blocks.join("\n\n");
}
