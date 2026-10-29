import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { zonedLocalToUtc } from "@/lib/i18n/timezone";
import { createClient } from "@/lib/supabase/server";
import { commission, commissionMonth, DEAL_STAGES, milestoneTasks, nextDeadline, propertyStatusFor, stageLabels, type DealStage, type DealStatus, type PartyRole } from "./logic";

// Deals: a listing's way from the buyer's offer to the commission. Moving a
// deal also moves the listing's status, writes a line on the clients'
// timelines, and keeps one task per key date (deposit, contract, financing,
// handover, commission) in step with the dates.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const COLUMNS =
  "id, property_id, buyer_client_id, seller_client_id, assigned_to, stage, status, lost_reason, agreed_price, currency, deposit_amount, deposit_due, deposit_paid_on, contract_on, financing_deadline, handover_on, commission_percent, commission_amount, commission_paid_on, notes, closed_at, created_at, updated_at";

type Row = {
  id: string;
  property_id: string;
  buyer_client_id: string | null;
  seller_client_id: string | null;
  assigned_to: string | null;
  stage: DealStage;
  status: DealStatus;
  lost_reason: string | null;
  agreed_price: number | null;
  currency: "HUF" | "EUR";
  deposit_amount: number | null;
  deposit_due: string | null;
  deposit_paid_on: string | null;
  contract_on: string | null;
  financing_deadline: string | null;
  handover_on: string | null;
  commission_percent: number | null;
  commission_amount: number | null;
  commission_paid_on: string | null;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Ref = { id: string; name: string };

export type Deal = Row & {
  property: Ref & { listingType: "sale" | "rent"; askingPrice: number | null };
  buyer: (Ref & { phone: string | null; email: string | null }) | null;
  seller: (Ref & { phone: string | null; email: string | null }) | null;
  agent: Ref | null;
  /** The commission as it stands: fixed, or the percentage of the agreed price. */
  commissionValue: number | null;
  next: { label: string; date: string } | null;
};

async function hydrate(user: CurrentUser, rows: Row[]): Promise<Deal[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const clientIds = [...new Set(rows.flatMap((r) => [r.buyer_client_id, r.seller_client_id]).filter(isUuid))];
  const [{ data: properties }, { data: clients }, { data: agents }] = await Promise.all([
    supabase.from("properties").select("id, title, listing_type, price").in("id", [...new Set(rows.map((r) => r.property_id))]),
    clientIds.length ? supabase.from("clients").select("id, full_name, phone, email").in("id", clientIds) : Promise.resolve({ data: [] as { id: string; full_name: string; phone: string | null; email: string | null }[] }),
    supabase.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => r.assigned_to).filter(isUuid))].concat("00000000-0000-0000-0000-000000000000")),
  ]);
  const p = new Map((properties ?? []).map((x) => [x.id as string, x]));
  const c = new Map((clients ?? []).map((x) => [x.id as string, x]));
  const a = new Map((agents ?? []).map((x) => [x.id as string, x]));
  const client = (id: string | null) => {
    const x = id ? c.get(id) : undefined;
    return x ? { id: x.id as string, name: x.full_name as string, phone: x.phone as string | null, email: x.email as string | null } : null;
  };
  return rows.map((r) => {
    const prop = p.get(r.property_id);
    const agent = r.assigned_to ? a.get(r.assigned_to) : undefined;
    return {
      ...r,
      property: { id: r.property_id, name: (prop?.title as string) ?? "Ingatlan", listingType: (prop?.listing_type as "sale" | "rent") ?? "sale", askingPrice: (prop?.price as number | null) ?? null },
      buyer: client(r.buyer_client_id),
      seller: client(r.seller_client_id),
      agent: agent ? { id: agent.id as string, name: (agent.full_name as string) || "Munkatárs" } : null,
      commissionValue: commission(r),
      next: r.status === "open" ? nextDeadline(r) : null,
    };
  });
}

export type DealView = "open" | "won" | "lost";

