import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth";
import { listTasks } from "@/lib/db/activity";
import { getClientDetail, listClients } from "@/lib/db/clients";
import { matchesForClient, matchesForProperty } from "@/lib/db/matches";
import { getPropertyDetail, listProperties } from "@/lib/db/properties";
import { startOfZonedDay } from "@/lib/i18n/timezone";
import { searchTerm } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { categoryLabels, type Match } from "@/lib/matching/match";
import {
  clientStatusLabels,
  clientTypeLabels,
  interactionTypeLabels,
  listingTypeLabels,
  propertyStatusLabels,
  propertyTypeLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/i18n/labels";

// Hungarian labels instead of internal codes, so answers read naturally.
const label = <T extends Record<string, string>>(map: T, key: string | null | undefined) =>
  key == null ? null : ((map as Record<string, string>)[key] ?? key);

/** Explicit lists, so the model cannot misread which requirement fits and which does not. */
function explainMatch(m: Match) {
  const pick = (statuses: string[]) => m.checks.filter((c) => statuses.includes(c.status)).map((c) => `${c.label}: ${c.detail}`);
  return {
    category: categoryLabels[m.category],
    fits: pick(["met"]),
    nearly_fits: pick(["close"]),
    does_not_fit: pick(["miss"]),
    no_data_in_listing: pick(["unknown"]),
  };
}

// The assistant's only way to see data: fixed, read-only, validated tools that
// run as the signed-in user (RLS) inside their workspace. Every record a tool
// returns gets a source reference ("S3") the answer can cite.

export type SourceType = "client" | "property" | "task" | "interaction" | "email";
export type Source = { ref: string; type: SourceType; id: string; label: string; href: string };

export class SourceRegistry {
  private byKey = new Map<string, Source>();
  private next = 1;

  add(type: SourceType, id: string, label: string, href: string): string {
    const key = `${type}:${id}`;
    const existing = this.byKey.get(key);
    if (existing) return existing.ref;
    const source = { ref: `S${this.next++}`, type, id, label, href };
    this.byKey.set(key, source);
    return source.ref;
  }

  get(ref: string) {
    return [...this.byKey.values()].find((s) => s.ref === ref);
  }
}

const budapest = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Budapest",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const when = (iso: string | null | undefined) => (iso ? budapest.format(new Date(iso)) : null);
const money = (n: number | null | undefined) => (n == null ? null : Math.round(n));

const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "must be an id returned by another tool");

export const toolSchemas = {
  search_clients: z.object({
    query: z.string().max(100).optional().describe("Name in base form (e.g. 'Teszt Kata', not 'Katáról'), email or phone."),
    status: z.enum(["new_lead", "contacted", "qualified", "active", "negotiation", "converted", "lost"]).optional(),
    follow_up: z.enum(["overdue", "today", "week", "none"]).optional().describe("Clients by next follow-up date."),
    budget_million_huf: z.number().positive().optional().describe("Clients whose budget range contains this amount (millions of HUF)."),
    location: z.string().max(100).optional().describe("Preferred location, e.g. 'XI. kerület' or 'Budaörs'."),
  }),
  get_client: z.object({ client_id: UUID }),
  search_properties: z.object({
    query: z.string().max(100).optional().describe("Title, address, district or reference number."),
    status: z.enum(["draft", "active", "reserved", "under_negotiation", "sold", "rented", "inactive"]).optional(),
    property_type: z.enum(["apartment", "house", "plot", "commercial", "other"]).optional(),
    listing_type: z.enum(["sale", "rent"]).optional(),
    min_price_million_huf: z.number().positive().optional(),
    max_price_million_huf: z.number().positive().optional(),
    min_rooms: z.number().positive().optional(),
  }),
  get_property: z.object({ property_id: UUID }),
  list_tasks: z.object({ view: z.enum(["today", "overdue", "upcoming", "completed"]) }),
  recent_interactions: z.object({
    days: z.number().int().min(1).max(90).default(7).describe("How many days back, counting today."),
    client_id: UUID.optional(),
  }),
  search_emails: z.object({
    query: z.string().max(100).optional().describe("Words in the subject or sender."),
    status: z.enum(["new", "processed", "ignored"]).optional(),
  }),
  find_matches: z
    .object({ client_id: UUID.optional(), property_id: UUID.optional() })
    .refine((v) => Boolean(v.client_id) !== Boolean(v.property_id), "Give exactly one of client_id or property_id."),
} as const;

export type ToolName = keyof typeof toolSchemas;

