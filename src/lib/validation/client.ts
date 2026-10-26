import { z } from "zod";
import { zonedLocalToUtc } from "@/lib/i18n/timezone";
import { clientStatusLabels, clientTypeLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import { fieldErrors, keys, optionalNumber, optionalText } from "./common";

export { parseHungarianNumber } from "./common";

/** Name and contact rules, shared by the client form and quick "new owner" entry. */
export const clientContactFields = {
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
};

export const clientFormSchema = z
  .object({
    ...clientContactFields,
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

  return { ok: false as const, errors: fieldErrors<keyof ClientInput>(result.error.issues) as ClientFieldErrors };
}
