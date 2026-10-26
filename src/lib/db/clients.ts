import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { startOfZonedDay } from "@/lib/i18n/timezone";
import { searchTerm } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import type { ClientDetail, ClientListItem, PropertyListItem, TaskItem } from "@/lib/types/view-models";

// Row shape of public.clients as selected below (hand-written until DB types are generated).
type ClientRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  client_type: ClientListItem["clientType"];
  status: ClientListItem["status"];
  budget_min: number | null;
  budget_max: number | null;
  preferred_locations: string[];
  preferred_property_types: string[];
  min_rooms: number | null;
  min_bedrooms: number | null;
  min_area_sqm: number | null;
  max_area_sqm: number | null;
  preferred_condition: string | null;
  desired_move_date: string | null;
  other_requirements: string | null;
  lead_source: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type ClientListRow = Pick<
  ClientRow,
  | "id" | "full_name" | "email" | "phone" | "client_type" | "status" | "budget_min" | "budget_max"
  | "preferred_locations" | "next_follow_up_at" | "updated_at" | "archived_at"
>;

const LIST_COLUMNS =
  "id, full_name, email, phone, client_type, status, budget_min, budget_max, preferred_locations, next_follow_up_at, updated_at, archived_at";

const num = (v: unknown) => (v == null ? null : Number(v));

function toListItem(r: ClientListRow): ClientListItem {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email,
    clientType: r.client_type,
    status: r.status,
    budgetMin: num(r.budget_min),
    budgetMax: num(r.budget_max),
    preferredLocations: r.preferred_locations ?? [],
    nextFollowUpAt: r.next_follow_up_at,
    updatedAt: r.updated_at,
  };
}

export type ClientListFilters = {
  q?: string;
  status?: string;
  type?: string;
  followUp?: "overdue" | "today" | "week" | "none";
  /** Budget in millions of forints; matches clients whose range contains it. */
  budgetM?: number;
  location?: string;
  archived?: boolean;
};

export const LIST_LIMIT = 100;

export async function listClients(user: CurrentUser, f: ClientListFilters, now = new Date()) {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("organization_id", user.organization.id);

  query = f.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  if (f.q) {
    const term = searchTerm(f.q);
    const digits = f.q.replace(/\D/g, "");
    const conditions = term ? [`search_text.ilike.*${term}*`] : [];
    if (digits.length >= 3) conditions.push(`phone_digits.like.*${digits}*`);
    if (conditions.length) query = query.or(conditions.join(","));
  }
  if (f.status) query = query.eq("status", f.status);
  if (f.type) query = query.eq("client_type", f.type);
  if (f.location) {
    const term = searchTerm(f.location);
    if (term) query = query.ilike("locations_text", `%${term}%`);
  }
  if (f.budgetM != null) {
    const v = Math.round(f.budgetM * 1_000_000);
    query = query
      .or(`budget_min.is.null,budget_min.lte.${v}`)
      .or(`budget_max.is.null,budget_max.gte.${v}`)
      .or("budget_min.not.is.null,budget_max.not.is.null");
  }

  const today = startOfZonedDay(now, user.timezone);
  switch (f.followUp) {
    case "overdue":
      query = query.lt("next_follow_up_at", now.toISOString());
      break;
    case "today":
      query = query
        .gte("next_follow_up_at", today.toISOString())
        .lt("next_follow_up_at", startOfZonedDay(now, user.timezone, 1).toISOString());
      break;
    case "week":
      query = query
        .gte("next_follow_up_at", now.toISOString())
        .lt("next_follow_up_at", startOfZonedDay(now, user.timezone, 7).toISOString());
      break;
    case "none":
      query = query.is("next_follow_up_at", null);
      break;
  }

  query = f.followUp && f.followUp !== "none"
    ? query.order("next_follow_up_at", { ascending: true })
    : query.order("updated_at", { ascending: false });

  const { data, count, error } = await query.limit(LIST_LIMIT);
  if (error) throw new Error(`Failed to list clients: ${error.message}`);
  return { clients: (data as ClientListRow[]).map(toListItem), total: count ?? 0 };
}

