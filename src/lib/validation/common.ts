import { z } from "zod";

export const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

/**
 * Parses numbers as Hungarians type them: "80 000 000", "80.000.000",
 * "64,5", "80M" / "80 M Ft" (millions). Empty → null.
 */
export function parseHungarianNumber(input: unknown): number | null | typeof NaN {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase().replace(/ft$/, "").trim();
  if (!s) return null;
  let multiplier = 1;
  if (/\s*(m|millió|mio)\.?$/.test(s)) {
    multiplier = 1_000_000;
    s = s.replace(/\s*(m|millió|mio)\.?$/, "");
  }
  s = s.replace(/[\s  ]/g, "");
  // "80.000.000" uses dots as thousand separators; a single "64.5" is a decimal.
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s) * multiplier;
}

export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().max(max, `Legfeljebb ${max} karakter lehet.`).nullable(),
  );

export const optionalNumber = (opts: { integer?: boolean; max?: number } = {}) =>
  z.preprocess(
    parseHungarianNumber,
    z
      .number({ error: "Számot adj meg." })
      .refine((n) => !Number.isNaN(n), "Számot adj meg.")
      .refine((n) => n >= 0, "Nem lehet negatív.")
      .refine((n) => !opts.integer || Number.isInteger(n), "Egész számot adj meg.")
      .refine((n) => opts.max == null || n <= opts.max, "Túl nagy érték.")
      .nullable(),
  );

/** First error message per top-level field, for showing under form inputs. */
export function fieldErrors<K extends string>(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0] as K;
    errors[key] ??= issue.message;
  }
  return errors;
}