export const toolDescriptions: Record<ToolName, string> = {
  search_clients: "Find clients (buyers, sellers, owners, investors, tenants). Returns up to 20 with status, budget, wished locations, follow-up and last contact. Without filters returns the most recently updated active clients.",
  get_client: "Full record of one client: contact, requirements, notes, recent conversations, open tasks, and matching listings.",
  search_properties: "Find listings by text, status, type, sale/rent, price range (millions HUF) or minimum rooms. Returns up to 20.",
  get_property: "Full record of one listing: price, size, location, features, owner, conversations, open tasks and matching clients.",
  list_tasks: "Tasks and follow-ups: today, overdue, upcoming (including undated) or completed.",
  recent_interactions: "Logged calls, emails, meetings and viewings in the last N days, optionally for one client.",
  search_emails: "The user's imported emails (client emails and portal inquiries) by subject or sender, optionally by status (new = waiting to be processed).",
  find_matches: "Rule-based matches with reasons: listings for a client, or clients for a listing.",
};

type Ctx = { user: CurrentUser; sources: SourceRegistry; now: Date };

async function searchClients(ctx: Ctx, a: z.infer<typeof toolSchemas.search_clients>) {
  const { clients, total } = await listClients(
    ctx.user,
    { q: a.query, status: a.status, followUp: a.follow_up, budgetM: a.budget_million_huf, location: a.location, stemmedNames: true },
    ctx.now,
  );
  return {
    total,
    clients: clients.slice(0, 20).map((c) => ({
      ref: ctx.sources.add("client", c.id, c.fullName, `/clients/${c.id}`),
      id: c.id,
      name: c.fullName,
      type: label(clientTypeLabels, c.clientType),
      status: label(clientStatusLabels, c.status),
      phone: c.phone,
      budget_huf: c.budgetMin != null || c.budgetMax != null ? [money(c.budgetMin), money(c.budgetMax)] : null,
      locations: c.preferredLocations,
      next_follow_up: when(c.nextFollowUpAt),
    })),
  };
}

async function getClient(ctx: Ctx, a: z.infer<typeof toolSchemas.get_client>) {
  const [c, matches] = await Promise.all([getClientDetail(ctx.user, a.client_id), matchesForClient(ctx.user, a.client_id)]);
  if (!c) return { error: "Nincs ilyen ügyfél ebben a munkaterületben." };
  return {
    ref: ctx.sources.add("client", c.id, c.fullName, `/clients/${c.id}`),
    id: c.id,
    name: c.fullName,
    type: label(clientTypeLabels, c.clientType),
    status: label(clientStatusLabels, c.status),
    archived: Boolean(c.archivedAt),
    phone: c.phone,
    email: c.email,
    budget_huf: [money(c.budgetMin), money(c.budgetMax)],
    locations: c.preferredLocations,
    requirements: c.requirements,
    notes: c.notes,
    lead_source: c.leadSource,
    last_contacted: when(c.lastContactedAt),
    next_follow_up: when(c.nextFollowUpAt),
    created: when(c.createdAt),
    conversations: c.interactions.slice(0, 10).map((i) => ({
      ref: ctx.sources.add("interaction", i.id, `${c.fullName}: ${i.summary.slice(0, 60)}`, `/clients/${c.id}`),
      type: label(interactionTypeLabels, i.type),
      when: when(i.occurredAt),
      summary: i.summary,
      outcome: i.outcome,
      property: i.property?.name ?? null,
    })),
    open_tasks: c.tasks.map((t) => ({
      ref: ctx.sources.add("task", t.id, t.title, `/clients/${c.id}`),
      title: t.title,
      due: when(t.dueAt),
      priority: label(taskPriorityLabels, t.priority),
    })),
    matching_listings: matches.slice(0, 5).map((m) => ({
      ref: ctx.sources.add("property", m.property.id, m.property.title, `/properties/${m.property.id}`),
      title: m.property.title,
      ...explainMatch(m.match),
    })),
  };
}

async function searchProperties(ctx: Ctx, a: z.infer<typeof toolSchemas.search_properties>) {
  const { properties, total } = await listProperties(ctx.user, {
    q: a.query,
    status: a.status,
    type: a.property_type,
    listing: a.listing_type,
    minPriceM: a.min_price_million_huf,
    maxPriceM: a.max_price_million_huf,
    minRooms: a.min_rooms,
  });
  return {
    total,
    properties: properties.slice(0, 20).map((p) => ({
      ref: ctx.sources.add("property", p.id, p.title, `/properties/${p.id}`),
      id: p.id,
      title: p.title,
      status: label(propertyStatusLabels, p.status),
      type: label(propertyTypeLabels, p.propertyType),
      listing: label(listingTypeLabels, p.listingType),
      location: [p.city, p.district].filter(Boolean).join(", ") || null,
      price: money(p.price),
      currency: p.currency,
      area_sqm: p.areaSqm,
      rooms: p.roomCount,
    })),
  };
}

