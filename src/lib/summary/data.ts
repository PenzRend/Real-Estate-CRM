import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { commission } from "@/lib/deals/logic";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import { db } from "@/lib/supabase/db";
import { listTeam } from "@/lib/team";
import { periodOf, type Period, type PeriodKind, type SummaryNumbers } from "./period";

// The numbers behind a daily, weekly or monthly summary, for one agent or the
// whole office: what happened in the period against the one before, what is
// coming up, and who is going cold. Uses db(), so the cron job can run it.

const COLD_DAYS = 14;
const INACTIVE = ["converted", "lost", "archived"];

type Row = Record<string, unknown>;
const who = (r: Row, ...cols: string[]) => (cols.map((c) => r[c]).find((v) => v != null) as string | undefined) ?? null;

function empty(): SummaryNumbers {
  return { newClients: 0, conversations: 0, viewings: 0, newListings: 0, offers: 0, dealsWon: 0, commission: 0, tasksDone: 0 };
}

/** Everything that happened between two local days, counted per person. */
async function happened(user: CurrentUser, fromDay: string, toDay: string, now: Date) {
  const supabase = await db();
  const org = user.organization.id;
  const from = zonedLocalToUtc(`${fromDay}T00:00`)!;
  const to = zonedLocalToUtc(`${toDay}T00:00`)!;
  // A viewing counts once it has started; one still ahead today is not "held" yet.
  const viewingsTo = new Date(Math.min(new Date(to).getTime(), now.getTime())).toISOString();
  const [clients, talks, viewings, listings, offers, won, tasks] = await Promise.all([
    supabase.from("clients").select("assigned_to, created_by").eq("organization_id", org).gte("created_at", from).lt("created_at", to).limit(5000),
    supabase.from("interactions").select("created_by").eq("organization_id", org).in("interaction_type", ["call", "meeting", "email"]).gte("occurred_at", from).lt("occurred_at", to).limit(10000),
    supabase.from("viewings").select("calendar_user_id, created_by").eq("organization_id", org).neq("status", "cancelled").gte("starts_at", from).lt("starts_at", viewingsTo).limit(5000),
    supabase.from("properties").select("assigned_to, created_by").eq("organization_id", org).gte("created_at", from).lt("created_at", to).limit(5000),
    supabase.from("deals").select("assigned_to, created_by").eq("organization_id", org).gte("created_at", from).lt("created_at", to).limit(5000),
    supabase
      .from("deals")
      .select("assigned_to, created_by, agreed_price, commission_percent, commission_amount")
      .eq("organization_id", org)
      .eq("status", "won")
      .gte("closed_at", from)
      .lt("closed_at", to)
      .limit(5000),
    supabase.from("tasks").select("assigned_to, created_by").eq("organization_id", org).eq("status", "completed").gte("completed_at", from).lt("completed_at", to).limit(10000),
  ]);
  const per = new Map<string, SummaryNumbers>();
  const add = (person: string | null, key: keyof SummaryNumbers, by = 1) => {
    const id = person ?? "";
    const n = per.get(id) ?? empty();
    n[key] += by;
    per.set(id, n);
  };
  for (const r of (clients.data ?? []) as Row[]) add(who(r, "assigned_to", "created_by"), "newClients");
  for (const r of (talks.data ?? []) as Row[]) add(who(r, "created_by"), "conversations");
  for (const r of (viewings.data ?? []) as Row[]) add(who(r, "calendar_user_id", "created_by"), "viewings");
  for (const r of (listings.data ?? []) as Row[]) add(who(r, "assigned_to", "created_by"), "newListings");
  for (const r of (offers.data ?? []) as Row[]) add(who(r, "assigned_to", "created_by"), "offers");
  for (const r of (won.data ?? []) as Row[]) {
    const person = who(r, "assigned_to", "created_by");
    add(person, "dealsWon");
    const c = commission({
      agreed_price: r.agreed_price == null ? null : Number(r.agreed_price),
      commission_percent: r.commission_percent == null ? null : Number(r.commission_percent),
      commission_amount: r.commission_amount == null ? null : Number(r.commission_amount),
    });
    if (c) add(person, "commission", c);
  }
  for (const r of (tasks.data ?? []) as Row[]) add(who(r, "assigned_to", "created_by"), "tasksDone");
  return per;
}

function total(per: Map<string, SummaryNumbers>, only: string | null): SummaryNumbers {
  const out = empty();
  for (const [person, n] of per) {
    if (only && person !== only) continue;
    for (const k of Object.keys(out) as (keyof SummaryNumbers)[]) out[k] += n[k];
  }
  return out;
}

export type SummaryScope = "me" | "office";

