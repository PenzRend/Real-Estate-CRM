// Spreadsheet columns → listing fields, for an agent bringing their listings
// over from another CRM or their own Excel: a guess from the header (Hungarian
// or English) that the agent can change, and each row turned into a listing.
// Pure, so it is tested.

import type { Extras } from "@/lib/properties/extras";
import { parseMoney } from "./clients";

export const LISTING_ROLES = [
  "skip",
  "title",
  "reference",
  "type",
  "listing_type",
  "status",
  "city",
  "district",
  "address",
  "postal_code",
  "price",
  "area",
  "rooms",
  "bedrooms",
  "bathrooms",
  "floor",
  "building_type",
  "condition",
  "energy",
  "balcony",
  "garden",
  "parking",
  "elevator",
  "heating",
  "year_built",
  "common_cost",
  "description",
  "notes",
] as const;
export type ListingRole = (typeof LISTING_ROLES)[number];

export const listingRoleLabels: Record<ListingRole, string> = {
  skip: "Kihagyás",
  title: "Megnevezés",
  reference: "Azonosító",
  type: "Típus (lakás, ház…)",
  listing_type: "Eladó / kiadó",
  status: "Státusz",
  city: "Város",
  district: "Kerület / városrész",
  address: "Cím",
  postal_code: "Irányítószám",
  price: "Ár",
  area: "Alapterület (m²)",
  rooms: "Szobák",
  bedrooms: "Hálószobák",
  bathrooms: "Fürdőszobák",
  floor: "Emelet",
  building_type: "Épület típusa",
  condition: "Állapot",
  energy: "Energetikai besorolás",
  balcony: "Erkély / terasz",
  garden: "Kert",
  parking: "Parkolás",
  elevator: "Lift",
  heating: "Fűtés",
  year_built: "Építés éve",
  common_cost: "Közös költség",
  description: "Hirdetés szövege",
  notes: "Belső megjegyzés",
};

type PropertyType = "apartment" | "house" | "plot" | "commercial" | "other";
type Status = "draft" | "active" | "reserved" | "under_negotiation" | "sold" | "rented" | "inactive";

export type ListingDraft = {
  title: string;
  reference_number: string | null;
  property_type: PropertyType;
  listing_type: "sale" | "rent";
  status: Status;
  city: string | null;
  district: string | null;
  address: string | null;
  postal_code: string | null;
  price: number | null;
  currency: "HUF" | "EUR";
  area_sqm: number | null;
  room_count: number | null;
  bedroom_count: number | null;
  bathroom_count: number | null;
  floor: string | null;
  building_type: string | null;
  condition: string | null;
  energy_rating: string | null;
  has_balcony: boolean | null;
  has_garden: boolean | null;
  has_parking: boolean | null;
  description: string | null;
  internal_notes: string | null;
  features: Extras;
};

const fold = (s: string) =>
  s
    .replace(/²/g, "2")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Order matters: the more specific hints first ("hálószoba" before "szoba").
const HEADER_HINTS: [ListingRole, RegExp][] = [
  ["reference", /\b(azonosito|hirdetes ?kod|kod|ref|referencia|reference|id|sorszam)\b/],
  ["listing_type", /\b(elado kiado|elado|kiado|ertekesites tipusa|hirdetes tipusa|listing type|sale rent|tranzakcio)\b/],
  ["building_type", /\b(epulet|epulet tipusa|epites modja|building)\b/],
  ["type",/\b(tipus|ingatlan tipus|ingatlantipus|kategoria|property type|type|jelleg)\b/],
  ["status", /\b(statusz|allapot hirdetes|status|aktiv)\b/],
  ["postal_code", /\b(iranyitoszam|irsz|zip|postal|postcode)\b/],
  ["district", /\b(kerulet|varosresz|district|neighbo(u)?rhood)\b/],
  ["city", /\b(varos|telepules|helyseg|city|town)\b/],
  ["address", /\b(cim|utca|hazszam|address|street)\b/],
  ["price", /\b(ar|iranyar|vetelar|berleti dij|price|asking)\b/],
  ["area", /\b(alapterulet|terulet|meret|m2|m²|nm|negyzetmeter|area|size|sqm)\b/],
  ["bedrooms", /\b(haloszoba|halo|bedrooms?)\b/],
  ["bathrooms", /\b(furdo|furdoszoba|bathrooms?)\b/],
  ["rooms", /\b(szoba|szobaszam|szobak|rooms?)\b/],
  ["floor", /\b(emelet|szint|floor)\b/],
  ["condition", /\b(allapot|allapota|condition)\b/],
  ["energy", /\b(energetika|energetikai|energia|energy)\b/],
  ["balcony", /\b(erkely|terasz|loggia|balcony|terrace)\b/],
  ["garden", /\b(kert|garden)\b/],
  ["parking", /\b(parkolas|parkolo|garazs|beallo|parking|garage)\b/],
  ["elevator", /\b(lift|elevator)\b/],
  ["heating", /\b(futes|heating)\b/],
  ["year_built", /\b(epitesi ev|epites eve|evjarat|epult|year built|built)\b/],
  ["common_cost", /\b(kozos koltseg|kozos|common cost|hoa)\b/],
  ["description", /\b(leiras|hirdetes szoveg|szoveg|description)\b/],
  ["notes", /\b(megjegyzes|jegyzet|belso|komment|notes?|comment)\b/],
  // Not "név": that is more often the owner's name.
  ["title", /\b(megnevezes|cim sor|title|hirdetes cime|fejlec|targy)\b/],
];