export async function countArchivedClients(user: CurrentUser) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", user.organization.id)
    .not("archived_at", "is", null);
  if (error) throw new Error(`Failed to count archived clients: ${error.message}`);
  return count ?? 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The raw row, for edit forms. Null when missing or not in the user's workspace. */
export async function getClientRow(user: CurrentUser, id: string): Promise<ClientRow | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, full_name, email, phone, client_type, status, budget_min, budget_max, preferred_locations, preferred_property_types, min_rooms, min_bedrooms, min_area_sqm, max_area_sqm, preferred_condition, desired_move_date, other_requirements, lead_source, notes, last_contacted_at, next_follow_up_at, created_at, updated_at, archived_at",
    )
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load client: ${error.message}`);
  return data as ClientRow | null;
}

export type ClientRowData = ClientRow;

export async function getClientDetail(
  user: CurrentUser,
  id: string,
): Promise<(ClientDetail & { archivedAt: string | null }) | null> {
  const row = await getClientRow(user, id);
  if (!row) return null;
  const supabase = await createClient();

  const [interactions, tasks, links] = await Promise.all([
    supabase
      .from("interactions")
      .select("id, interaction_type, occurred_at, summary, notes, outcome, property_id, source")
      .eq("client_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("tasks")
      .select("id, title, due_at, priority, property_id")
      .eq("client_id", id)
      .in("status", ["todo", "in_progress"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase.from("property_clients").select("property_id, relation").eq("client_id", id).limit(20),
  ]);
  for (const r of [interactions, tasks, links]) {
    if (r.error) throw new Error(`Failed to load client details: ${r.error.message}`);
  }

  const propertyIds = [
    ...new Set([
      ...(interactions.data ?? []).map((i) => i.property_id),
      ...(tasks.data ?? []).map((t) => t.property_id),
      ...(links.data ?? []).map((l) => l.property_id),
    ].filter(Boolean) as string[]),
  ];
  const properties = propertyIds.length
    ? await supabase
        .from("properties")
        .select("id, title, property_type, status, city, district, price, currency, area_sqm, room_count, created_at")
        .in("id", propertyIds)
    : { data: [], error: null };
  if (properties.error) throw new Error(`Failed to load properties: ${properties.error.message}`);

  const propertyById = new Map(
    (properties.data ?? []).map((p): [string, PropertyListItem] => [
      p.id,
      {
        id: p.id,
        title: p.title,
        propertyType: p.property_type,
        status: p.status,
        city: p.city,
        district: p.district,
        price: num(p.price),
        currency: p.currency,
        areaSqm: num(p.area_sqm),
        roomCount: num(p.room_count),
        createdAt: p.created_at,
      },
    ]),
  );
  const propertyRef = (pid: string | null) => {
    const p = pid ? propertyById.get(pid) : undefined;
    return p ? { id: p.id, name: p.title } : null;
  };

  return {
    ...toListItem(row),
    notes: row.notes,
    createdAt: row.created_at,
    lastContactedAt: row.last_contacted_at,
    leadSource: row.lead_source,
    archivedAt: row.archived_at,
    requirements: {
      propertyTypes: row.preferred_property_types ?? [],
      minRooms: num(row.min_rooms),
      minBedrooms: num(row.min_bedrooms),
      minAreaSqm: num(row.min_area_sqm),
      maxAreaSqm: num(row.max_area_sqm),
      condition: row.preferred_condition,
      desiredMoveDate: row.desired_move_date,
      other: row.other_requirements,
    },
    // AI summaries arrive in phase 2.
    aiSummary: null,
    interactions: (interactions.data ?? []).map((i) => ({
      id: i.id,
      type: i.interaction_type,
      occurredAt: i.occurred_at,
      summary: i.summary ?? "",
      notes: i.notes,
      source: i.source,
      outcome: i.outcome,
      client: null,
      property: propertyRef(i.property_id),
    })),
    tasks: (tasks.data ?? []).map(
      (t): TaskItem => ({
        id: t.id,
        title: t.title,
        dueAt: t.due_at,
        priority: t.priority,
        client: null,
        property: propertyRef(t.property_id),
      }),
    ),
    relatedProperties: (links.data ?? [])
      .map((l) => {
        const p = propertyById.get(l.property_id);
        return p ? { ...p, relation: l.relation } : null;
      })
      .filter((p) => p !== null),
  };
}
