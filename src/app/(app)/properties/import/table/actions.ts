"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { importListings, MAX_LISTING_ROWS, type ListingImportResult } from "@/lib/import/save-listings";

const text = (max: number) => z.string().max(max).nullable();
const count = z.number().int().min(0).max(99).nullable();
const flag = z.boolean().nullable();

const draft = z.object({
  title: z.string().trim().min(1).max(300),
  reference_number: text(100),
  property_type: z.enum(["apartment", "house", "plot", "commercial", "other"]),
  listing_type: z.enum(["sale", "rent"]),
  status: z.enum(["draft", "active", "reserved", "under_negotiation", "sold", "rented", "inactive"]),
  city: text(200),
  district: text(200),
  address: text(300),
  postal_code: text(10),
  price: z.number().min(0).max(1e13).nullable(),
  currency: z.enum(["HUF", "EUR"]),
  area_sqm: z.number().min(0).max(1e6).nullable(),
  room_count: z.number().min(0).max(999).nullable(),
  bedroom_count: count,
  bathroom_count: count,
  floor: text(50),
  building_type: text(100),
  condition: text(100),
  energy_rating: text(20),
  has_balcony: flag,
  has_garden: flag,
  has_parking: flag,
  description: text(20000),
  internal_notes: text(4000),
  features: z
    .object({
      elevator: z.boolean().optional(),
      heating: z.string().max(100).optional(),
      year_built: z.number().int().min(1500).max(2100).optional(),
      common_cost_huf: z.number().int().min(0).max(1e7).optional(),
    })
    .strict(),
});

/** The rows the agent checked on the import screen (read and mapped in their browser). */
export async function importListingsAction(rows: unknown): Promise<{ ok: true; result: ListingImportResult } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const parsed = z.array(draft).min(1).max(MAX_LISTING_ROWS).safeParse(rows);
  if (!parsed.success) return { ok: false, error: `Legfeljebb ${MAX_LISTING_ROWS} ingatlant tudok egyszerre átvenni, és mindegyiknek kell megnevezés.` };
  const result = await importListings(user, parsed.data);
  if (result.created) refresh();
  return { ok: true, result };
}