export async function listDeals(user: CurrentUser, view: DealView): Promise<Deal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(COLUMNS)
    .eq("organization_id", user.organization.id)
    .eq("status", view)
    .order(view === "open" ? "updated_at" : "closed_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`Failed to list deals: ${error.message}`);
  return hydrate(user, (data ?? []) as Row[]);
}

/** The deals of one listing or one client (as buyer or seller), newest first. */
export async function listDealsFor(user: CurrentUser, of: { propertyId?: string; clientId?: string }): Promise<Deal[]> {
  const supabase = await createClient();
  let q = supabase.from("deals").select(COLUMNS).eq("organization_id", user.organization.id);
  if (of.propertyId) q = q.eq("property_id", of.propertyId);
  if (of.clientId) q = q.or(`buyer_client_id.eq.${of.clientId},seller_client_id.eq.${of.clientId}`);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error(`Failed to list deals: ${error.message}`);
  return hydrate(user, (data ?? []) as Row[]);
}

export type DealOffer = { id: string; amount: number; madeBy: "buyer" | "seller"; madeOn: string; status: "open" | "accepted" | "rejected" | "countered"; note: string | null };
export type DealParty = { id: string; role: PartyRole; name: string; phone: string | null; email: string | null; note: string | null };
export type DealTask = { id: string; title: string; dueAt: string | null; done: boolean; milestone: string | null };

export type DealDetail = Deal & { offers: DealOffer[]; parties: DealParty[]; tasks: DealTask[] };

export async function getDeal(user: CurrentUser, id: string): Promise<DealDetail | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select(COLUMNS).eq("id", id).eq("organization_id", user.organization.id).maybeSingle();
  if (!data) return null;
  const [[deal], offers, parties, tasks] = await Promise.all([
    hydrate(user, [data as Row]),
    supabase.from("deal_offers").select("id, amount, made_by, made_on, status, note").eq("deal_id", id).order("made_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("deal_parties").select("id, role, name, phone, email, note").eq("deal_id", id).order("created_at"),
    supabase.from("tasks").select("id, title, due_at, status, deal_milestone").eq("deal_id", id).neq("status", "cancelled").order("due_at", { ascending: true, nullsFirst: false }),
  ]);
  return {
    ...deal,
    offers: (offers.data ?? []).map((o) => ({ id: o.id, amount: Number(o.amount), madeBy: o.made_by, madeOn: o.made_on, status: o.status, note: o.note })),
    parties: (parties.data ?? []).map((p) => ({ id: p.id, role: p.role, name: p.name, phone: p.phone, email: p.email, note: p.note })),
    tasks: (tasks.data ?? []).map((t) => ({ id: t.id, title: t.title, dueAt: t.due_at, done: t.status === "completed", milestone: t.deal_milestone })),
  };
}

// ---------------------------------------------------------------------------
// Side effects of a change: tasks, the listing's status, the timeline
// ---------------------------------------------------------------------------

/** One task per key date: created, moved with the date, or cancelled when the date is cleared or done. */
async function syncMilestoneTasks(user: CurrentUser, deal: Deal) {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tasks").select("id, deal_milestone, status, due_at").eq("deal_id", deal.id).not("deal_milestone", "is", null);
  const byMilestone = new Map((existing ?? []).map((t) => [t.deal_milestone as string, t]));
  const closed = deal.status !== "open";
  for (const m of milestoneTasks(deal, { property: deal.property.name })) {
    const task = byMilestone.get(m.milestone);
    const due = m.date && !closed ? zonedLocalToUtc(`${m.date}T09:00`) : null;
    if (due) {
      if (!task) {
        const { error } = await supabase.from("tasks").insert({
          organization_id: user.organization.id,
          deal_id: deal.id,
          deal_milestone: m.milestone,
          title: m.title.slice(0, 300),
          due_at: due,
          priority: "high",
          client_id: deal.buyer_client_id,
          property_id: deal.property_id,
          assigned_to: deal.assigned_to,
        });
        if (error) console.error("deal task insert failed", error.code);
      } else if (task.status === "cancelled" || task.due_at !== due) {
        const reopen = task.status === "cancelled" ? { status: "todo", completed_at: null } : {};
        const { error } = await supabase.from("tasks").update({ due_at: due, title: m.title.slice(0, 300), ...reopen }).eq("id", task.id);
        if (error) console.error("deal task update failed", error.code);
      }
    } else if (task && (task.status === "todo" || task.status === "in_progress")) {
      const { error } = await supabase.from("tasks").update({ status: "cancelled" }).eq("id", task.id);
      if (error) console.error("deal task cancel failed", error.code);
    }
  }
}