async function getProperty(ctx: Ctx, a: z.infer<typeof toolSchemas.get_property>) {
  const [p, matches] = await Promise.all([getPropertyDetail(ctx.user, a.property_id), matchesForProperty(ctx.user, a.property_id)]);
  if (!p) return { error: "Nincs ilyen ingatlan ebben a munkaterületben." };
  return {
    ref: ctx.sources.add("property", p.id, p.title, `/properties/${p.id}`),
    id: p.id,
    title: p.title,
    reference: p.reference_number,
    status: label(propertyStatusLabels, p.status),
    archived: Boolean(p.archived_at),
    type: label(propertyTypeLabels, p.property_type),
    listing: label(listingTypeLabels, p.listing_type),
    location: [p.postal_code, p.city, p.district].filter(Boolean).join(" ") || null,
    price: money(p.price),
    currency: p.currency,
    area_sqm: p.area_sqm,
    rooms: p.room_count,
    bedrooms: p.bedroom_count,
    features: { balcony: p.has_balcony, garden: p.has_garden, parking: p.has_parking },
    condition: p.condition,
    description: p.description?.slice(0, 1500) ?? null,
    owner: p.owner ? { ref: ctx.sources.add("client", p.owner.id, p.owner.name, `/clients/${p.owner.id}`), name: p.owner.name } : null,
    conversations: p.interactions.slice(0, 10).map((i) => ({ type: label(interactionTypeLabels, i.type), when: when(i.occurredAt), summary: i.summary, client: i.client?.name ?? null })),
    open_tasks: p.tasks.map((t) => ({ title: t.title, due: when(t.dueAt), client: t.client?.name ?? null })),
    matching_clients: matches.slice(0, 5).map((m) => ({
      ref: ctx.sources.add("client", m.client.id, m.client.full_name, `/clients/${m.client.id}`),
      name: m.client.full_name,
      ...explainMatch(m.match),
    })),
  };
}

async function tasks(ctx: Ctx, a: z.infer<typeof toolSchemas.list_tasks>) {
  const items = await listTasks(ctx.user, a.view, ctx.now);
  // Client follow-up dates are due items too, like on the dashboard.
  const supabase = await createClient();
  let followUps: { id: string; full_name: string; next_follow_up_at: string }[] = [];
  if (a.view === "today" || a.view === "overdue") {
    const today = startOfZonedDay(ctx.now, ctx.user.timezone).toISOString();
    const tomorrow = startOfZonedDay(ctx.now, ctx.user.timezone, 1).toISOString();
    let q = supabase
      .from("clients")
      .select("id, full_name, next_follow_up_at")
      .eq("organization_id", ctx.user.organization.id)
      .is("archived_at", null);
    q = a.view === "today" ? q.gte("next_follow_up_at", today).lt("next_follow_up_at", tomorrow) : q.lt("next_follow_up_at", today);
    followUps = ((await q.order("next_follow_up_at").limit(50)).data ?? []) as typeof followUps;
  }
  return {
    tasks: items.slice(0, 50).map((t) => ({
      ref: ctx.sources.add("task", t.id, t.title, t.client ? `/clients/${t.client.id}` : "/tasks"),
      title: t.title,
      due: when(t.dueAt),
      priority: label(taskPriorityLabels, t.priority),
      status: label(taskStatusLabels, t.status),
      client: t.client?.name ?? null,
      property: t.property?.name ?? null,
    })),
    client_follow_ups_due: followUps.map((c) => ({
      ref: ctx.sources.add("client", c.id, c.full_name, `/clients/${c.id}`),
      client: c.full_name,
      follow_up: when(c.next_follow_up_at),
    })),
  };
}

async function recentInteractions(ctx: Ctx, a: z.infer<typeof toolSchemas.recent_interactions>) {
  const supabase = await createClient();
  const since = new Date(ctx.now.getTime() - a.days * 86_400_000).toISOString();
  let q = supabase
    .from("interactions")
    .select("id, interaction_type, occurred_at, summary, outcome, client_id, property_id, source")
    .eq("organization_id", ctx.user.organization.id)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (a.client_id) q = q.eq("client_id", a.client_id);
  const { data, error } = await q;
  if (error) throw new Error(`recent_interactions failed: ${error.message}`);
  const rows = data ?? [];
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];
  const { data: clients } = clientIds.length ? await supabase.from("clients").select("id, full_name").in("id", clientIds) : { data: [] };
  const names = new Map((clients ?? []).map((c) => [c.id as string, c.full_name as string]));
  return {
    since: when(since),
    interactions: rows.map((r) => ({
      ref: ctx.sources.add(
        "interaction",
        r.id,
        `${names.get(r.client_id) ?? "Ingatlan"}: ${String(r.summary ?? "").slice(0, 60)}`,
        r.client_id ? `/clients/${r.client_id}` : `/properties/${r.property_id}`,
      ),
      type: label(interactionTypeLabels, r.interaction_type),
      when: when(r.occurred_at),
      client: r.client_id ? (names.get(r.client_id) ?? null) : null,
      summary: r.summary,
      outcome: r.outcome,
      recorded_with_ai: r.source === "ai_assisted",
    })),
  };
}

