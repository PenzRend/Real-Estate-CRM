import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { toE164 } from "@/lib/contact";
import { createClient } from "@/lib/supabase/server";
import type { ClientDraft } from "./clients";

export const MAX_IMPORT_ROWS = 3000;

export type ImportResult = { created: number; duplicates: string[]; failed: number };

const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Adds the agent's existing clients in one go. Anyone already in the
 * workspace (same phone or email), or twice in the file, is skipped and
 * named. Imported clients don't start the "new client" automations (welcome
 * emails, documents): they are not new leads, and a list of hundreds would
 * flood the outbox.
 */
export async function importClients(user: CurrentUser, drafts: ClientDraft[]): Promise<ImportResult> {
  const supabase = await createClient();
  const org = user.organization.id;
  const { data: existing } = await supabase.from("clients").select("phone, email").eq("organization_id", org).limit(20_000);
  const phones = new Set((existing ?? []).map((c) => toE164(c.phone)).filter(Boolean) as string[]);
  const emails = new Set((existing ?? []).map((c) => (c.email ?? "").toLowerCase()).filter(Boolean));
  const names = new Set<string>();

  const fresh: ClientDraft[] = [];
  const duplicates: string[] = [];
  for (const d of drafts.slice(0, MAX_IMPORT_ROWS)) {
    const phone = toE164(d.phone);
    const email = d.email?.toLowerCase() ?? null;
    // Without phone or email, the same name twice in one file is the same person.
    const nameOnly = !phone && !email ? key(d.full_name) : null;
    if ((phone && phones.has(phone)) || (email && emails.has(email)) || (nameOnly && names.has(nameOnly))) {
      duplicates.push(d.full_name);
      continue;
    }
    if (phone) phones.add(phone);
    if (email) emails.add(email);
    if (nameOnly) names.add(nameOnly);
    fresh.push(d);
  }

  let created = 0;
  let failed = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const batch = fresh.slice(i, i + 200).map((d) => ({
      ...d,
      organization_id: org,
      status: "new_lead",
      lead_source: d.lead_source ?? "Importálás",
      assigned_to: user.id,
    }));
    const { error, count } = await supabase.from("clients").insert(batch, { count: "exact" });
    if (!error) {
      created += count ?? batch.length;
      continue;
    }
    // One bad row shouldn't lose the rest of the batch: retry one by one.
    for (const row of batch) {
      const { error: one } = await supabase.from("clients").insert(row);
      if (one) failed++;
      else created++;
    }
  }
  return { created, duplicates, failed };
}