async function syncPropertyStatus(user: CurrentUser, deal: Deal) {
  const status = propertyStatusFor(deal.stage, deal.status, deal.property.listingType);
  if (!status) return;
  const supabase = await createClient();
  // A lost deal only frees the listing when no other deal is still running on it.
  if (deal.status === "lost") {
    const { count } = await supabase.from("deals").select("id", { count: "exact", head: true }).eq("property_id", deal.property_id).eq("status", "open");
    if (count) return;
  }
  const { error } = await supabase.from("properties").update({ status }).eq("id", deal.property_id).eq("organization_id", user.organization.id);
  if (error) console.error("property status sync failed", error.code);
}

async function logOnTimeline(user: CurrentUser, deal: Deal, summary: string) {
  const supabase = await createClient();
  const rows = [deal.buyer_client_id, deal.seller_client_id].filter(isUuid);
  const targets = rows.length ? rows.map((client_id) => ({ client_id, property_id: deal.property_id })) : [{ client_id: null, property_id: deal.property_id }];
  const { error } = await supabase.from("interactions").insert(
    targets.map((t) => ({
      organization_id: user.organization.id,
      ...t,
      interaction_type: "note",
      summary: summary.slice(0, 1000),
      source: "manual",
    })),
  );
  if (error) console.error("deal timeline note failed", error.code);
}

async function afterChange(user: CurrentUser, id: string, summary: string | null) {
  const deal = await getDeal(user, id);
  if (!deal) return;
  await Promise.all([syncMilestoneTasks(user, deal), syncPropertyStatus(user, deal), summary ? logOnTimeline(user, deal, summary) : null]);
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

export type DealInput = {
  propertyId: string;
  buyerClientId: string | null;
  sellerClientId: string | null;
  agreedPrice: number | null;
  currency: "HUF" | "EUR";
  commissionPercent: number | null;
  commissionAmount: number | null;
  notes: string | null;
};

export type DealResult = { ok: true; id: string } | { ok: false; error: string };

export async function createDeal(user: CurrentUser, input: DealInput, firstOffer: { amount: number; madeBy: "buyer" | "seller" } | null): Promise<DealResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({
      organization_id: user.organization.id,
      property_id: input.propertyId,
      buyer_client_id: input.buyerClientId,
      seller_client_id: input.sellerClientId,
      agreed_price: input.agreedPrice,
      currency: input.currency,
      commission_percent: input.commissionPercent,
      commission_amount: input.commissionAmount,
      notes: input.notes,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("deal insert failed", error?.code);
    return { ok: false, error: "Az ügyletet nem sikerült létrehozni. Ellenőrizd az ingatlant és az ügyfeleket." };
  }
  if (firstOffer) await addOffer(user, data.id, { ...firstOffer, madeOn: null, note: null });
  // The buyer is now negotiating.
  if (input.buyerClientId) await supabase.from("clients").update({ status: "negotiation" }).eq("id", input.buyerClientId).in("status", ["new_lead", "contacted", "qualified", "active"]);
  await afterChange(user, data.id, `Új ügylet indult${firstOffer ? `: ajánlat ${Math.round(firstOffer.amount).toLocaleString("hu-HU")} Ft` : ""}.`);
  return { ok: true, id: data.id };
}

export type DealPatch = Partial<{
  buyer_client_id: string | null;
  seller_client_id: string | null;
  agreed_price: number | null;
  currency: "HUF" | "EUR";
  deposit_amount: number | null;
  deposit_due: string | null;
  deposit_paid_on: string | null;
  contract_on: string | null;
  financing_deadline: string | null;
  handover_on: string | null;
  commission_percent: number | null;
  commission_amount: number | null;
  commission_paid_on: string | null;
  notes: string | null;
  assigned_to: string | null;
}>;

export async function updateDeal(user: CurrentUser, id: string, patch: DealPatch): Promise<DealResult> {
  if (!isUuid(id)) return { ok: false, error: "Ismeretlen ügylet." };
  const supabase = await createClient();
  const { error } = await supabase.from("deals").update(patch).eq("id", id).eq("organization_id", user.organization.id);
  if (error) {
    console.error("deal update failed", error.code);
    return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };
  }
  await afterChange(user, id, null);
  return { ok: true, id };
}

