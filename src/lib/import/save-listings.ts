import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ListingDraft } from "./listings";

export const MAX_LISTING_ROWS = 1000;

export type ListingImportResult = { created: number; duplicates: string[]; failed: number };

const key = (...parts: (string | null)[]) =>
  parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Adds the agent's existing listings in one go. A listing already in the
 * workspace (same reference number, or same title, address, size and price), or twice in
 * the file, is skipped and named. Imported listings start no automations
 * (no "new listing" offers to buyers, no agreement drafts): they are not new,
 * and hundreds at once would flood the outbox.
 */
export async function importListings(user: CurrentUser, drafts: ListingDraft[]): Promise<ListingImportResult> {
  const supabase = await createClient();
  const org = user.organization.id;
  const { data: existing } = await supabase.from("properties").select("reference_number, title, address, area_sqm, price").eq("organization_id", org).limit(20_000);
  const refs = new Set((existing ?? []).map((p) => key(p.reference_number)).filter(Boolean));
  const num = (v: number | string | null) => (v == null ? null : String(Number(v)));
  const places = new Set((existing ?? []).map((p) => key(p.title, p.address, num(p.area_sqm), num(p.price))));

  const fresh: ListingDraft[] = [];
  const duplicates: string[] = [];
  for (const d of drafts.slice(0, MAX_LISTING_ROWS)) {
    const ref = key(d.reference_number);
    const place = key(d.title, d.address, num(d.area_sqm), num(d.price));
    if ((ref && refs.has(ref)) || places.has(place)) {
      duplicates.push(d.title);
      continue;
    }
    if (ref) refs.add(ref);
    places.add(place);
    fresh.push(d);
  }

  let created = 0;
  let failed = 0;
  for (let i = 0; i < fresh.length; i += 100) {
    const batch = fresh.slice(i, i + 100).map((d) => ({
      ...d,
      organization_id: org,
      assigned_to: user.id,
      listing_source: "Importálás táblázatból",
    }));
    const { error, count } = await supabase.from("properties").insert(batch, { count: "exact" });
    if (!error) {
      created += count ?? batch.length;
      continue;
    }
    // One bad row shouldn't lose the rest of the batch: retry one by one.
    for (const row of batch) {
      const { error: one } = await supabase.from("properties").insert(row);
      if (one) failed++;
      else created++;
    }
  }
  return { created, duplicates, failed };
}