export type Summary = {
  period: Period;
  scope: SummaryScope;
  now: SummaryNumbers;
  before: SummaryNumbers;
  /** Office only: each agent's numbers, best first. */
  agents: { id: string; name: string; numbers: SummaryNumbers }[];
  /** For the period now running or ahead: viewings and tasks in the period after it. */
  coming: { viewings: { id: string; startsAt: string; client: string; place: string | null }[]; tasks: { id: string; title: string; dueAt: string }[] } | null;
  /** Active clients not contacted for two weeks, longest first. */
  cold: { id: string; name: string; lastContactedAt: string | null }[];
  overdueTasks: number;
};

export async function getSummary(user: CurrentUser, kind: PeriodKind, now: Date, { offset = 0, scope = "me" as SummaryScope } = {}): Promise<Summary> {
  const today = utcToZonedLocal(now.toISOString()).slice(0, 10);
  const period = periodOf(kind, today, offset);
  const office = scope === "office";
  const me = office ? null : user.id;
  const supabase = await db();
  const org = user.organization.id;
  const mine = (q: string) => (office ? null : q.replaceAll("$me", user.id));
  const to = zonedLocalToUtc(`${period.to}T00:00`)!;
  const nextTo = zonedLocalToUtc(`${period.nextTo}T00:00`)!;
  const current = period.to > today;

  let coldQuery = supabase
    .from("clients")
    .select("id, full_name, last_contacted_at")
    .eq("organization_id", org)
    .is("archived_at", null)
    .not("status", "in", `(${INACTIVE.join(",")})`)
    .lt("created_at", new Date(now.getTime() - COLD_DAYS * 86_400_000).toISOString())
    .or(`last_contacted_at.is.null,last_contacted_at.lt.${new Date(now.getTime() - COLD_DAYS * 86_400_000).toISOString()}`);
  const mineClients = mine("assigned_to.eq.$me,and(assigned_to.is.null,created_by.eq.$me)");
  if (mineClients) coldQuery = coldQuery.or(mineClients);

  let overdueQuery = supabase.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", org).in("status", ["todo", "in_progress"]).lt("due_at", now.toISOString());
  if (mineClients) overdueQuery = overdueQuery.or(mineClients);

  const [cur, prev, team, cold, overdue, coming] = await Promise.all([
    happened(user, period.from, period.to, now),
    happened(user, period.previousFrom, period.from, now),
    office ? listTeam(user).then((t) => t.members) : Promise.resolve([]),
    coldQuery.order("last_contacted_at", { ascending: true, nullsFirst: true }).limit(6),
    overdueQuery,
    current ? comingUp(user, to, nextTo) : Promise.resolve(null),
  ]);

  const agents = office
    ? team
        .map((m) => ({ id: m.userId, name: m.name, numbers: cur.get(m.userId) ?? empty() }))
        .sort((a, b) => b.numbers.commission - a.numbers.commission || b.numbers.dealsWon - a.numbers.dealsWon || b.numbers.viewings - a.numbers.viewings || b.numbers.conversations - a.numbers.conversations)
    : [];

  return {
    period,
    scope,
    now: total(cur, me),
    before: total(prev, me),
    agents,
    coming,
    cold: (cold.data ?? []).map((c) => ({ id: c.id as string, name: c.full_name as string, lastContactedAt: (c.last_contacted_at as string | null) ?? null })),
    overdueTasks: overdue.count ?? 0,
  };
}

/** The agent's own viewings and open tasks between two moments. */
async function comingUp(user: CurrentUser, from: string, to: string): Promise<NonNullable<Summary["coming"]>> {
  const supabase = await db();
  const org = user.organization.id;
  const [viewings, tasks] = await Promise.all([
    supabase
      .from("viewings")
      .select("id, starts_at, location, client:clients(full_name), property:properties(address, title)")
      .eq("organization_id", org)
      .eq("status", "scheduled")
      .or(`calendar_user_id.eq.${user.id},and(calendar_user_id.is.null,created_by.eq.${user.id})`)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at")
      .limit(20),
    supabase
      .from("tasks")
      .select("id, title, due_at")
      .eq("organization_id", org)
      .in("status", ["todo", "in_progress"])
      .or(`assigned_to.eq.${user.id},and(assigned_to.is.null,created_by.eq.${user.id})`)
      .gte("due_at", from)
      .lt("due_at", to)
      .order("due_at")
      .limit(20),
  ]);
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? (v[0] ?? null) : v);
  return {
    viewings: (viewings.data ?? []).map((v) => {
      const client = one(v.client as { full_name: string } | { full_name: string }[] | null);
      const property = one(v.property as { address: string | null; title: string } | { address: string | null; title: string }[] | null);
      return { id: v.id as string, startsAt: v.starts_at as string, client: client?.full_name ?? "Ügyfél", place: (v.location as string | null) ?? property?.address ?? property?.title ?? null };
    }),
    tasks: (tasks.data ?? []).map((t) => ({ id: t.id as string, title: t.title as string, dueAt: t.due_at as string })),
  };
}
