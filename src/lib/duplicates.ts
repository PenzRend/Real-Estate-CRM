import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// "Már megvan?": before a client or listing is added twice (often by two
// agents chasing the same lead), the form shows what already matches and
// whose it is. Clients match on phone (last 9 digits), email or exact name;
// listings on the portal link or the address in the same city.

export type Duplicate = { id: string; name: string; href: string; agent: string | null; reason: string; archived: boolean };

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-9);
const likeSafe = (s: string) => s.replace(/[%_,()\\]/g, " ").trim();

async function agentNames(ids: (string | null)[]) {
  const wanted = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!wanted.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", wanted);
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? (p.email as string)]));
}

export async function clientDuplicates(user: CurrentUser, input: { name?: string; phone?: string; email?: string }, excludeId?: string | null): Promise<Duplicate[]> {
  const name = likeSafe(input.name ?? "");
  const phone = digits(input.phone);
  const email = likeSafe((input.email ?? "").toLowerCase());
  const ors = [
    name.length >= 3 ? `full_name.ilike.${name}` : null,
    phone.length >= 8 ? `phone.ilike.%${phone.slice(-4)}%` : null,
    email.includes("@") ? `email.ilike.${email}` : null,
  ].filter(Boolean);
  if (!ors.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, full_name, phone, email, assigned_to, created_by, archived_at")
    .eq("organization_id", user.organization.id)
    .or(ors.join(","))
    .limit(50);
  const rows = (data ?? [])
    .filter((c) => c.id !== excludeId)
    .flatMap((c) => {
      const reason =
        phone.length >= 8 && digits(c.phone) === phone
          ? "ugyanaz a telefonszám"
          : email.includes("@") && (c.email ?? "").toLowerCase() === email
            ? "ugyanaz az e-mail-cím"
            : name.length >= 3 && c.full_name.toLowerCase() === name.toLowerCase()
              ? "ugyanaz a név"
              : null;
      return reason ? [{ c, reason }] : [];
    })
    .slice(0, 3);
  const names = await agentNames(rows.map((r) => r.c.assigned_to ?? r.c.created_by));
  return rows.map(({ c, reason }) => ({
    id: c.id,
    name: c.full_name,
    href: `/clients/${c.id}`,
    agent: names.get(c.assigned_to ?? c.created_by) ?? null,
    reason,
    archived: Boolean(c.archived_at),
  }));
}

export async function propertyDuplicates(user: CurrentUser, input: { address?: string; city?: string; sourceUrl?: string }, excludeId?: string | null): Promise<Duplicate[]> {
  const address = likeSafe(input.address ?? "");
  const city = likeSafe(input.city ?? "");
  const url = (input.sourceUrl ?? "").trim();
  const supabase = await createClient();
  const found: { row: { id: string; title: string; assigned_to: string | null; created_by: string | null; archived_at: string | null }; reason: string }[] = [];
  if (/^https?:\/\//.test(url)) {
    const { data } = await supabase.from("properties").select("id, title, assigned_to, created_by, archived_at").eq("organization_id", user.organization.id).eq("source_url", url).limit(3);
    for (const row of data ?? []) found.push({ row, reason: "ugyanaz a hirdetés" });
  }
  if (address.length >= 5) {
    let q = supabase.from("properties").select("id, title, assigned_to, created_by, archived_at").eq("organization_id", user.organization.id).ilike("address", address);
    if (city) q = q.ilike("city", city);
    const { data } = await q.limit(3);
    for (const row of data ?? []) if (!found.some((f) => f.row.id === row.id)) found.push({ row, reason: "ugyanaz a cím" });
  }
  const rows = found.filter((f) => f.row.id !== excludeId).slice(0, 3);
  const names = await agentNames(rows.map((r) => r.row.assigned_to ?? r.row.created_by));
  return rows.map(({ row, reason }) => ({
    id: row.id,
    name: row.title,
    href: `/properties/${row.id}`,
    agent: names.get(row.assigned_to ?? row.created_by ?? "") ?? null,
    reason,
    archived: Boolean(row.archived_at),
  }));
}
