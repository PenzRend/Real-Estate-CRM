import PizZip from "pizzip";

// The document creator's template language, kept small so agents can write
// it without help:
//   # Címsor / ## Alcím       headings
//   (blank line)              a new paragraph
//   - tétel                   a bullet
//   **félkövér**              bold
//   {vevo_nev}                a field from the record (see fields.ts)
//   [[AI: írj egy rövid…]]    a paragraph the AI writes from the record's data
// Pure, so it is tested: fill the fields, then turn the text into blocks for
// the on-screen preview (HTML) or a Word file.

export type Run = { text: string; bold: boolean; italic?: boolean };
export type Block = { type: "h1" | "h2" | "p" | "li"; runs: Run[] };

const AI_BLOCK = /\[\[\s*AI\s*:\s*([\s\S]*?)\]\]/gi;

/** The [[AI: …]] instructions, in order. */
export function aiInstructions(body: string): string[] {
  return [...body.matchAll(AI_BLOCK)].map((m) => m[1].trim()).filter(Boolean);
}

/** {field}s replaced (unknown ones become empty); AI paragraphs from `ai` in order, or a visible placeholder. */
export function fillTemplateText(body: string, values: Record<string, string>, ai?: string[]): string {
  let n = 0;
  return body
    .replace(AI_BLOCK, (_, instruction: string) => {
      const text = ai?.[n++];
      return text ?? `[AI-bekezdés: ${instruction.trim()}]`;
    })
    .replace(/\{([a-z_]+)\}/g, (_, key: string) => values[key] ?? "");
}

function runs(line: string): Run[] {
  const out: Run[] = [];
  const parts = line.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) out.push({ text: p.slice(2, -2), bold: true });
    else if (p.startsWith("*") && p.endsWith("*") && p.length > 2) out.push({ text: p.slice(1, -1), bold: false, italic: true });
    else out.push({ text: p, bold: false });
  }
  return out;
}

/** Filled text → headings, paragraphs (lines joined) and bullets. */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    // Lines inside a paragraph keep their breaks (a signature, an address).
    if (para.length) blocks.push({ type: "p", runs: runs(para.join("\n")) });
    para = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const heading = line.startsWith("## ") ? "h2" : line.startsWith("# ") ? "h1" : null;
    const bullet = /^[-•*]\s+/.test(line);
    if (!line || heading || bullet) flush();
    if (heading) blocks.push({ type: heading, runs: runs(line.slice(heading === "h2" ? 3 : 2)) });
    else if (bullet) blocks.push({ type: "li", runs: runs(line.replace(/^[-•*]\s+/, "")) });
    else if (line) para.push(line);
  }
  flush();
  return blocks;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** For the editor's preview. */
export function toHtml(blocks: Block[]): string {
  const text = (t: string) => esc(t).replace(/\n/g, "<br>");
  const inner = (b: Block) => b.runs.map((r) => (r.bold ? `<strong>${text(r.text)}</strong>` : r.italic ? `<em>${text(r.text)}</em>` : text(r.text))).join("");
  let html = "";
  let inList = false;
  for (const b of blocks) {
    if ((b.type === "li") !== inList) {
      html += inList ? "</ul>" : "<ul>";
      inList = !inList;
    }
    html += b.type === "li" ? `<li>${inner(b)}</li>` : `<${b.type}>${inner(b)}</${b.type}>`;
  }
  if (inList) html += "</ul>";
  return html;
}

const runXml = (r: Run, size: number, bold: boolean) =>
  `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${bold || r.bold ? "<w:b/>" : ""}${r.italic ? "<w:i/>" : ""}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(r.text).replace(/\n/g, '</w:t><w:br/><w:t xml:space="preserve">')}</w:t></w:r>`;

function paragraphXml(b: Block) {
  if (b.type === "h1") return `<w:p><w:pPr><w:spacing w:before="240" w:after="160"/></w:pPr>${b.runs.map((r) => runXml(r, 36, true)).join("")}</w:p>`;
  if (b.type === "h2") return `<w:p><w:pPr><w:spacing w:before="200" w:after="120"/></w:pPr>${b.runs.map((r) => runXml(r, 28, true)).join("")}</w:p>`;
  if (b.type === "li")
    return `<w:p><w:pPr><w:spacing w:after="80"/><w:ind w:left="360" w:hanging="240"/></w:pPr>${runXml({ text: "•\t", bold: false }, 22, false)}${b.runs.map((r) => runXml(r, 22, false)).join("")}</w:p>`;
  return `<w:p><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr>${b.runs.map((r) => runXml(r, 22, false)).join("")}</w:p>`;
}

/** A Word (.docx) file with the blocks, A4, Calibri. */
export function toDocx(blocks: Block[]): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.map(paragraphXml).join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
