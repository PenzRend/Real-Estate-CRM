import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { formatPriceShort } from "@/lib/i18n/format";
import { createClient } from "@/lib/supabase/server";

// A client, listing or deal shared into the chat, shown as a card. Resolved
// with the reader's session: a record they can't see stays a "not available" card.

export type RefKind = "client" | "property" | "deal";
export type RefCard = { kind: RefKind; id: string; title: string; detail: string | null; href: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stageLabels: Record<string, string> = { offer: "Ajánlat", deposit: "Foglaló", contract: "Adásvételi", financing: "Finanszírozás", handover: "Birtokbaadás", closed: "Lezárva" };

export const refKey = (kind: string, id: string) => `${kind}:${id}`;
export const isRefKind = (k: unknown): k is RefKind => k === "client" || k === "property" || k === "deal";

export async function resolveRefs(user: CurrentUser, refs: { kind: RefKind; id: string }[]): Promise<Map<string, RefCard>> {
  const ids = (k: RefKind) => [...new Set(refs.filter((r) => r.kind === k && UUID.test(r.id)).map((r) => r.id))];
  const [clientIds, propertyIds, dealIds] = [ids("client"), ids("property"), ids("deal")];
  const org = user.organization.id;
  const supabase = await createClient();
  const [clients, properties, deals] = await Promise.all([
    clientIds.length ? supabase.from("clients").select("id, full_name, phone, budget_max, preferred_locations").eq("organization_id", org).in("id", clientIds) : { data: [] },
    propertyIds.length ? supabase.from("properties").select("id, title, price, city, district").eq("organization_id", org).in("id", propertyIds) : { data: [] },
    dealIds.length
      ? supabase.from("deals").select("id, stage, status, agreed_price, property_id, buyer_client_id").eq("organization_id", org).in("id", dealIds)
      : { data: [] },
  ]);
  const out = new Map<string, RefCard>();
  for (const c of clients.data ?? []) {
    const where = (c.preferred_locations as string[] | null)?.slice(0, 2).join(", ");
    out.set(refKey("client", c.id), {
      kind: "client",
      id: c.id,
      title: c.full_name,
      detail: [c.phone, c.budget_max ? `max. ${formatPriceShort(Number(c.budget_max))}` : null, where].filter(Boolean).join(" · ") || null,
      href: `/clients/${c.id}`,
    });
  }
  for (const p of properties.data ?? []) {
    out.set(refKey("property", p.id), {
      kind: "property",
      id: p.id,
      title: p.title,
      detail: [p.price ? formatPriceShort(Number(p.price)) : null, [p.city, p.district].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || null,
      href: `/properties/${p.id}`,
    });
  }
  const dealRows = deals.data ?? [];
  if (dealRows.length) {
    const [titles, buyers] = await Promise.all([
      supabase.from("properties").select("id, title").eq("organization_id", org).in("id", dealRows.map((d) => d.property_id)),
      supabase
        .from("clients")
        .select("id, full_name")
        .eq("organization_id", org)
        .in("id", dealRows.map((d) => d.buyer_client_id).filter(Boolean).concat("00000000-0000-0000-0000-000000000000")),
    ]);
    const title = new Map((titles.data ?? []).map((t) => [t.id, t.title]));
    const buyer = new Map((buyers.data ?? []).map((b) => [b.id, b.full_name]));
    for (const d of dealRows) {
      const status = d.status === "won" ? "Sikeres" : d.status === "lost" ? "Meghiúsult" : (stageLabels[d.stage] ?? d.stage);
      out.set(refKey("deal", d.id), {
        kind: "deal",
        id: d.id,
        title: `Ügylet: ${title.get(d.property_id) ?? "ingatlan"}`,
        detail: [status, d.buyer_client_id ? buyer.get(d.buyer_client_id) : null, d.agreed_price ? formatPriceShort(Number(d.agreed_price)) : null].filter(Boolean).join(" · "),
        href: `/deals/${d.id}`,
      });
    }
  }
  return out;
}
