import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { startOfZonedDay } from "@/lib/i18n/timezone";
import { createClient } from "@/lib/supabase/server";
import type { DashboardData, Ref, TaskItem } from "@/lib/types/view-models";

const OPEN_TASK = ["todo", "in_progress"];
const INACTIVE_CLIENT = "(converted,lost,archived)";
const num = (v: unknown) => (v == null ? null : Number(v));

/**
 * Everything the dashboard shows, from the user's workspace only. Client
 * follow-up dates count as due items next to tasks, labelled as such.
 */
export async function getDashboardData(user: CurrentUser, now: Date): Promise<DashboardData> {
  const supabase = await createClient();
  const org = user.organization.id;
  const today = startOfZonedDay(now, user.timezone).toISOString();
  const tomorrow = startOfZonedDay(now, user.timezone, 1).toISOString();

  const [tasks, followUps, activity, properties, clients, activeClients, activeProperties] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_at, priority, client_id, property_id")
      .eq("organization_id", org)
      .in("status", OPEN_TASK)
      .lt("due_at", tomorrow)
      .order("due_at")
      .limit(50),
    supabase
      .from("clients")
      .select("id, full_name, next_follow_up_at")
      .eq("organization_id", org)
      .is("archived_at", null)
      .lt("next_follow_up_at", tomorrow)
      .order("next_follow_up_at")
      .limit(50),
    supabase
      .from("interactions")
      .select("id, interaction_type, occurred_at, summary, client_id")
      .eq("organization_id", org)
      .order("occurred_at", { ascending: false })
      .limit(5),
    supabase
      .from("properties")
      .select("id, title, property_type, status, city, district, price, currency, area_sqm, room_count, created_at")
      .eq("organization_id", org)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("clients")
      .select("id, full_name, email, phone, client_type, status, budget_min, budget_max, preferred_locations, next_follow_up_at, updated_at")
      .eq("organization_id", org)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .is("archived_at", null)
      .not("status", "in", INACTIVE_CLIENT),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .is("archived_at", null)
      .eq("status", "active"),
  ]);
  for (const r of [tasks, followUps, activity, properties, clients, activeClients, activeProperties]) {
    if (r.error) throw new Error(`Failed to load dashboard: ${r.error.message}`);
  }

  // Names for tasks and interactions, fetched once.
  const clientIds = [
    ...new Set([...(tasks.data ?? []).map((t) => t.client_id), ...(activity.data ?? []).map((a) => a.client_id)].filter(Boolean)),
  ] as string[];
  const propertyIds = [...new Set((tasks.data ?? []).map((t) => t.property_id).filter(Boolean))] as string[];
  const [clientNames, propertyNames] = await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id, full_name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
    propertyIds.length
      ? supabase.from("properties").select("id, title").in("id", propertyIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
  ]);
  const clientRef = new Map((clientNames.data ?? []).map((c): [string, Ref] => [c.id, { id: c.id, name: c.full_name }]));
  const propertyRef = new Map((propertyNames.data ?? []).map((p): [string, Ref] => [p.id, { id: p.id, name: p.title }]));

  const taskItems: TaskItem[] = (tasks.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.due_at,
    priority: t.priority,
    client: t.client_id ? (clientRef.get(t.client_id) ?? null) : null,
    property: t.property_id ? (propertyRef.get(t.property_id) ?? null) : null,
  }));
  const followUpItems: TaskItem[] = (followUps.data ?? []).map((c) => ({
    id: `follow-up-${c.id}`,
    title: "Utánkövetés esedékes",
    dueAt: c.next_follow_up_at,
    priority: "normal",
    client: { id: c.id, name: c.full_name },
    property: null,
  }));
  const due = [...taskItems, ...followUpItems].sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  return {
    userFirstName: user.firstName,
    tasksToday: due.filter((t) => t.dueAt != null && t.dueAt >= today),
    overdue: due.filter((t) => t.dueAt != null && t.dueAt < today),
    activity: (activity.data ?? []).map((a) => ({
      id: a.id,
      type: a.interaction_type,
      occurredAt: a.occurred_at,
      summary: a.summary ?? "",
      client: a.client_id ? (clientRef.get(a.client_id) ?? null) : null,
    })),
    recentProperties: (properties.data ?? []).map((p) => ({
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
    })),
    recentClients: (clients.data ?? []).map((c) => ({
      id: c.id,
      fullName: c.full_name,
      phone: c.phone,
      email: c.email,
      clientType: c.client_type,
      status: c.status,
      budgetMin: num(c.budget_min),
      budgetMax: num(c.budget_max),
      preferredLocations: c.preferred_locations ?? [],
      nextFollowUpAt: c.next_follow_up_at,
      updatedAt: c.updated_at,
    })),
    // AI suggestions arrive in phase 2.
    suggestions: [],
    counts: { activeClients: activeClients.count ?? 0, activeProperties: activeProperties.count ?? 0 },
  };
}