/** Moves the deal to a stage; "closed" also records it as won. */
export async function moveDeal(user: CurrentUser, id: string, stage: DealStage): Promise<DealResult> {
  if (!isUuid(id) || !DEAL_STAGES.includes(stage)) return { ok: false, error: "Ismeretlen ügylet." };
  const supabase = await createClient();
  const now = new Date();
  const closing = stage === "closed";
  const { data: before } = await supabase.from("deals").select("stage, status, buyer_client_id, commission_paid_on").eq("id", id).eq("organization_id", user.organization.id).maybeSingle();
  if (!before) return { ok: false, error: "Ismeretlen ügylet." };
  const { error } = await supabase
    .from("deals")
    .update({
      stage,
      status: closing ? "won" : "open",
      closed_at: closing ? now.toISOString() : null,
      lost_reason: null,
      ...(closing && !before.commission_paid_on ? { commission_paid_on: now.toISOString().slice(0, 10) } : {}),
    })
    .eq("id", id)
    .eq("organization_id", user.organization.id);
  if (error) {
    console.error("deal move failed", error.code);
    return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };
  }
  if (closing && before.buyer_client_id) await supabase.from("clients").update({ status: "converted" }).eq("id", before.buyer_client_id);
  await afterChange(user, id, closing ? "Ügylet lezárva: sikeres adásvétel, jutalék rendezve." : `Ügylet: ${stageLabels[stage]} szakasz.`);
  return { ok: true, id };
}

export async function loseDeal(user: CurrentUser, id: string, reason: string | null): Promise<DealResult> {
  if (!isUuid(id)) return { ok: false, error: "Ismeretlen ügylet." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ status: "lost", closed_at: new Date().toISOString(), lost_reason: reason?.slice(0, 500) || null })
    .eq("id", id)
    .eq("organization_id", user.organization.id);
  if (error) return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };
  await afterChange(user, id, `Ügylet meghiúsult${reason ? `: ${reason}` : "."}`);
  return { ok: true, id };
}

/** A won or lost deal back to running, at the stage it was at. */
export async function reopenDeal(user: CurrentUser, id: string): Promise<DealResult> {
  if (!isUuid(id)) return { ok: false, error: "Ismeretlen ügylet." };
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("stage").eq("id", id).eq("organization_id", user.organization.id).maybeSingle();
  if (!data) return { ok: false, error: "Ismeretlen ügylet." };
  const stage = data.stage === "closed" ? "handover" : data.stage;
  const { error } = await supabase.from("deals").update({ status: "open", closed_at: null, lost_reason: null, stage }).eq("id", id);
  if (error) return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };
  await afterChange(user, id, "Ügylet újranyitva.");
  return { ok: true, id };
}

export async function addOffer(user: CurrentUser, dealId: string, o: { amount: number; madeBy: "buyer" | "seller"; madeOn: string | null; note: string | null }): Promise<DealResult> {
  if (!isUuid(dealId)) return { ok: false, error: "Ismeretlen ügylet." };
  const supabase = await createClient();
  // The previous open offer has been answered by this one.
  await supabase.from("deal_offers").update({ status: "countered" }).eq("deal_id", dealId).eq("status", "open");
  const { error } = await supabase.from("deal_offers").insert({
    organization_id: user.organization.id,
    deal_id: dealId,
    amount: o.amount,
    made_by: o.madeBy,
    ...(o.madeOn ? { made_on: o.madeOn } : {}),
    note: o.note,
  });
  if (error) return { ok: false, error: "Az ajánlatot nem sikerült menteni." };
  return { ok: true, id: dealId };
}

