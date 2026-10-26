import { z } from "zod";
import { currencyLabels, listingTypeLabels, propertyStatusLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import { fieldErrors, keys, optionalNumber, optionalText } from "./common";

const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const propertyFormSchema = z.object({
  title: z.string().trim().min(1, "Adj meg egy megnevezést.").max(300),
  reference_number: optionalText(100),
  property_type: z.enum(keys(propertyTypeLabels), { error: "Válassz ingatlantípust." }),
  status: z.enum(keys(propertyStatusLabels), { error: "Válassz státuszt." }),
  listing_type: z.enum(keys(listingTypeLabels), { error: "Válaszd ki, eladó vagy kiadó." }),
  listing_source: optionalText(100),
  owner_client_id: z.preprocess(
    (v) => (typeof v === "string" && v ? v : null),
    z.string().regex(UUID, "Válassz a listából.").nullable(),
  ),
  city: optionalText(100),
  district: optionalText(100),
  address: optionalText(300),
  postal_code: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().regex(/^\d{4}$/, "A magyar irányítószám 4 számjegy.").nullable(),
  ),
  price: optionalNumber({ max: 1e12 }),
  currency: z.enum(keys(currencyLabels), { error: "Válassz pénznemet." }),
  area_sqm: optionalNumber({ max: 100_000 }),
  room_count: optionalNumber({ max: 100 }),
  bedroom_count: optionalNumber({ integer: true, max: 100 }),
  bathroom_count: optionalNumber({ integer: true, max: 100 }),
  floor: optionalText(50),
  building_type: optionalText(100),
  condition: optionalText(100),
  energy_rating: optionalText(20),
  has_balcony: checkbox,
  has_garden: checkbox,
  has_parking: checkbox,
  description: optionalText(10_000),
  internal_notes: optionalText(5000),
});

export type PropertyInput = z.infer<typeof propertyFormSchema>;
export type PropertyFieldErrors = Partial<Record<keyof PropertyInput, string>>;

export function parsePropertyForm(formData: FormData) {
  const raw = Object.fromEntries([...formData.keys()].map((k) => [k, formData.get(k)]));
  const result = propertyFormSchema.safeParse(raw);
  if (result.success) return { ok: true as const, data: result.data };
  return { ok: false as const, errors: fieldErrors<keyof PropertyInput>(result.error.issues) as PropertyFieldErrors };
}
