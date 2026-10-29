import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { commission } from "@/lib/deals/logic";
import { zonedLocalToUtc } from "@/lib/i18n/timezone";
import { createClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/team";
import { monthBounds, officeMonth, type AgentTarget } from "./stats";

// The month's numbers per agent and the targets, for the Iroda page and the
// dashboard's "Havi céljaim".

export async function officeStats(user: CurrentUser, month: string) {
  const supabase = await createClient();
  const org = user.organization.id;
  const b = monthBounds(month);
  const from = zonedLocalToUtc(`${b.start}T00:00`)!;
  const to = zonedLocalToUtc(`${b.end}T00:00`)!;
  const [team, leads, viewings, listings, won, open, targets] = await Promise.all([
    listTeam(user),
    supabase.from("clients").select("assigned_to").eq("organization_id", org).gte("created_at", from).lt("created_at", to).limit(10_000),
    supabase.from("viewings").select("created_by").eq("organization_id", org).eq("status", "completed").gte("starts_at", from).lt("starts_at", to).limit(10_000),
    supabase.from("properties").select("assigned_to, created_by").eq("organization_id", org).gte("created_at", from).lt("created_at", to).limit(10_000),
    supabase.from("deals").select("assigned_to, agreed_price, commission_percent, commission_amount").eq("organization_id", org).eq("status", "won").gte("closed_at", from).lt("closed_at", to).limit(5000),
    supabase.from("deals").select("assigned_to, agreed_price, commission_percent, commission_amount").eq("organization_id", org).eq("status", "open").limit(5000),
    supabase.from("agent_targets").select("user_id, commission, deals, listings, viewings").eq("organization_id", org).eq("month", month),
  ]);
  const num = (v: unknown) => (v == null ? null : Number(v));
  const deal = (d: { assigned_to: string | null; agreed_price: unknown; commission_percent: unknown; commission_amount: unknown }) => ({
    agentId: d.assigned_to,
    commission: commission({ agreed_price: num(d.agreed_price), commission_percent: num(d.commission_percent), commission_amount: num(d.commission_amount) }),
  });
  return officeMonth({
    members: team.members.map((m) => ({ userId: m.userId, name: m.name })),
    leads: (leads.data ?? []).map((r) => r.assigned_to),
    viewings: (viewings.data ?? []).map((r) => r.created_by),
    listings: (listings.data ?? []).map((r) => r.assigned_to ?? r.created_by),
    wonDeals: (won.data ?? []).map(deal),
    openDeals: (open.data ?? []).map(deal),
    targets: (targets.data ?? []).map((t) => ({ userId: t.user_id, commission: num(t.commission), deals: t.deals, listings: t.listings, viewings: t.viewings })),
  });
}

export type TargetField = keyof AgentTarget;

export async function setTarget(user: CurrentUser, userId: string, month: string, field: TargetField, value: number | null) {
  if (user.organization.role === "member") return { ok: false as const, error: "Célt a tulajdonos vagy egy admin állíthat." };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !["commission", "deals", "listings", "viewings"].includes(field)) return { ok: false as const, error: "Érvénytelen cél." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("agent_targets")
    .upsert({ organization_id: user.organization.id, user_id: userId, month, [field]: value }, { onConflict: "organization_id,user_id,month" });
  if (error) {
    console.error("target save failed", error.code);
    return { ok: false as const, error: "A célt nem sikerült menteni." };
  }
  return { ok: true as const };
}

export async function leadSettings(user: CurrentUser) {
  const supabase = await createClient();
  const [{ data: org }, { data: members }] = await Promise.all([
    supabase.from("organizations").select("lead_assignment").eq("id", user.organization.id).maybeSingle(),
    supabase.from("organization_members").select("user_id, in_lead_rotation").eq("organization_id", user.organization.id),
  ]);
  return { mode: (org?.lead_assignment ?? "creator") as "creator" | "round_robin", inRotation: new Set((members ?? []).filter((m) => m.in_lead_rotation).map((m) => m.user_id as string)) };
}

export async function setLeadMode(user: CurrentUser, mode: "creator" | "round_robin") {
  if (user.organization.role === "member") return;
  const supabase = await createClient();
  await supabase.from("organizations").update({ lead_assignment: mode }).eq("id", user.organization.id);
}

export async function setInRotation(user: CurrentUser, userId: string, on: boolean) {
  if (user.organization.role === "member") return;
  const supabase = await createClient();
  await supabase.from("organization_members").update({ in_lead_rotation: on }).eq("organization_id", user.organization.id).eq("user_id", userId);
}
