import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/db";
import { isComparable, priceCheck, type Comparable, type PriceCheck, type Subject } from "./valuation";

// The comparables for a listing, from what the office knows: its listings of
// the same type (also sold and archived ones) and, where a deal closed, the
// agreed price instead of the asking price.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PriceStudy = { subject: Subject & { id: string; title: string; currency: "HUF" | "EUR" }; comparables: Comparable[]; check: PriceCheck };

export async function priceStudy(user: CurrentUser, propertyId: string): Promise<PriceStudy | null> {
  if (!UUID.test(propertyId)) return null;
  const supabase = await db();
  const { data: p } = await supabase
    .from("properties")
    .select("id, title, property_type, listing_type, city, district, area_sqm, room_count, price, currency")
    .eq("id", propertyId)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (!p) return null;
  const subject = {
    id: p.id,
    title: p.title,
    currency: p.currency,
    propertyType: p.property_type,
    listingType: p.listing_type,
    city: p.city,
    district: p.district,
    areaSqm: p.area_sqm != null ? Number(p.area_sqm) : null,
    rooms: p.room_count != null ? Number(p.room_count) : null,
    price: p.price != null ? Number(p.price) : null,
  };
  const { data: rows } = await supabase
    .from("properties")
    .select("id, title, city, district, area_sqm, room_count, price, currency, status, updated_at, created_at")
    .eq("organization_id", user.organization.id)
    .eq("property_type", p.property_type)
    .eq("listing_type", p.listing_type)
    .eq("currency", p.currency)
    .neq("id", p.id)
    .not("price", "is", null)
    .not("area_sqm", "is", null)
    .limit(2000);
  const candidates = (rows ?? []).filter((r) => isComparable(subject, { city: r.city, district: r.district, areaSqm: Number(r.area_sqm), rooms: r.room_count != null ? Number(r.room_count) : null }));
  const ids = candidates.map((c) => c.id);
  const { data: deals } = ids.length ? await supabase.from("deals").select("property_id, agreed_price, closed_at").in("property_id", ids).eq("status", "won").not("agreed_price", "is", null) : { data: [] };
  const agreed = new Map((deals ?? []).map((d) => [d.property_id as string, { price: Number(d.agreed_price), date: (d.closed_at as string | null) ?? "" }]));
  const comparables: Comparable[] = candidates
    .map((r) => {
      const a = agreed.get(r.id);
      return {
        id: r.id,
        title: r.title,
        place: [r.city, r.district].filter(Boolean).join(", "),
        areaSqm: Number(r.area_sqm),
        rooms: r.room_count != null ? Number(r.room_count) : null,
        price: a?.price ?? Number(r.price),
        basis: a ? ("agreed" as const) : ("asking" as const),
        status: r.status,
        date: (a?.date || r.updated_at || r.created_at).slice(0, 10),
      };
    })
    .sort((x, y) => (x.basis === y.basis ? y.date.localeCompare(x.date) : x.basis === "agreed" ? -1 : 1))
    .slice(0, 30);
  return { subject, comparables, check: priceCheck(subject, comparables) };
}
