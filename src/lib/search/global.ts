import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { searchTerm } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

// Ctrl+K: one box that finds anything — clients (name, email, phone),
// listings (title, address, reference), deals (by listing or buyer), emails
// (subject, sender) and open tasks. Each group shows its best few.

export type SearchHit = { id: string; group: "clients" | "properties" | "deals" | "emails" | "tasks"; title: string; detail: string | null; href: string };

const PER_GROUP = 5;
const digits = (s: string) => s.replace(/\D/g, "");

export async function globalSearch(user: CurrentUser, raw: string): Promise<SearchHit[]> {
  const term = searchTerm(raw).slice(0, 80);
  if (term.length < 2) return [];
  const org = user.organization.id;
  const supabase = await createClient();
  const like = `%${term}%`;
  const phone = digits(raw);
  const plain = raw.replace(/[%_,()*\\]/g, " ").trim().slice(0, 80);

  const [clients, phoneClients, properties, emails, tasks] = await Promise.all([
    supabase.from("clients").select("id, full_name, email, phone").eq("organization_id", org).is("archived_at", null).ilike("search_text", like).limit(PER_GROUP),
    phone.length >= 5 ? supabase.from("clients").select("id, full_name, email, phone").eq("organization_id", org).is("archived_at", null).not("phone", "is", null).limit(2000) : Promise.resolve({ data: [] as { id: string; full_name: string; email: string | null; phone: string | null }[] }),
    supabase.from("properties").select("id, title, city, district, reference_number, status").eq("organization_id", org).is("archived_at", null).ilike("search_text", like).limit(PER_GROUP),
    supabase.from("emails").select("id, subject, from_name, from_email, status").eq("user_id", user.id).or(`subject.ilike.*${plain}*,from_name.ilike.*${plain}*,from_email.ilike.*${plain}*`).order("received_at", { ascending: false }).limit(PER_GROUP),
    supabase.from("tasks").select("id, title, client_id, due_at").eq("organization_id", org).in("status", ["todo", "in_progress"]).ilike("title", `%${plain}%`).limit(PER_GROUP),
  ]);

  const clientRows = [...(clients.data ?? []), ...(phoneClients.data ?? []).filter((c) => digits(c.phone ?? "").includes(phone))];
  const seen = new Set<string>();
  const clientHits = clientRows.filter((c) => !seen.has(c.id) && seen.add(c.id)).slice(0, PER_GROUP);

  // Deals: on a listing or with a buyer the term found.
  const propertyIds = (properties.data ?? []).map((p) => p.id);
  const clientIds = clientHits.map((c) => c.id);
  const filters = [propertyIds.length && `property_id.in.(${propertyIds.join(",")})`, clientIds.length && `buyer_client_id.in.(${clientIds.join(",")})`].filter(Boolean);
  const { data: deals } = filters.length
    ? await supabase.from("deals").select("id, property_id, buyer_client_id, stage, status").eq("organization_id", org).or(filters.join(",")).order("updated_at", { ascending: false }).limit(PER_GROUP)
    : { data: [] as { id: string; property_id: string; buyer_client_id: string | null; stage: string; status: string }[] };
  const titleOf = new Map((properties.data ?? []).map((p) => [p.id, p.title as string]));
  const nameOf = new Map(clientHits.map((c) => [c.id, c.full_name]));
  const missingTitles = (deals ?? []).map((d) => d.property_id).filter((id) => !titleOf.has(id));
  if (missingTitles.length) {
    const { data } = await supabase.from("properties").select("id, title").in("id", missingTitles);
    for (const p of data ?? []) titleOf.set(p.id, p.title);
  }

  return [
    ...clientHits.map((c) => ({ id: c.id, group: "clients" as const, title: c.full_name, detail: [c.phone, c.email].filter(Boolean).join(" · ") || null, href: `/clients/${c.id}` })),
    ...(properties.data ?? []).map((p) => ({
      id: p.id,
      group: "properties" as const,
      title: p.title,
      detail: [p.reference_number && `#${p.reference_number}`, [p.city, p.district].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || null,
      href: `/properties/${p.id}`,
    })),
    ...(deals ?? []).map((d) => ({
      id: d.id,
      group: "deals" as const,
      title: titleOf.get(d.property_id) ?? "Ügylet",
      detail: [d.buyer_client_id ? nameOf.get(d.buyer_client_id) : null, d.status === "open" ? "folyamatban" : d.status === "won" ? "sikeres" : "meghiúsult"].filter(Boolean).join(" · "),
      href: `/deals/${d.id}`,
    })),
    ...(emails.data ?? []).map((e) => ({ id: e.id, group: "emails" as const, title: e.subject || "(nincs tárgy)", detail: e.from_name || e.from_email, href: `/interactions/new?email=${e.id}` })),
    ...(tasks.data ?? []).map((t) => ({ id: t.id, group: "tasks" as const, title: t.title, detail: null, href: t.client_id ? `/clients/${t.client_id}` : "/tasks" })),
  ];
}
