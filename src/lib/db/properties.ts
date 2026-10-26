import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { searchTerm } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import type { ActivityItem, ClientListItem, PropertyListItem, Ref, TaskItem } from "@/lib/types/view-models";

// Row shape of public.properties as selected below (hand-written until DB types are generated).
export type PropertyRow = {
  id: string;
  title: string;
  reference_number: string | null;
  property_type: PropertyListItem["propertyType"];
  status: PropertyListItem["status"];
  listing_type: "sale" | "rent";
  listing_source: string | null;
  owner_client_id: string | null;
  country: string;
  city: string | null;
  district: string | null;
  address: string | null;
  postal_code: string | null;
  price: number | null;
  currency: "HUF" | "EUR";
  area_sqm: number | null;
  room_count: number | null;
  bedroom_count: number | null;
  bathroom_count: number | null;
  floor: string | null;
  building_type: string | null;
  condition: string | null;
  energy_rating: string | null;
  has_balcony: boolean | null;
  has_garden: boolean | null;
  has_parking: boolean | null;
  description: string | null;
  internal_notes: string | null;
  /** The portal listing it was imported from. */
  source_url: string | null;
  features: { video_links?: string[] } & Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

const ROW_COLUMNS =
  "id, title, reference_number, property_type, status, listing_type, listing_source, owner_client_id, country, city, district, address, postal_code, price, currency, area_sqm, room_count, bedroom_count, bathroom_count, floor, building_type, condition, energy_rating, has_balcony, has_garden, has_parking, description, internal_notes, source_url, features, created_at, updated_at, archived_at";
const LIST_COLUMNS =
  "id, title, property_type, status, listing_type, city, district, price, currency, area_sqm, room_count, created_at";

const num = (v: unknown) => (v == null ? null : Number(v));

type ListRow = Pick<
  PropertyRow,
  "id" | "title" | "property_type" | "status" | "listing_type" | "city" | "district" | "price" | "currency" | "area_sqm" | "room_count" | "created_at"
>;

export type PropertyListEntry = PropertyListItem & { listingType: "sale" | "rent" };

function toListItem(r: ListRow): PropertyListEntry {
  return {
    id: r.id,
    title: r.title,
    propertyType: r.property_type,
    status: r.status,
    listingType: r.listing_type,
    city: r.city,
    district: r.district,
    price: num(r.price),
    currency: r.currency,
    areaSqm: num(r.area_sqm),
    roomCount: num(r.room_count),
    createdAt: r.created_at,
  };
}

export type PropertyListFilters = {
  q?: string;
  type?: string;
  status?: string;
  listing?: "sale" | "rent";
  /** Prices in millions of forints; applied to HUF listings only. */
  minPriceM?: number;
  maxPriceM?: number;
  minRooms?: number;
  minArea?: number;
  maxArea?: number;
  balcony?: boolean;
  garden?: boolean;
  parking?: boolean;
  archived?: boolean;
};

export const LIST_LIMIT = 100;

export async function listProperties(user: CurrentUser, f: PropertyListFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("properties")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("organization_id", user.organization.id);

  query = f.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  if (f.q) {
    const term = searchTerm(f.q);
    if (term) query = query.ilike("search_text", `%${term}%`);
  }
  if (f.type) query = query.eq("property_type", f.type);
  if (f.status) query = query.eq("status", f.status);
  if (f.listing) query = query.eq("listing_type", f.listing);
  if (f.minPriceM != null || f.maxPriceM != null) {
    query = query.eq("currency", "HUF");
    if (f.minPriceM != null) query = query.gte("price", Math.round(f.minPriceM * 1_000_000));
    if (f.maxPriceM != null) query = query.lte("price", Math.round(f.maxPriceM * 1_000_000));
  }
  if (f.minRooms != null) query = query.gte("room_count", f.minRooms);
  if (f.minArea != null) query = query.gte("area_sqm", f.minArea);
  if (f.maxArea != null) query = query.lte("area_sqm", f.maxArea);
  if (f.balcony) query = query.eq("has_balcony", true);
  if (f.garden) query = query.eq("has_garden", true);
  if (f.parking) query = query.eq("has_parking", true);

  const { data, count, error } = await query.order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw new Error(`Failed to list properties: ${error.message}`);
  return { properties: (data as ListRow[]).map(toListItem), total: count ?? 0 };
}

export async function countArchivedProperties(user: CurrentUser) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", user.organization.id)
    .not("archived_at", "is", null);
  if (error) throw new Error(`Failed to count archived properties: ${error.message}`);
  return count ?? 0;
}

