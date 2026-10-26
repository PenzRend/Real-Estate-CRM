import { z } from "zod";
import { zonedLocalToUtc } from "@/lib/i18n/timezone";
import { clientStatusLabels, clientTypeLabels, propertyTypeLabels } from "@/lib/i18n/labels";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

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

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().max(max, `Legfeljebb ${max} karakter lehet.`).nullable(),
  );

const optionalNumber = (opts: { integer?: boolean; max?: number } = {}) =>
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

export const clientFormSchema = z
  .object({
    full_name: z.string().trim().min(1, "Add meg az ügyfél nevét.").max(200),
    email: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null),
      z.email("Érvénytelen e-mail-cím.").max(320).nullable(),
    ),
    phone: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
      z
        .string()
        .max(50)
        .regex(/^[+\d][\d\s()/-]*$/, "Csak számjegyek, szóköz, +, -, / és zárójel szerepelhet benne.")
        .nullable(),
    ),
    client_type: z.enum(keys(clientTypeLabels), { error: "Válassz ügyféltípust." }),
    status: z.enum(keys(clientStatusLabels), { error: "Válassz státuszt." }),
    budget_min: optionalNumber({ max: 1e12 }),
    budget_max: optionalNumber({ max: 1e12 }),
    preferred_locations: z.preprocess(
      (v) =>
        typeof v === "string"
          ? [...new Set(v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))]
          : [],
      z.array(z.string().max(100)).max(20, "Legfeljebb 20 helyszín adható meg."),
    ),
    preferred_property_types: z.array(z.enum(keys(propertyTypeLabels))).max(5),
    min_rooms: optionalNumber({ max: 50 }),
    min_bedrooms: optionalNumber({ integer: true, max: 50 }),
    min_area_sqm: optionalNumber({ max: 100_000 }),
    max_area_sqm: optionalNumber({ max: 100_000 }),
    preferred_condition: optionalText(100),
    desired_move_date: z.preprocess(
      (v) => (typeof v === "string" && v ? v : null),
      z.iso.date("Érvénytelen dátum.").nullable(),
    ),
    other_requirements: optionalText(2000),
    lead_source: optionalText(100),
    next_follow_up_at: z.preprocess(
      (v) => (typeof v === "string" && v ? (zonedLocalToUtc(v) ?? "invalid") : null),
      z.iso.datetime({ error: "Érvénytelen időpont." }).nullable(),
    ),
    notes: optionalText(5000),
  })
  .refine((v) => v.budget_min == null || v.budget_max == null || v.budget_min <= v.budget_max, {
    path: ["budget_max"],
    message: "A maximum nem lehet kisebb a minimumnál.",
  })
  .refine((v) => v.min_area_sqm == null || v.max_area_sqm == null || v.min_area_sqm <= v.max_area_sqm, {
    path: ["max_area_sqm"],
    message: "A maximum nem lehet kisebb a minimumnál.",
  });

export type ClientInput = z.infer<typeof clientFormSchema>;
export type ClientFieldErrors = Partial<Record<keyof ClientInput, string>>;

export function parseClientForm(formData: FormData) {
  const raw = Object.fromEntries(
    [...formData.keys()].filter((k) => k !== "preferred_property_types").map((k) => [k, formData.get(k)]),
  );
  const result = clientFormSchema.safeParse({
    ...raw,
    preferred_property_types: formData.getAll("preferred_property_types"),
  });
  if (result.success) return { ok: true as const, data: result.data };

  const errors: ClientFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof ClientInput;
    errors[key] ??= issue.message;
  }
  return { ok: false as const, errors };
}