/** Accepting an offer makes its amount the agreed price. */
export async function answerOffer(user: CurrentUser, offerId: string, answer: "accepted" | "rejected"): Promise<DealResult> {
  if (!isUuid(offerId)) return { ok: false, error: "Ismeretlen ajánlat." };
  const supabase = await createClient();
  const { data: offer } = await supabase.from("deal_offers").select("deal_id, amount, made_by").eq("id", offerId).eq("organization_id", user.organization.id).maybeSingle();
  if (!offer) return { ok: false, error: "Ismeretlen ajánlat." };
  const { error } = await supabase.from("deal_offers").update({ status: answer }).eq("id", offerId);
  if (error) return { ok: false, error: "A mentés nem sikerült." };
  if (answer === "accepted") {
    await supabase.from("deals").update({ agreed_price: offer.amount }).eq("id", offer.deal_id);
    await afterChange(user, offer.deal_id, `Elfogadott ajánlat: ${Math.round(Number(offer.amount)).toLocaleString("hu-HU")} Ft.`);
  }
  return { ok: true, id: offer.deal_id };
}

export async function deleteOffer(user: CurrentUser, offerId: string) {
  if (!isUuid(offerId)) return;
  const supabase = await createClient();
  await supabase.from("deal_offers").delete().eq("id", offerId).eq("organization_id", user.organization.id);
}

export async function addParty(user: CurrentUser, dealId: string, p: { role: PartyRole; name: string; phone: string | null; email: string | null; note: string | null }): Promise<DealResult> {
  if (!isUuid(dealId)) return { ok: false, error: "Ismeretlen ügylet." };
  const supabase = await createClient();
  const { error } = await supabase.from("deal_parties").insert({ organization_id: user.organization.id, deal_id: dealId, ...p });
  if (error) return { ok: false, error: "A szereplőt nem sikerült menteni." };
  return { ok: true, id: dealId };
}

export async function deleteParty(user: CurrentUser, partyId: string) {
  if (!isUuid(partyId)) return;
  const supabase = await createClient();
  await supabase.from("deal_parties").delete().eq("id", partyId).eq("organization_id", user.organization.id);
}

// ---------------------------------------------------------------------------
// Summary for the board and the dashboard
// ---------------------------------------------------------------------------

export type DealSummary = {
  openCount: number;
  /** Commission of open deals (what is in the pipeline). */
  pipelineCommission: number;
  /** Commission expected this month (open deals due this month and deals won this month). */
  thisMonthCommission: number;
  wonThisMonth: number;
  /** Open deals' dates in the next two weeks. */
  upcoming: { dealId: string; property: string; label: string; date: string }[];
};

export async function dealSummary(user: CurrentUser, now: Date): Promise<DealSummary> {
  const supabase = await createClient();
  const month = now.toISOString().slice(0, 7);
  const { data } = await supabase
    .from("deals")
    .select(COLUMNS)
    .eq("organization_id", user.organization.id)
    .or(`status.eq.open,closed_at.gte.${month}-01`)
    .limit(500);
  const deals = await hydrate(user, (data ?? []) as Row[]);
  const open = deals.filter((d) => d.status === "open");
  const soon = new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  return {
    openCount: open.length,
    pipelineCommission: open.reduce((s, d) => s + (d.commissionValue ?? 0), 0),
    thisMonthCommission: deals.filter((d) => d.status !== "lost" && commissionMonth(d) === month).reduce((s, d) => s + (d.commissionValue ?? 0), 0),
    wonThisMonth: deals.filter((d) => d.status === "won" && d.closed_at?.startsWith(month)).length,
    upcoming: open
      .flatMap((d) => (d.next && d.next.date >= today && d.next.date <= soon ? [{ dealId: d.id, property: d.property.name, label: d.next.label, date: d.next.date }] : []))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6),
  };
}
