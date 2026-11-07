import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { commission } from "@/lib/deals/logic";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import { db } from "@/lib/supabase/db";
import { listTeam } from "@/lib/team";
import { lastWeek, type WeekNumbers } from "./week-text";

// Last week in the office, against the week before: for owners and admins on
// the dashboard (Monday to Wednesday) and in a Monday-morning notification.
// Uses db(), so the cron job can run it for each workspace.

async function numbers(user: CurrentUser, fromDay: string, toDay: string) {
  const supabase = await db();
  const org = user.organization.id;
  const from = zonedLocalToUtc(`${fromDay}T00:00`)!;
  const to = zonedLocalToUtc(`${toDay}T00:00`)!;
  const [leads, viewings, listings, won] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("organization_id", org).gte("created_at", from).lt("created_at", to),
    supabase.from("viewings").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("status", "completed").gte("starts_at", from).lt("starts_at", to),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", org).gte("created_at", from).lt("created_at", to),
    supabase
      .from("deals")
      .select("assigned_to, agreed_price, commission_percent, commission_amount")
      .eq("organization_id", org)
      .eq("status", "won")
      .gte("closed_at", from)
      .lt("closed_at", to)
      .limit(1000),
  ]);
  const deals = (won.data ?? []).map((d) => ({
    agent: d.assigned_to as string | null,
    commission:
      commission({
        agreed_price: d.agreed_price == null ? null : Number(d.agreed_price),
        commission_percent: d.commission_percent == null ? null : Number(d.commission_percent),
        commission_amount: d.commission_amount == null ? null : Number(d.commission_amount),
      }) ?? 0,
  }));
  const week: WeekNumbers = {
    leads: leads.count ?? 0,
    viewings: viewings.count ?? 0,
    listings: listings.count ?? 0,
    dealsWon: deals.length,
    commission: deals.reduce((s, d) => s + d.commission, 0),
  };
  return { week, deals };
}

export type WeekSummary = { from: string; to: string; week: WeekNumbers; before: WeekNumbers; star: { name: string; commission: number; deals: number } | null };

export async function weekSummary(user: CurrentUser, now: Date): Promise<WeekSummary> {
  const today = utcToZonedLocal(now.toISOString()).slice(0, 10);
  const w = lastWeek(today);
  const [cur, prev, { members }] = await Promise.all([numbers(user, w.from, w.to), numbers(user, w.previousFrom, w.from), listTeam(user)]);
  // The week's star: most commission, then most deals.
  const per = new Map<string, { commission: number; deals: number }>();
  for (const d of cur.deals) {
    if (!d.agent) continue;
    const x = per.get(d.agent) ?? { commission: 0, deals: 0 };
    per.set(d.agent, { commission: x.commission + d.commission, deals: x.deals + 1 });
  }
  const best = [...per.entries()].sort((a, b) => b[1].commission - a[1].commission || b[1].deals - a[1].deals)[0];
  const name = best ? members.find((m) => m.userId === best[0])?.name : null;
  return { from: w.from, to: w.to, week: cur.week, before: prev.week, star: best && name ? { name, ...best[1] } : null };
}