/** A guess for each column; each role (except notes) used once, the first matching column wins. */
export function guessListingRoles(header: string[]): ListingRole[] {
  const taken = new Set<ListingRole>();
  return header.map((h): ListingRole => {
    const f = fold(h);
    // "Hirdetés címe" is the title, not the street address.
    if (/\bhirdetes cime\b/.test(f) && !taken.has("title")) {
      taken.add("title");
      return "title";
    }
    for (const [role, re] of HEADER_HINTS) {
      if (re.test(f) && (role === "notes" || !taken.has(role))) {
        taken.add(role);
        return role;
      }
    }
    return "skip";
  });
}

/** "65", "65 m²", "65,5 nm" → 65.5. */
export function parseNumber(raw: string): number | null {
  const m = /-?\d+(?:[ .]\d{3})*(?:[.,]\d+)?/.exec(raw.replace(/\s+/g, " "));
  if (!m) return null;
  const n = Number(m[0].replace(/ /g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "3", "2,5", "2+1", "2 + 1 fél", "2 szoba + 1 félszoba" → 3, 2.5, 2.5, 2.5, 2.5 (a half room counts half). */
export function parseRooms(raw: string): number | null {
  if (!raw.trim()) return null;
  // On the raw text: folding would drop the "+".
  const plus = /(\d+)[^\d+]*\+\s*(\d+)/.exec(raw);
  if (plus) return Number(plus[1]) + Number(plus[2]) * 0.5;
  const n = parseNumber(raw);
  return n != null && n < 100 ? n : null;
}

/** "van", "igen", "x", "yes", "1" → true; "nincs", "nem", "no", "0" → false; anything else unknown. */
export function parseFlag(raw: string): boolean | null {
  const f = fold(raw);
  if (!f) return null;
  if (/^(nincs|nem|no|false|0|-)$/.test(f)) return false;
  if (/^(van|igen|yes|true|x|1|v)$/.test(f) || /\b(van|igen)\b/.test(f)) return true;
  // A description ("2 db beálló", "déli terasz") means there is one.
  return f.length > 1 ? true : null;
}

export function parsePropertyType(raw: string): PropertyType {
  const f = fold(raw);
  if (!f || /lakas|apartman|tarsashaz|panel|tegla|flat|apartment|condo/.test(f)) return "apartment";
  if (/telek|plot|land|zartkert|kert$/.test(f)) return "plot";
  if (/haz|csaladi|ikerhaz|sorhaz|villa|kuria|tanya|house|home/.test(f)) return "house";
  if (/uzlet|iroda|raktar|ipari|vendeglato|commercial|office|retail|shop/.test(f)) return "commercial";
  return "other";
}

export function parseListingType(raw: string): "sale" | "rent" {
  return /kiado|berl|alberlet|rent|lease/.test(fold(raw)) ? "rent" : "sale";
}

/** No status column: imported listings are the agent's live ones. */
export function parseStatus(raw: string): Status {
  const f = fold(raw);
  if (!f) return "active";
  if (/eladva|elkelt|sold/.test(f)) return "sold";
  if (/kiadva|rented|let$/.test(f)) return "rented";
  if (/foglal|reserved|elojegy/.test(f)) return "reserved";
  if (/targyal|negotiat|ajanlat/.test(f)) return "under_negotiation";
  if (/piszkozat|draft|elokeszit/.test(f)) return "draft";
  if (/inaktiv|archiv|lezart|visszavont|inactive|withdrawn|szunetel/.test(f)) return "inactive";
  return "active";
}

const typeWords: Record<PropertyType, string> = { apartment: "lakás", house: "ház", plot: "telek", commercial: "üzlethelyiség", other: "ingatlan" };

const cut = (s: string, n: number) => (s ? s.slice(0, n) : null);

/** One row → a listing; null when nothing says which property it is (no title, address, place or reference). */
export function rowToListing(row: string[], roles: ListingRole[]): ListingDraft | null {
  const get = (role: ListingRole) =>
    roles
      .map((r, i) => (r === role ? (row[i] ?? "").trim() : ""))
      .filter(Boolean)
      .join(" ");

  const city = get("city");
  const district = get("district");
  const address = get("address");
  const reference = get("reference");
  const property_type = parsePropertyType(get("type"));
  const room_count = parseRooms(get("rooms"));
  const rawTitle = get("title");
  if (!rawTitle && !address && !city && !district && !reference) return null;

  // No title column: "3 szobás lakás – Budapest, XI. kerület", like an ad headline.
  const place = [city, district].filter(Boolean).join(", ");
  const title =
    rawTitle ||
    [room_count != null && property_type !== "plot" ? `${String(room_count).replace(".", ",")} szobás ${typeWords[property_type]}` : typeWords[property_type].replace(/^./, (c) => c.toUpperCase()), place || address]
      .filter(Boolean)
      .join(" – ");

  const priceRaw = get("price");
  const currency = /eur|€/i.test(priceRaw) ? "EUR" : "HUF";
  const listing_type = parseListingType(get("listing_type") || get("type") || priceRaw);
  // parseMoney reads a bare small number as millions; a rent or a euro price is the amount itself.
  const price = (() => {
    if (!priceRaw) return null;
    if (currency === "EUR" || listing_type === "rent") {
      const n = parseNumber(priceRaw);
      const millions = /\b(m|mio|millio)\b/i.test(fold(priceRaw));
      return n == null ? null : Math.round(millions ? n * 1_000_000 : n);
    }
    return parseMoney(priceRaw);
  })();

  const count = (role: ListingRole) => {
    const n = parseNumber(get(role));
    return n != null && n < 100 ? Math.round(n) : null;
  };
  const area = parseNumber(get("area"));

  const features: Extras = {};
  const elevator = parseFlag(get("elevator"));
  if (elevator != null) features.elevator = elevator;
  if (get("heating")) features.heating = get("heating").slice(0, 100);
  const year = parseNumber(get("year_built"));
  if (year != null && year >= 1500 && year <= 2100) features.year_built = Math.round(year);
  const common = get("common_cost") ? parseNumber(get("common_cost")) : null;
  if (common != null && common < 1e7) features.common_cost_huf = Math.round(common);

  const notes = roles
    .map((r, i) => (r === "notes" && row[i]?.trim() ? row[i].trim() : null))
    .filter(Boolean)
    .join("\n");

  return {
    title: title.slice(0, 300),
    reference_number: cut(reference, 100),
    property_type,
    listing_type,
    status: parseStatus(get("status")),
    city: cut(city, 200),
    district: cut(district, 200),
    address: cut(address, 300),
    postal_code: cut(get("postal_code").replace(/\D/g, ""), 10),
    price: price != null && price < 1e13 ? price : null,
    currency,
    area_sqm: area != null && area < 1e6 ? Math.round(area * 100) / 100 : null,
    room_count,
    bedroom_count: count("bedrooms"),
    bathroom_count: count("bathrooms"),
    floor: cut(get("floor"), 50),
    building_type: cut(get("building_type"), 100),
    condition: cut(get("condition"), 100),
    energy_rating: cut(get("energy"), 20),
    has_balcony: parseFlag(get("balcony")),
    has_garden: parseFlag(get("garden")),
    has_parking: parseFlag(get("parking")),
    description: cut(get("description"), 20000),
    internal_notes: notes ? notes.slice(0, 4000) : null,
    features,
  };
}
