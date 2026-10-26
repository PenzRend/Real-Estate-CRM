// Property details beyond the core columns ("Felszereltség és egyéb"), kept
// in properties.features. One definition for the form, validation, the
// listing page and the listing import.

export type ExtraKind = "flag" | "text" | "number";

export const EXTRAS = [
  { key: "elevator", label: "Lift", kind: "flag" },
  { key: "air_conditioning", label: "Klíma", kind: "flag" },
  { key: "furnished", label: "Bútorozott", kind: "flag" },
  { key: "heating", label: "Fűtés", kind: "text", placeholder: "Pl. gáz (cirkó), távfűtés, hőszivattyú" },
  { key: "orientation", label: "Tájolás", kind: "text", placeholder: "Pl. délnyugati" },
  { key: "view", label: "Kilátás", kind: "text", placeholder: "Pl. utcai, panorámás, kertre néző" },
  { key: "year_built", label: "Építés éve", kind: "number", placeholder: "Pl. 1905" },
  { key: "common_cost_huf", label: "Közös költség (Ft/hó)", kind: "number", placeholder: "Pl. 45 000" },
] as const satisfies readonly { key: string; label: string; kind: ExtraKind; placeholder?: string }[];

export type ExtraKey = (typeof EXTRAS)[number]["key"];
export type Extras = Partial<Record<ExtraKey, boolean | string | number>>;

/** Form field name for an extra. */
export const extraField = (key: ExtraKey) => `extra_${key}`;

/** Form strings → stored values; empty and invalid entries are left out. */
export function parseExtras(get: (name: string) => unknown): Extras {
  const out: Extras = {};
  for (const e of EXTRAS) {
    const raw = get(extraField(e.key));
    if (typeof raw !== "string" || !raw.trim()) continue;
    const v = raw.trim();
    if (e.kind === "flag") {
      if (v === "true" || v === "false") out[e.key] = v === "true";
    } else if (e.kind === "number") {
      const n = Number(v.replace(/[\s ]/g, "").replace(",", "."));
      if (Number.isFinite(n) && n >= 0 && n < 1e9) out[e.key] = Math.round(n);
    } else {
      out[e.key] = v.slice(0, 100);
    }
  }
  return out;
}

/** Stored values → form strings. */
export function extrasToFormValues(features: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of EXTRAS) {
    const v = features?.[e.key];
    if (v == null || v === "") continue;
    out[extraField(e.key)] = typeof v === "boolean" ? String(v) : String(v);
  }
  return out;
}

/** For display: the extras that have a value, as label / text pairs. */
export function extrasForDisplay(features: Record<string, unknown> | null | undefined) {
  const out: { label: string; value: string }[] = [];
  for (const e of EXTRAS) {
    const v = features?.[e.key];
    if (v == null || v === "") continue;
    if (e.kind === "flag") out.push({ label: e.label, value: v ? "van" : "nincs" });
    else if (e.key === "common_cost_huf") out.push({ label: e.label, value: `${new Intl.NumberFormat("hu-HU").format(Number(v))} Ft` });
    else out.push({ label: e.label, value: String(v) });
  }
  return out;
}
