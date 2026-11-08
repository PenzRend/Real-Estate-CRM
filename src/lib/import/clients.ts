// Spreadsheet columns → client fields: a guess from the header (Hungarian or
// English) and the values, which the agent can change before importing; and
// each row turned into a client. Pure, so it is tested.

export const ROLES = ["skip", "name", "first_name", "last_name", "phone", "email", "type", "budget", "budget_min", "budget_max", "locations", "notes", "source"] as const;
export type Role = (typeof ROLES)[number];

export const roleLabels: Record<Role, string> = {
  skip: "Kihagyás",
  name: "Név",
  first_name: "Keresztnév",
  last_name: "Vezetéknév",
  phone: "Telefon",
  email: "E-mail",
  type: "Típus (vevő, eladó…)",
  budget: "Keret (pl. 40–60M)",
  budget_min: "Keret – minimum",
  budget_max: "Keret – maximum",
  locations: "Keresett helyek",
  notes: "Megjegyzés",
  source: "Forrás",
};

export type ClientDraft = {
  full_name: string;
  phone: string | null;
  email: string | null;
  client_type: "buyer" | "seller" | "owner" | "investor" | "tenant" | "other";
  budget_min: number | null;
  budget_max: number | null;
  preferred_locations: string[];
  notes: string | null;
  lead_source: string | null;
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const HEADER_HINTS: [Role, RegExp][] = [
  ["first_name", /^(keresztnev|utonev|first name|given name|firstname)$/],
  ["last_name", /^(vezeteknev|csaladnev|last name|surname|family name|lastname)$/],
  ["name", /\b(nev|teljes nev|ugyfel|name|full name|kapcsolattarto|contact)\b/],
  ["phone", /\b(telefon|tel|mobil|telefonszam|phone|mobile|cell)\b/],
  ["email", /\b(e ?mail|email cim|mail)\b/],
  ["type", /\b(tipus|ugyfeltipus|szerep|kategoria|type|role)\b/],
  ["budget_min", /\b(min|minimum|tol|keret min|ar min)\b/],
  ["budget_max", /\b(max|maximum|ig|keret max|ar max)\b/],
  ["budget", /\b(keret|budget|ar|arkategoria|penz|osszeg)\b/],
  ["locations", /\b(hely|helyszin|kerulet|varos|telepules|terulet|location|area|city|district)\b/],
  ["notes", /\b(megjegyzes|jegyzet|komment|leiras|note|notes|comment|igeny)\b/],
  ["source", /\b(forras|honnan|source|lead)\b/],
];

/** A guess for each column; each role (except notes) used once, the first matching column wins. */
export function guessRoles(header: string[], sample: string[][] = []): Role[] {
  const taken = new Set<Role>();
  const roles = header.map((h): Role => {
    const f = fold(h);
    for (const [role, re] of HEADER_HINTS) {
      if (re.test(f) && (role === "notes" || !taken.has(role))) {
        taken.add(role);
        return role;
      }
    }
    return "skip";
  });
  // Unlabelled columns: recognise phones and emails by their values.
  header.forEach((_, i) => {
    if (roles[i] !== "skip") return;
    const values = sample.map((r) => r[i] ?? "").filter(Boolean);
    if (!values.length) return;
    if (!taken.has("email") && values.every((v) => /@/.test(v))) {
      roles[i] = "email";
      taken.add("email");
    } else if (!taken.has("phone") && values.every((v) => /^[+\d][\d\s()/-]{6,}$/.test(v))) {
      roles[i] = "phone";
      taken.add("phone");
    }
  });
  return roles;
}

/** "50M", "50 millió", "50 000 000 Ft", "49,9 M" → forints; null for anything else. A bare small number is millions. */
export function parseMoney(raw: string): number | null {
  // Accents and case only: the decimal comma and thousands dots must stay.
  const s = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ft\.?|huf|forint/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  const m = /^(\d+(?:[ .]\d{3})*(?:[.,]\d+)?)\s*(m|mio|millio|e|ezer|k)?$/.exec(s.replace(/(\d) (?=\d{3}\b)/g, "$1 "));
  if (!m) return null;
  const n = Number(m[1].replace(/ /g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const unit = m[2];
  if (unit === "m" || unit === "mio" || unit === "millio") return Math.round(n * 1_000_000);
  if (unit === "e" || unit === "ezer" || unit === "k") return Math.round(n * 1000);
  return n < 10_000 ? Math.round(n * 1_000_000) : Math.round(n);
}

/** "40–60M", "40-60 millió", "max 60M", "60M-ig" → [min, max]. */
export function parseBudget(raw: string): [number | null, number | null] {
  const s = raw.trim();
  if (!s) return [null, null];
  const range = /^(.+?)\s*(?:-|–|—|tól|tol)\s*(.+?)(?:ig)?$/i.exec(s);
  if (range) {
    const unit = /(m|millió|millio|mio)\s*(ft)?\s*$/i.exec(range[2])?.[1] ?? "";
    const a = parseMoney(/[a-z]/i.test(range[1]) ? range[1] : `${range[1]}${unit}`);
    const b = parseMoney(range[2]);
    if (a != null && b != null) return [Math.min(a, b), Math.max(a, b)];
  }
  const f = fold(s);
  if (/^(max|maximum|legfeljebb)\b/.test(f) || /ig$/.test(f)) return [null, parseMoney(s.replace(/^(max\.?|maximum|legfeljebb)\s*/i, "").replace(/-?ig$/i, ""))];
  if (/^(min|minimum|legalabb)\b/.test(f)) return [parseMoney(s.replace(/^(min\.?|minimum|legalább)\s*/i, "")), null];
  return [null, parseMoney(s)];
}

export function parseType(raw: string): ClientDraft["client_type"] {
  const f = fold(raw);
  if (/elad|seller|sell/.test(f)) return "seller";
  if (/tulaj|owner/.test(f)) return "owner";
  if (/befekt|invest/.test(f)) return "investor";
  if (/berlo|tenant|renter|alberl/.test(f)) return "tenant";
  if (/vevo|vasarlo|buyer|vasarol|kereso/.test(f) || !f) return "buyer";
  return "other";
}

const cleanEmail = (s: string) => {
  const m = /[\w.+-]+@[\w-]+(\.[\w-]+)+/.exec(s);
  return m ? m[0].toLowerCase() : null;
};

/** One row → a client; null when it has neither a name nor a phone or email to tell who it is. */
export function rowToClient(row: string[], roles: Role[]): ClientDraft | null {
  const get = (role: Role) =>
    roles
      .map((r, i) => (r === role ? (row[i] ?? "").trim() : ""))
      .filter(Boolean)
      .join(" ");
  // Hungarian order: family name first.
  const name = get("name") || [get("last_name"), get("first_name")].filter(Boolean).join(" ");
  const phone = get("phone").split(/[,;/]| vagy /)[0].trim() || null;
  const email = cleanEmail(get("email"));
  const full_name = (name || email?.split("@")[0] || phone || "").slice(0, 200).trim();
  if (!full_name || (!name && !phone && !email)) return null;

  let [budget_min, budget_max] = parseBudget(get("budget"));
  budget_min = parseMoney(get("budget_min")) ?? budget_min;
  budget_max = parseMoney(get("budget_max")) ?? budget_max;
  if (budget_min != null && budget_max != null && budget_min > budget_max) [budget_min, budget_max] = [budget_max, budget_min];

  const notes = roles
    .map((r, i) => (r === "notes" && row[i]?.trim() ? row[i].trim() : null))
    .filter(Boolean)
    .join("\n");
  return {
    full_name,
    phone: phone ? phone.slice(0, 50) : null,
    email,
    client_type: parseType(get("type")),
    budget_min,
    budget_max,
    preferred_locations: get("locations")
      .split(/[,;/]|\bés\b/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 10),
    notes: notes ? notes.slice(0, 4000) : null,
    lead_source: get("source").slice(0, 200) || null,
  };
}