async function searchEmails(ctx: Ctx, a: z.infer<typeof toolSchemas.search_emails>) {
  const supabase = await createClient();
  let q = supabase
    .from("emails")
    .select("id, direction, from_email, from_name, subject, snippet, received_at, portal, client_id, status")
    .eq("user_id", ctx.user.id)
    .order("received_at", { ascending: false })
    .limit(20);
  if (a.status) q = q.eq("status", a.status);
  if (a.query) {
    const term = searchTerm(a.query);
    if (term) q = q.or(`subject.ilike.*${term}*,from_name.ilike.*${term}*,from_email.ilike.*${term}*`);
  }
  const { data, error } = await q;
  if (error) throw new Error(`search_emails failed: ${error.message}`);
  return {
    emails: (data ?? []).map((e) => ({
      ref: ctx.sources.add("email", e.id, e.subject ?? "(nincs tárgy)", e.status === "new" ? `/interactions/new?email=${e.id}` : "/inbox?view=processed"),
      direction: e.direction,
      from: e.from_name ?? e.from_email,
      subject: e.subject,
      snippet: e.snippet,
      received: when(e.received_at),
      portal: e.portal,
      status: e.status,
    })),
  };
}

async function findMatches(ctx: Ctx, a: z.infer<typeof toolSchemas.find_matches>) {
  if (a.client_id) {
    const matches = await matchesForClient(ctx.user, a.client_id);
    return {
      listings: matches.slice(0, 10).map((m) => ({
        ref: ctx.sources.add("property", m.property.id, m.property.title, `/properties/${m.property.id}`),
        title: m.property.title,
        price: money(m.property.price),
        ...explainMatch(m.match),
      })),
    };
  }
  const matches = await matchesForProperty(ctx.user, a.property_id!);
  return {
    clients: matches.slice(0, 10).map((m) => ({
      ref: ctx.sources.add("client", m.client.id, m.client.full_name, `/clients/${m.client.id}`),
      name: m.client.full_name,
      ...explainMatch(m.match),
    })),
  };
}

const handlers: { [K in ToolName]: (ctx: Ctx, args: z.infer<(typeof toolSchemas)[K]>) => Promise<unknown> } = {
  search_clients: searchClients,
  get_client: getClient,
  search_properties: searchProperties,
  get_property: getProperty,
  list_tasks: tasks,
  recent_interactions: recentInteractions,
  search_emails: searchEmails,
  find_matches: findMatches,
};

/** Validates the model's arguments and runs one tool. Errors become a message for the model, never an exception. */
export async function runTool(ctx: Ctx, name: string, rawArgs: unknown): Promise<string> {
  if (!(name in toolSchemas)) return JSON.stringify({ error: `Unknown tool ${name}` });
  const schema = toolSchemas[name as ToolName];
  const parsed = schema.safeParse(rawArgs ?? {});
  // Development aid: which tools the model chose (names and argument keys only, never data).
  if (process.env.NODE_ENV !== "production") {
    console.info(`[assistant] ${name}(${Object.keys((rawArgs as object) ?? {}).join(", ")})${parsed.success ? "" : " → invalid"}`);
  }
  if (!parsed.success) return JSON.stringify({ error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}` });
  try {
    const handler = handlers[name as ToolName] as (ctx: Ctx, args: unknown) => Promise<unknown>;
    const result = await handler(ctx, parsed.data);
    return JSON.stringify(result).slice(0, 30_000);
  } catch (error) {
    console.error("assistant tool failed", name, error instanceof Error ? error.message : error);
    return JSON.stringify({ error: "A lekérdezés nem sikerült." });
  }
}

export function toolJsonSchemas() {
  return (Object.keys(toolSchemas) as ToolName[]).map((name) => ({
    name,
    description: toolDescriptions[name],
    parameters: z.toJSONSchema(toolSchemas[name], { io: "input" }) as Record<string, unknown>,
  }));
}
