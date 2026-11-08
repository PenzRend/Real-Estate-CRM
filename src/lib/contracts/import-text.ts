import PizZip from "pizzip";

// An office's own contract (Word or PDF) as plain text in the template
// language, for the AI to turn into a template. Word keeps its headings,
// bold and list items; a PDF gives its text only. Personal identifiers are
// cut out before anything leaves the server: offices often upload a filled
// contract instead of a blank one.

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;
export const MAX_IMPORT_CHARS = 60_000;

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

/** word/document.xml → text: "#"/"##" for headings, **bold** runs, "- " for list items. */
export function docxText(buf: ArrayBuffer | Uint8Array): string {
  const xml = new PizZip(buf).file("word/document.xml")?.asText();
  if (!xml) throw new Error("not a docx");
  const body = xml.slice(xml.indexOf("<w:body"));
  const out: string[] = [];
  for (const p of body.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? "";
    let text = "";
    for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
      const bold = /<w:b(?: w:val="(?:1|true|on)")?\s*\/>/.test(r);
      let t = "";
      for (const part of r.match(/<w:t[ >][\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? []) {
        if (part === "<w:tab/>") t += "\t";
        else if (part === "<w:br/>") t += "\n";
        else t += decode(part.replace(/<[^>]+>/g, ""));
      }
      text += bold && t.trim() ? `**${t.trim()}**${/\s$/.test(t) ? " " : ""}` : t;
    }
    text = text.replace(/\*\*\*\*/g, "").trim();
    if (!text) {
      out.push("");
      continue;
    }
    const plain = text.replace(/\*\*/g, "");
    if (/^(Title|Cm|Heading1|Cmsor1)$/i.test(style) || /^Heading1|Címsor1/i.test(style)) out.push(`# ${plain}`);
    else if (/Heading[2-9]|Cmsor[2-9]|Címsor[2-9]|Subtitle/i.test(style)) out.push(`## ${plain}`);
    else if (/<w:numPr>/.test(p)) out.push(`- ${text}`);
    else out.push(text);
  }
  return tidy(out.join("\n\n"));
}

/** Blank runs collapsed, at most one empty line between paragraphs. */
function tidy(s: string) {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function pdfText(buf: ArrayBuffer | Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return tidy(text);
}

/** Emails, phone numbers, ID-card and passport numbers, tax and bank account numbers → placeholders. */
export function maskPersonal(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/\bHU\d{2}(?:[ ]?\d{4}){6}\b/g, "[bankszámla]")
    .replace(/\b\d{8}-\d{8}(?:-\d{8})?\b/g, "[bankszámla]")
    .replace(/(?:\+36|\b06)[ \-/]?\(?\d{1,2}\)?[ \-/]?\d{3}[ \-]?\d{3,4}\b/g, "[telefon]")
    .replace(/\b\d{6}[A-Z]{2}\b/g, "[okmány]")
    .replace(/\b[A-Z]{2}\d{6,7}\b/g, "[okmány]")
    .replace(/\b8\d{9}\b/g, "[adóazonosító]");
}

/** Money fields already carry "Ft" (and the _szoveg ones the words too): drop what the AI wrote around them anyway. */
export function tidyMoney(body: string): string {
  const money = "iranyar|vetelar|foglalo|berleti_dij|kaucio";
  return body
    .replace(new RegExp(`\\{(${money})(?:_szoveg)?\\}\\s*(?:Ft|forint)?,?\\s*azaz\\s*\\{\\1(?:_szoveg)?\\}\\s*(?:Ft|forint)?`, "g"), "{$1_szoveg}")
    .replace(new RegExp(`\\{((?:${money})(?:_szoveg)?)\\}\\s+(?:Ft\\.?|forint)(?=[\\s.,;:)]|$)`, "g"), "{$1}");
}
