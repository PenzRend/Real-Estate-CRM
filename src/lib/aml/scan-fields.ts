// What the AI read from an ID document, cleaned up for the identification
// form: names out of capitals, dates as YYYY-MM-DD, "HUN" as "magyar", and
// nothing the form doesn't ask for (never the personal ID number). Pure, so
// it is tested; scan.ts asks the AI.

export type ScanKind = "identity" | "address";

export type ScannedFields = Partial<{
  full_name: string;
  birth_name: string;
  mother_name: string;
  birth_place: string;
  birth_date: string;
  nationality: string;
  document_type: "id_card" | "passport" | "driving_licence";
  document_number: string;
  document_expires_on: string;
  address: string;
  address_card_number: string;
}>;

const NATIONALITIES: Record<string, string> = {
  hun: "magyar",
  hungarian: "magyar",
  magyar: "magyar",
  rou: "román",
  svk: "szlovák",
  srb: "szerb",
  ukr: "ukrán",
  aut: "osztrák",
  deu: "német",
  d: "német",
};

/** "TESZT BALÁZS" → "Teszt Balázs"; "dr. KISS ANNA" → "dr. Kiss Anna"; mixed case is kept. */
export function properName(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  // A lowercase "dr." in front doesn't mean the name itself isn't in capitals.
  const core = s.replace(/^(dr|ifj|id|özv)\.?\s+/i, "");
  if (!core || core !== core.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(/([ -])/)
    .map((w) => (/^(dr|ifj|id|özv)\.?$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

/** "1985.03.17", "1985. 03. 17.", "17.03.1985", "1985-03-17" → "1985-03-17"; null when it isn't a real date. */
export function isoDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*$/.exec(s);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})\D+(\d{1,2})\D+(\d{4})\D*$/.exec(s))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || y < 1900 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : null);

/** The AI's JSON → the form fields it filled. Unknown or empty values are left out. */
export function cleanScan(kind: ScanKind, raw: unknown): ScannedFields {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: ScannedFields = {};
  if (kind === "address") {
    const address = str(r.address, 300);
    if (address) out.address = address;
    const card = str(r.address_card_number, 50)?.replace(/\s/g, "").toUpperCase();
    if (card) out.address_card_number = card;
    return out;
  }
  for (const k of ["full_name", "birth_name", "mother_name"] as const) {
    const v = str(r[k], 200);
    if (v) out[k] = properName(v);
  }
  if (out.birth_name && out.full_name && out.birth_name.toLowerCase() === out.full_name.toLowerCase()) delete out.birth_name;
  const place = str(r.birth_place, 200);
  if (place) out.birth_place = properName(place);
  const birth = isoDate(r.birth_date);
  if (birth) out.birth_date = birth;
  const nat = str(r.nationality, 100);
  if (nat) out.nationality = NATIONALITIES[nat.toLowerCase()] ?? nat.toLowerCase();
  const type = r.document_type;
  if (type === "id_card" || type === "passport" || type === "driving_licence") out.document_type = type;
  const number = str(r.document_number, 50)?.replace(/\s/g, "").toUpperCase();
  if (number) out.document_number = number;
  const expires = isoDate(r.document_expires_on);
  if (expires) out.document_expires_on = expires;
  return out;
}
