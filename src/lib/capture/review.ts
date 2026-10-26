// Compares what the AI extracted with what is saved for the client, and turns
// the agent's edits back into typed values. Pure functions, shared by the
// review screen and the tests.
import type { CaptureExtraction } from "@/lib/ai/capture-schema";
import type { ClientSnapshot } from "@/lib/db/activity";
import { formatDate, formatNumber, formatPrice } from "@/lib/i18n/format";
import { propertyTypeLabels } from "@/lib/i18n/labels";
import type { ClientUpdates } from "@/lib/validation/activity";
import { parseHungarianNumber } from "@/lib/validation/common";

export type Kind = "money" | "number" | "int" | "text" | "date" | "list" | "types" | "phone" | "email";
export type UpdateKey = keyof ClientUpdates;

export type ProposedField = {
  key: UpdateKey;
  label: string;
  kind: Kind;
  /** Value to write, as editable text (lists are comma separated). */
  proposed: string;
  /** What is saved now, formatted for display. */
  current: string | null;
  conflict: boolean;
};

const plain = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 });
const typeLabel = (t: string) => propertyTypeLabels[t as keyof typeof propertyTypeLabels] ?? t;

/** "Budapest XI.", "XI. kerület", "XI. ker." and "budapest xi kerulet" are the same place. */
export function locationKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\bker(ulet)?\b\.?/g, " ")
    .replace(/\bbudapest\b/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function union(current: string[], next: string[], key: (s: string) => string = (s) => s.toLowerCase()) {
  const seen = new Set(current.map(key));
  const out = [...current];
  for (const item of next) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

/** Compares what the AI found with the client's saved data, field by field. */
export function proposedFields(x: CaptureExtraction, c: ClientSnapshot | null): ProposedField[] {
  const out: ProposedField[] = [];
  const r = x.requirements;

  const scalar = (key: UpdateKey, label: string, kind: Kind, next: number | string | null, current: number | string | null) => {
    if (next == null) return;
    const show = (v: number | string) =>
      kind === "money" ? formatPrice(Number(v)) : kind === "date" ? formatDate(String(v)) : typeof v === "number" ? formatNumber(v) : v;
    if (current != null && String(current) === String(next)) return; // already saved
    out.push({
      key,
      label,
      kind,
      proposed: typeof next === "number" ? plain.format(next) : next,
      current: current == null || current === "" ? null : show(current),
      conflict: current != null && current !== "",
    });
  };

  scalar("budget_min", "Minimum költségkeret", "money", r.budget_min, c?.budget_min ?? null);
  scalar(
    "budget_max",
    r.budget_is_approximate ? "Költségkeret (kb.)" : "Maximum költségkeret",
    "money",
    r.budget_max,
    c?.budget_max ?? null,
  );

  if (r.locations.length) {
    const merged = union(c?.preferred_locations ?? [], r.locations, locationKey);
    if (merged.length !== (c?.preferred_locations.length ?? 0)) {
      out.push({
        key: "preferred_locations",
        label: "Helyszínek",
        kind: "list",
        proposed: merged.join(", "),
        current: c?.preferred_locations.length ? c.preferred_locations.join(", ") : null,
        conflict: false,
      });
    }
  }
  if (r.property_types.length) {
    const merged = union(c?.preferred_property_types ?? [], r.property_types);
    if (merged.length !== (c?.preferred_property_types.length ?? 0)) {
      out.push({
        key: "preferred_property_types",
        label: "Ingatlantípus",
        kind: "types",
        proposed: merged.join(","),
        current: c?.preferred_property_types.length ? c.preferred_property_types.map(typeLabel).join(", ") : null,
        conflict: false,
      });
    }
  }
  scalar("min_rooms", "Minimum szobaszám", "number", r.min_rooms, c?.min_rooms ?? null);
  scalar("min_bedrooms", "Minimum hálószoba", "int", r.min_bedrooms, c?.min_bedrooms ?? null);
  scalar("min_area_sqm", "Minimum alapterület (m²)", "number", r.min_area_sqm, c?.min_area_sqm ?? null);
  scalar("max_area_sqm", "Maximum alapterület (m²)", "number", r.max_area_sqm, c?.max_area_sqm ?? null);
  scalar("desired_move_date", "Költözés ideje", "date", r.desired_move_date, c?.desired_move_date ?? null);
  if (r.other) {
    const current = c?.other_requirements ?? null;
    if (!current?.includes(r.other)) {
      out.push({
        key: "other_requirements",
        label: "Egyéb igények",
        kind: "text",
        proposed: current ? `${current}\n${r.other}` : r.other,
        current,
        conflict: false,
      });
    }
  }
  scalar("phone", "Telefonszám", "phone", x.client.phone, c?.phone ?? null);
  scalar("email", "E-mail-cím", "email", x.client.email, c?.email ?? null);
  return out;
}

export function toUpdateValue(f: ProposedField, raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const text = raw.trim();
  switch (f.kind) {
    case "money":
    case "number":
    case "int": {
      if (!text) return { ok: true, value: null };
      const n = parseHungarianNumber(text);
      if (typeof n !== "number" || Number.isNaN(n)) return { ok: false, error: `${f.label}: számot adj meg.` };
      if (f.kind === "int" && !Number.isInteger(n)) return { ok: false, error: `${f.label}: egész számot adj meg.` };
      return { ok: true, value: n };
    }
    case "list":
      return { ok: true, value: text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) };
    case "types":
      return { ok: true, value: text.split(",").filter(Boolean) };
    case "date":
      return { ok: true, value: text || null };
    default:
      return { ok: true, value: text || null };
  }
}

export const localFrom = (date: string | null, time: string | null) => (date ? `${date}T${time ?? "09:00"}` : "");

export function outcomeText(x: CaptureExtraction) {
  const lines = [x.outcome];
  if (x.decisions.length) lines.push(`Megállapodás: ${x.decisions.join("; ")}`);
  if (x.promised_actions.length) lines.push(`Vállalások: ${x.promised_actions.join("; ")}`);
  if (x.open_questions.length) lines.push(`Nyitott kérdések: ${x.open_questions.join("; ")}`);
  if (x.important_dates.length) lines.push(`Fontos dátumok: ${x.important_dates.map((d) => `${formatDate(d.date)} – ${d.description}`).join("; ")}`);
  return lines.filter(Boolean).join("\n");
}
