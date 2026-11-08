"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { importClients, MAX_IMPORT_ROWS, type ImportResult } from "@/lib/import/save";

const money = z.number().int().min(0).max(1e12).nullable();
const draft = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().max(50).nullable(),
  email: z.string().max(320).nullable(),
  client_type: z.enum(["buyer", "seller", "owner", "investor", "tenant", "other"]),
  budget_min: money,
  budget_max: money,
  preferred_locations: z.array(z.string().max(200)).max(10),
  notes: z.string().max(4000).nullable(),
  lead_source: z.string().max(200).nullable(),
});

/** The rows the agent checked on the import screen (read and mapped in their browser). */
export async function importClientsAction(rows: unknown): Promise<{ ok: true; result: ImportResult } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const parsed = z.array(draft).min(1).max(MAX_IMPORT_ROWS).safeParse(rows);
  if (!parsed.success) return { ok: false, error: `Legfeljebb ${MAX_IMPORT_ROWS} sort tudok egyszerre átvenni, és minden sorban kell név.` };
  const result = await importClients(user, parsed.data);
  if (result.created) refresh();
  return { ok: true, result };
}
