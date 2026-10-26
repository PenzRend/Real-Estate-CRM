// Client ↔ property matching with transparent, rule-based reasons.
// No AI and no percentages: each requirement is checked and labelled, and the
// overall category follows from those labels so an agent can see why.
import { locationKey } from "@/lib/capture/review";
import { formatArea, formatNumber, formatPriceShort } from "@/lib/i18n/format";
import { propertyTypeLabels } from "@/lib/i18n/labels";

export type MatchClient = {
  id: string;
  full_name: string;
  client_type: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_locations: string[];
  preferred_property_types: string[];
  min_rooms: number | null;
  min_bedrooms: number | null;
  min_area_sqm: number | null;
  max_area_sqm: number | null;
  other_requirements: string | null;
};

export type MatchProperty = {
  id: string;
  title: string;
  listing_type: "sale" | "rent";
  property_type: string;
  status: string;
  city: string | null;
  district: string | null;
  price: number | null;
  currency: "HUF" | "EUR";
  area_sqm: number | null;
  room_count: number | null;
  bedroom_count: number | null;
  has_balcony: boolean | null;
  has_garden: boolean | null;
  has_parking: boolean | null;
  owner_client_id?: string | null;
};

/** met: fits · close: slightly outside, worth a look · miss: does not fit · unknown: the listing lacks the data */
export type CheckStatus = "met" | "close" | "miss" | "unknown";
export type Check = { key: string; label: string; status: CheckStatus; detail: string; hard: boolean };
export type MatchCategory = "strong" | "good" | "possible";
export type Match = { category: MatchCategory; checks: Check[]; metCount: number };

export const categoryLabels: Record<MatchCategory, string> = {
  strong: "Erős egyezés",
  good: "Jó egyezés",
  possible: "Lehetséges",
};

/** Buyers and investors look for listings for sale, tenants for rentals; sellers and owners are not matched. */
export function wantedListingType(clientType: string): "sale" | "rent" | null {
  if (clientType === "buyer" || clientType === "investor") return "sale";
  if (clientType === "tenant") return "rent";
  return null;
}

const CLOSE = 0.1; // 10% outside a range still counts as "close"

function rangeCheck(value: number, min: number | null, max: number | null): CheckStatus {
  if ((min == null || value >= min) && (max == null || value <= max)) return "met";
  if ((min == null || value >= min * (1 - CLOSE)) && (max == null || value <= max * (1 + CLOSE))) return "close";
  return "miss";
}

function rangeText(min: number | null, max: number | null, fmt: (n: number) => string) {
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  return min != null ? `min. ${fmt(min)}` : `max. ${fmt(max!)}`;
}

/** Does the listing's place match one of the client's wished places? */
function locationMatches(wanted: string, p: MatchProperty) {
  const want = locationKey(wanted);
  const isBudapestOnly = !want && /budapest/i.test(wanted);
  const city = locationKey(p.city ?? "");
  const district = locationKey(p.district ?? "");
  const cityIsBudapest = /budapest/i.test(p.city ?? "");
  if (isBudapestOnly) return cityIsBudapest;
  if (!want) return false;
  // "Budapest XI." → "xi" must equal the district key; "Budaörs" → "budaors" may match the city or the district.
  return want === district || want === city || (district !== "" && district.split(" ").includes(want));
}

// Feature wishes are read from the free-text requirements ("Erkély fontos; Parkoló kérdéses").
const FEATURES = [
  { key: "balcony", label: "Erkély / terasz", words: /erkely|terasz|loggia/, field: "has_balcony" as const },
  { key: "garden", label: "Kert", words: /kert(?!varos)/, field: "has_garden" as const },
  { key: "parking", label: "Parkolás", words: /parkol|garazs|beallo/, field: "has_parking" as const },
];
const NOT_WANTED = /kerdeses|nem (kell|fontos|szukseges)|mindegy|nem tudja/;

export function wantedFeatures(otherRequirements: string | null) {
  if (!otherRequirements) return [];
  const parts = otherRequirements
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[;,\n]/);
  return FEATURES.filter((f) => parts.some((part) => f.words.test(part) && !NOT_WANTED.test(part)));
}

/**
 * Checks one client against one listing. Returns null when the pair should
 * not be shown: wrong listing type, a hard requirement clearly missed, or the
 * client has no requirement to match on.
 */
