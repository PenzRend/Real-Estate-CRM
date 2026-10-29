// Price check: where a listing's price per m² sits among comparable
// properties the office knows (its own listings, and agreed prices of its
// deals), and a price range for the valuation sheet. Pure, so it is tested.

export type Comparable = {
  id: string;
  title: string;
  place: string;
  areaSqm: number;
  rooms: number | null;
  price: number;
  /** "agreed": an agreed deal price; "asking": a listing's asking price. */
  basis: "agreed" | "asking";
  status: string;
  date: string;
};

export type Subject = { propertyType: string; listingType: "sale" | "rent"; city: string | null; district: string | null; areaSqm: number | null; rooms: number | null; price: number | null };

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Same city (and district when both have one), size within ±35 %, rooms within ±1. */
export function isComparable(subject: Subject, c: { city: string | null; district: string | null; areaSqm: number; rooms: number | null }) {
  if (!subject.areaSqm || !c.areaSqm) return false;
  if (norm(subject.city) && norm(c.city) && norm(subject.city) !== norm(c.city)) return false;
  if (norm(subject.district) && norm(c.district) && norm(subject.district) !== norm(c.district)) return false;
  if (c.areaSqm < subject.areaSqm * 0.65 || c.areaSqm > subject.areaSqm * 1.35) return false;
  if (subject.rooms != null && c.rooms != null && Math.abs(subject.rooms - c.rooms) > 1) return false;
  return true;
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export type PriceCheck = {
  count: number;
  /** Ft / m². */
  median: number | null;
  low: number | null;
  high: number | null;
  subjectPerSqm: number | null;
  /** How far the asking price per m² is from the median, in % (+ above). */
  difference: number | null;
  verdict: "low" | "fair" | "high" | "unknown";
  /** A price range for the whole property from the middle half of the comparables. */
  range: { from: number; to: number } | null;
  /** Fewer than 3 comparables: shown, but with a warning. */
  thin: boolean;
};

export function priceCheck(subject: Subject, comps: Comparable[]): PriceCheck {
  const perSqm = comps.map((c) => c.price / c.areaSqm).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  const subjectPerSqm = subject.price && subject.areaSqm ? subject.price / subject.areaSqm : null;
  if (!perSqm.length) return { count: 0, median: null, low: null, high: null, subjectPerSqm, difference: null, verdict: "unknown", range: null, thin: true };
  const median = quantile(perSqm, 0.5);
  const low = quantile(perSqm, 0.25);
  const high = quantile(perSqm, 0.75);
  const difference = subjectPerSqm != null ? Math.round(((subjectPerSqm - median) / median) * 100) : null;
  const verdict = difference == null ? "unknown" : difference > 10 ? "high" : difference < -10 ? "low" : "fair";
  const round = (n: number) => Math.round(n / 100_000) * 100_000;
  const range = subject.areaSqm ? { from: round(low * subject.areaSqm), to: round(high * subject.areaSqm) } : null;
  return { count: perSqm.length, median: Math.round(median), low: Math.round(low), high: Math.round(high), subjectPerSqm: subjectPerSqm != null ? Math.round(subjectPerSqm) : null, difference, verdict, range, thin: perSqm.length < 3 };
}
