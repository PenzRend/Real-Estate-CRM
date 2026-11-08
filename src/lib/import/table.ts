import PizZip from "pizzip";

// A spreadsheet or contacts file as a table: the first row is the header.
// Excel (.xlsx: its first sheet), CSV (comma or semicolon – Hungarian Excel
// saves with semicolons) and phone contacts (.vcf, exported from iPhone,
// Android or Google Contacts). Read in the browser, so the file never leaves
// the agent's computer until they confirm what to import. Pure, so it is
// tested.

export type Table = { header: string[]; rows: string[][] };

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

/** "C12" → 2 (zero-based column). */
function columnIndex(ref: string) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const tidyRows = (rows: string[][]): Table => {
  const filled = rows.map((r) => r.map((c) => c.replace(/\s+/g, " ").trim())).filter((r) => r.some(Boolean));
  const width = Math.max(0, ...filled.map((r) => r.length));
  const square = filled.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  return { header: square[0] ?? [], rows: square.slice(1) };
};

/** The first worksheet of an .xlsx file. */
export function readXlsx(data: ArrayBuffer | Uint8Array): Table {
  const zip = new PizZip(data);
  const shared = (zip.file("xl/sharedStrings.xml")?.asText() ?? "").match(/<si>[\s\S]*?<\/si>/g) ?? [];
  const strings = shared.map((si) => decodeXml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("")));
  // The first sheet in the workbook's order.
  const rels = zip.file("xl/_rels/workbook.xml.rels")?.asText() ?? "";
  const firstId = /<sheet [^>]*r:id="([^"]+)"/.exec(zip.file("xl/workbook.xml")?.asText() ?? "")?.[1];
  const target = firstId ? new RegExp(`Id="${firstId}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`Target="([^"]+)"[^>]*Id="${firstId}"`).exec(rels)?.[1] : null;
  const path = target ? `xl/${target.replace(/^\/?xl\//, "")}` : "xl/worksheets/sheet1.xml";
  const sheet = zip.file(path)?.asText() ?? zip.file("xl/worksheets/sheet1.xml")?.asText();
  if (!sheet) throw new Error("no sheet");

  const rows: string[][] = [];
  for (const row of sheet.match(/<row[^>]*>[\s\S]*?<\/row>|<row[^>]*\/>/g) ?? []) {
    const cells: string[] = [];
    for (const c of row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = /r="([A-Z]+\d+)"/.exec(c)?.[1] ?? "";
      const type = /t="([^"]+)"/.exec(c)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1];
      const inline = /<is>([\s\S]*?)<\/is>/.exec(c)?.[1];
      let value = "";
      if (type === "s" && v != null) value = strings[Number(v)] ?? "";
      else if (type === "inlineStr" && inline) value = decodeXml(inline.replace(/<[^>]+>/g, ""));
      else if (v != null) value = decodeXml(v);
      cells[ref ? columnIndex(ref) : cells.length] = value;
    }
    rows.push(Array.from(cells, (x) => x ?? ""));
  }
  return tidyRows(rows);
}

/** CSV with comma, semicolon or tab, quotes and line breaks inside quotes. */
export function readCsv(text: string): Table {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return tidyRows(rows);
}

/** Phone contacts: one row per card with name, phone, email and note. */
export function readVcf(text: string): Table {
  // Folded lines (continuation lines start with a space) are joined first.
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const rows: string[][] = [];
  let card: { name: string; phone: string; email: string; note: string; org: string } | null = null;
  const value = (line: string) =>
    line
      .slice(line.indexOf(":") + 1)
      .replace(/\\n/g, " ")
      .replace(/\\([,;\\])/g, "$1")
      .trim();
  for (const line of lines) {
    const key = line.split(/[;:]/, 1)[0].toUpperCase();
    if (key === "BEGIN") card = { name: "", phone: "", email: "", note: "", org: "" };
    else if (key === "END" && card) {
      if (card.name || card.phone) rows.push([card.name, card.phone, card.email, card.org, card.note]);
      card = null;
    } else if (card) {
      if (key === "FN") card.name = value(line);
      else if (key === "N" && !card.name) {
        const [family, given] = value(line).split(";");
        card.name = [family, given].filter(Boolean).join(" ");
      } else if (key === "TEL" && !card.phone) card.phone = value(line);
      else if (key === "EMAIL" && !card.email) card.email = value(line);
      else if (key === "NOTE") card.note = value(line);
      else if (key === "ORG") card.org = value(line).replace(/;+$/, "");
    }
  }
  return { header: ["Név", "Telefon", "E-mail", "Cég", "Megjegyzés"], rows };
}

export function readTable(fileName: string, data: ArrayBuffer): Table {
  const name = fileName.toLowerCase();
  if (name.endsWith(".xlsx")) return readXlsx(data);
  const text = new TextDecoder("utf-8").decode(data);
  if (name.endsWith(".vcf") || /^BEGIN:VCARD/im.test(text.slice(0, 200))) return readVcf(text);
  // A CSV saved by an older Excel may be in Windows-1250 (Central European): fix the accents.
  const csv = text.includes("�") ? new TextDecoder("windows-1250").decode(data) : text;
  return readCsv(csv);
}