export function matchClientToProperty(c: MatchClient, p: MatchProperty): Match | null {
  // Never offer someone their own property.
  if (p.owner_client_id && p.owner_client_id === c.id) return null;
  const wanted = wantedListingType(c.client_type);
  if (!wanted || p.listing_type !== wanted) return null;

  const checks: Check[] = [];

  if (c.budget_min != null || c.budget_max != null) {
    const budget = rangeText(c.budget_min, c.budget_max, formatPriceShort);
    if (p.price == null) checks.push({ key: "price", label: "Ár", status: "unknown", detail: "Nincs ár megadva", hard: true });
    else if (p.currency !== "HUF") checks.push({ key: "price", label: "Ár", status: "unknown", detail: "Az ár nem forintban van", hard: true });
    else {
      const status = rangeCheck(p.price, c.budget_min, c.budget_max);
      const detail =
        status === "met" ? `${formatPriceShort(p.price)} – belefér (${budget})`
        : status === "close" ? `${formatPriceShort(p.price)} – kicsit kilóg (${budget})`
        : `${formatPriceShort(p.price)} – nem fér bele (${budget})`;
      checks.push({ key: "price", label: "Ár", status, detail, hard: true });
    }
  }

  if (c.preferred_locations.length) {
    const place = [p.city, p.district].filter(Boolean).join(", ");
    if (!place) checks.push({ key: "location", label: "Helyszín", status: "unknown", detail: "Nincs helyszín megadva", hard: true });
    else {
      const hit = c.preferred_locations.find((l) => locationMatches(l, p));
      checks.push({
        key: "location",
        label: "Helyszín",
        status: hit ? "met" : "miss",
        detail: hit ? `${place} – keresett helyszín` : `${place} – nem a keresett helyek egyike (${c.preferred_locations.join(", ")})`,
        hard: true,
      });
    }
  }

  if (c.preferred_property_types.length) {
    const ok = c.preferred_property_types.includes(p.property_type);
    const label = propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels] ?? p.property_type;
    checks.push({ key: "type", label: "Típus", status: ok ? "met" : "miss", detail: ok ? label : `${label} – nem ezt keresi`, hard: true });
  }

  if (c.min_rooms != null) {
    checks.push(
      p.room_count == null
        ? { key: "rooms", label: "Szobák", status: "unknown", detail: "Nincs szobaszám megadva", hard: false }
        : {
            key: "rooms",
            label: "Szobák",
            status: p.room_count >= c.min_rooms ? "met" : p.room_count >= c.min_rooms - 0.5 ? "close" : "miss",
            detail: `${formatNumber(p.room_count)} szoba (min. ${formatNumber(c.min_rooms)})`,
            hard: false,
          },
    );
  }

  if (c.min_bedrooms != null) {
    checks.push(
      p.bedroom_count == null
        ? { key: "bedrooms", label: "Hálószobák", status: "unknown", detail: "Nincs megadva", hard: false }
        : {
            key: "bedrooms",
            label: "Hálószobák",
            status: p.bedroom_count >= c.min_bedrooms ? "met" : "miss",
            detail: `${p.bedroom_count} hálószoba (min. ${c.min_bedrooms})`,
            hard: false,
          },
    );
  }

  if (c.min_area_sqm != null || c.max_area_sqm != null) {
    const wantedArea = rangeText(c.min_area_sqm, c.max_area_sqm, formatArea);
    checks.push(
      p.area_sqm == null
        ? { key: "area", label: "Alapterület", status: "unknown", detail: "Nincs alapterület megadva", hard: false }
        : {
            key: "area",
            label: "Alapterület",
            status: rangeCheck(p.area_sqm, c.min_area_sqm, c.max_area_sqm),
            detail: `${formatArea(p.area_sqm)} (${wantedArea})`,
            hard: false,
          },
    );
  }

  for (const f of wantedFeatures(c.other_requirements)) {
    const value = p[f.field];
    checks.push({
      key: f.key,
      label: f.label,
      status: value == null ? "unknown" : value ? "met" : "miss",
      detail: value == null ? "Nincs adat a hirdetésben" : value ? "Van" : "Nincs",
      hard: false,
    });
  }

  // Need at least one of budget / location / type to say anything useful.
  if (!checks.some((x) => x.hard)) return null;
  if (checks.some((x) => x.hard && x.status === "miss")) return null;

  const metCount = checks.filter((x) => x.status === "met").length;
  const softMisses = checks.filter((x) => !x.hard && x.status === "miss").length;
  const doubts = checks.filter((x) => x.status === "close" || x.status === "unknown").length;

  let category: MatchCategory;
  if (softMisses === 0 && doubts === 0) category = "strong";
  else if (softMisses + doubts <= 2 && checks.filter((x) => x.hard).every((x) => x.status !== "unknown")) category = "good";
  else category = "possible";

  return { category, checks, metCount };
}

const rank: Record<MatchCategory, number> = { strong: 3, good: 2, possible: 1 };

export function compareMatches(a: Match, b: Match) {
  return rank[b.category] - rank[a.category] || b.metCount - a.metCount;
}

/** One-line explanation for suggestion cards: what fits, then what to check. */
export function matchSummary(m: Match) {
  const fits = m.checks.filter((x) => x.status === "met").map((x) => x.label.toLowerCase());
  const check = m.checks.filter((x) => x.status !== "met").map((x) => x.label.toLowerCase());
  const parts = [];
  if (fits.length) parts.push(`Illik: ${fits.join(", ")}`);
  if (check.length) parts.push(`ellenőrizd: ${check.join(", ")}`);
  return parts.join("; ") + ".";
}