/** Clients that can be picked as owner: sellers and owners first, then everyone else. */
export async function listOwnerOptions(user: CurrentUser) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, client_type")
    .eq("organization_id", user.organization.id)
    .is("archived_at", null)
    .order("full_name")
    .limit(500);
  if (error) throw new Error(`Failed to list owners: ${error.message}`);
  const rank = (t: string) => (t === "owner" || t === "seller" ? 0 : 1);
  return (data ?? [])
    .sort((a, b) => rank(a.client_type) - rank(b.client_type))
    .map((c) => ({ id: c.id, name: c.full_name, clientType: c.client_type as ClientListItem["clientType"] }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The raw row, for edit forms. Null when missing or not in the user's workspace. */
export async function getPropertyRow(user: CurrentUser, id: string): Promise<PropertyRow | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(ROW_COLUMNS)
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load property: ${error.message}`);
  return data as PropertyRow | null;
}

export type PropertyDetail = PropertyRow & {
  owner: Ref | null;
  relatedClients: (Ref & { relation: string })[];
  interactions: (ActivityItem & { outcome: string | null })[];
  tasks: TaskItem[];
};

export async function getPropertyDetail(user: CurrentUser, id: string): Promise<PropertyDetail | null> {
  const row = await getPropertyRow(user, id);
  if (!row) return null;
  const supabase = await createClient();

  const [links, interactions, tasks] = await Promise.all([
    supabase.from("property_clients").select("client_id, relation").eq("property_id", id).limit(50),
    supabase
      .from("interactions")
      .select("id, interaction_type, occurred_at, summary, outcome, client_id")
      .eq("property_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("tasks")
      .select("id, title, due_at, priority, client_id")
      .eq("property_id", id)
      .in("status", ["todo", "in_progress"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(20),
  ]);
  for (const r of [links, interactions, tasks]) {
    if (r.error) throw new Error(`Failed to load property details: ${r.error.message}`);
  }

  const clientIds = [
    ...new Set(
      [
        row.owner_client_id,
        ...(links.data ?? []).map((l) => l.client_id),
        ...(interactions.data ?? []).map((i) => i.client_id),
        ...(tasks.data ?? []).map((t) => t.client_id),
      ].filter(Boolean) as string[],
    ),
  ];
  const clients = clientIds.length
    ? await supabase.from("clients").select("id, full_name").in("id", clientIds)
    : { data: [] as { id: string; full_name: string }[], error: null };
  if (clients.error) throw new Error(`Failed to load clients: ${clients.error.message}`);
  const ref = new Map((clients.data ?? []).map((c): [string, Ref] => [c.id, { id: c.id, name: c.full_name }]));
  const clientRef = (cid: string | null) => (cid ? (ref.get(cid) ?? null) : null);

  return {
    ...row,
    price: num(row.price),
    area_sqm: num(row.area_sqm),
    room_count: num(row.room_count),
    owner: clientRef(row.owner_client_id),
    relatedClients: (links.data ?? [])
      .map((l) => {
        const c = clientRef(l.client_id);
        return c ? { ...c, relation: l.relation } : null;
      })
      .filter((c) => c !== null),
    interactions: (interactions.data ?? []).map((i) => ({
      id: i.id,
      type: i.interaction_type,
      occurredAt: i.occurred_at,
      summary: i.summary ?? "",
      outcome: i.outcome,
      client: clientRef(i.client_id),
    })),
    tasks: (tasks.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      dueAt: t.due_at,
      priority: t.priority,
      client: clientRef(t.client_id),
      property: null,
    })),
  };
}

/** Properties a client owns, for the client page. */
export async function listOwnedProperties(user: CurrentUser, clientId: string): Promise<PropertyListEntry[]> {
  if (!UUID.test(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(LIST_COLUMNS)
    .eq("organization_id", user.organization.id)
    .eq("owner_client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Failed to list owned properties: ${error.message}`);
  return (data as ListRow[]).map(toListItem);
}
