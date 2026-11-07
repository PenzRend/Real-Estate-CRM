import { fillTemplateText, toBlocks, toDocx, toHtml } from "@/lib/office-docs/template-render";
import { CONTRACT_KINDS, type ContractKind } from "./kinds";
import { amountWithWords } from "./words";

// A contract's values and text: amounts get their words ("…, azaz … forint"),
// a missing field shows as a marked gap in the preview and as a dotted line
// in the signed paper. Pure, so it is tested.

const MONEY_KEYS = ["iranyar", "vetelar", "foglalo", "berleti_dij", "kaucio"] as const;
const DOTS = "……………………………";
const MISSING = "⟦hiányzik: ";

/** "63 500 000 Ft", "63500000", "63,5 M" → 63500000; null when there is no number. */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const s = raw.replace(/\s/g, "").toLowerCase();
  const m = /^([\d.,]+)(m|millió)?/.exec(s);
  if (!m) return null;
  const n = m[2] ? Number(m[1].replace(",", ".")) * 1_000_000 : Number(m[1].replace(/[.,]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** The values with the amounts written out in words (…_szoveg). */
export function withWords(values: Record<string, string>): Record<string, string> {
  const out = { ...values };
  for (const k of MONEY_KEYS) {
    const n = parseAmount(values[k]);
    out[`${k}_szoveg`] = n == null ? (values[k] ?? "") : amountWithWords(n);
  }
  return out;
}

/** The text with values filled; empty fields as gaps to mark (preview) or dotted lines (final). */
export function contractText(kind: ContractKind, body: string, values: Record<string, string>, mode: "preview" | "final") {
  const labels = new Map(CONTRACT_KINDS[kind].fields.map((f) => [f.key, f.label]));
  const all = withWords(values);
  const filled: Record<string, string> = {};
  for (const key of new Set([...body.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]))) {
    const v = all[key]?.trim();
    const label = labels.get(key) ?? labels.get(key.replace(/_szoveg$/, "")) ?? key;
    filled[key] = v ? v : mode === "preview" ? `${MISSING}${label}⟧` : DOTS;
  }
  // The AI paragraphs were written into the body when the draft was made.
  return fillTemplateText(body, filled);
}

/** For the review screen: gaps become highlighted marks. */
export function contractHtml(kind: ContractKind, body: string, values: Record<string, string>) {
  return toHtml(toBlocks(contractText(kind, body, values, "preview"))).replace(/⟦hiányzik: ([^⟧]*)⟧/g, '<mark data-missing="true">$1</mark>');
}

export function contractDocx(kind: ContractKind, body: string, values: Record<string, string>) {
  return toDocx(toBlocks(contractText(kind, body, values, "final")));
}
