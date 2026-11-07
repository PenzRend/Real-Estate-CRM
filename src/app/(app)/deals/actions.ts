"use server";

import { onEvent } from "@/lib/automation/events";
import { after } from "next/server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { addOffer, addParty, answerOffer, createDeal, deleteOffer, deleteParty, isUuid, loseDeal, moveDeal, reopenDeal, updateDeal, type DealPatch } from "@/lib/deals/data";
import { DEAL_STAGES, partyRoleLabels, type DealStage, type PartyRole } from "@/lib/deals/logic";
import { parseHungarianNumber } from "@/lib/validation/common";

export type FormState = { error?: string; ok?: boolean };

/** "79M", "79 000 000", "" → number or null; NaN for nonsense. */
function money(v: FormDataEntryValue | null): number | null {
  const n = parseHungarianNumber(typeof v === "string" ? v : "");
  return n == null ? null : Number.isNaN(n) || n < 0 || n > 1e12 ? NaN : n;
}
const text = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const id = (v: FormDataEntryValue | null) => (isUuid(v) ? v : null);

export async function createDealAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const propertyId = id(form.get("propertyId"));
  if (!propertyId) return { error: "Válaszd ki az ingatlant." };
  const offer = money(form.get("offer"));
  const price = money(form.get("agreedPrice"));
  const percent = parseHungarianNumber(String(form.get("commissionPercent") ?? ""));
  const fixed = money(form.get("commissionAmount"));
  if ([offer, price, fixed].some((n) => Number.isNaN(n)) || (percent != null && (Number.isNaN(percent) || percent < 0 || percent > 100))) {
    return { error: "Egy összeg nem értelmezhető. Írd így: 79 000 000 vagy 79M; a jutalék 0–100 %." };
  }
  const r = await createDeal(
    user,
    {
      propertyId,
      buyerClientId: id(form.get("buyerClientId")),
      sellerClientId: id(form.get("sellerClientId")),
      agreedPrice: price,
      currency: form.get("currency") === "EUR" ? "EUR" : "HUF",
      commissionPercent: percent,
      commissionAmount: fixed,
      notes: text(form.get("notes"), 10_000),
    },
    offer != null ? { amount: offer, madeBy: form.get("offerBy") === "seller" ? "seller" : "buyer" } : null,
  );
  if (!r.ok) return { error: r.error };
  after(() => onEvent(user, { type: "deal_created", dealId: r.id }));
  redirect(`/deals/${r.id}`);
}

const DATE_FIELDS = ["deposit_due", "deposit_paid_on", "contract_on", "financing_deadline", "handover_on", "commission_paid_on"] as const;
const MONEY_FIELDS = ["agreed_price", "deposit_amount", "commission_amount"] as const;

/** One field of a deal, saved as the agent edits it (dates, sums, percentage, people, notes). */
export async function updateDealFieldAction(dealId: string, field: string, value: string): Promise<FormState> {
  const user = await getCurrentUser();
  let patch: DealPatch;
  if ((DATE_FIELDS as readonly string[]).includes(field)) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: "Érvénytelen dátum." };
    patch = { [field]: value || null };
  } else if ((MONEY_FIELDS as readonly string[]).includes(field)) {
    const n = money(value);
    if (Number.isNaN(n)) return { error: "Az összeg nem értelmezhető (pl. 79 000 000 vagy 79M)." };
    patch = { [field]: n };
  } else if (field === "commission_percent") {
    const n = parseHungarianNumber(value);
    if (n != null && (Number.isNaN(n) || n < 0 || n > 100)) return { error: "A jutalék 0 és 100 % között lehet." };
    patch = { commission_percent: n };
  } else if (field === "buyer_client_id" || field === "seller_client_id" || field === "assigned_to") {
    patch = { [field]: value ? (isUuid(value) ? value : undefined) : null };
    if (Object.values(patch)[0] === undefined) return { error: "Ismeretlen választás." };
  } else if (field === "notes") {
    patch = { notes: value.trim().slice(0, 10_000) || null };
  } else if (field === "currency") {
    patch = { currency: value === "EUR" ? "EUR" : "HUF" };
  } else {
    return { error: "Ismeretlen mező." };
  }
  const r = await updateDeal(user, dealId, patch);
  if (!r.ok) return { error: r.error };
  refresh();
  return { ok: true };
}

export async function moveDealAction(dealId: string, stage: string): Promise<FormState> {
  if (!(DEAL_STAGES as readonly string[]).includes(stage)) return { error: "Ismeretlen szakasz." };
  const user = await getCurrentUser();
  const r = await moveDeal(user, dealId, stage as DealStage);
  if (!r.ok) return { error: r.error };
  if (stage === "handover") after(() => onEvent(user, { type: "deal_handover", dealId }));
  if (stage === "closed") after(() => onEvent(user, { type: "deal_won", dealId }));
  refresh();
  return { ok: true };
}

export async function loseDealAction(dealId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const r = await loseDeal(user, dealId, text(form.get("reason"), 500));
  if (!r.ok) return { error: r.error };
  refresh();
  return { ok: true };
}

export async function reopenDealAction(dealId: string) {
  const user = await getCurrentUser();
  await reopenDeal(user, dealId);
  refresh();
}

export async function addOfferAction(dealId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const amount = money(form.get("amount"));
  if (amount == null || Number.isNaN(amount)) return { error: "Add meg az ajánlott összeget (pl. 79 000 000 vagy 79M)." };
  const madeOn = text(form.get("madeOn"), 10);
  const r = await addOffer(user, dealId, {
    amount,
    madeBy: form.get("madeBy") === "seller" ? "seller" : "buyer",
    madeOn: madeOn && /^\d{4}-\d{2}-\d{2}$/.test(madeOn) ? madeOn : null,
    note: text(form.get("note"), 1000),
  });
  if (!r.ok) return { error: r.error };
  refresh();
  return { ok: true };
}

export async function answerOfferAction(offerId: string, answer: "accepted" | "rejected") {
  const user = await getCurrentUser();
  await answerOffer(user, offerId, answer === "accepted" ? "accepted" : "rejected");
  refresh();
}

export async function deleteOfferAction(offerId: string) {
  const user = await getCurrentUser();
  await deleteOffer(user, offerId);
  refresh();
}

const partySchema = z.object({
  role: z.enum(Object.keys(partyRoleLabels) as [PartyRole, ...PartyRole[]]),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(50).optional(),
  email: z.union([z.email().max(320), z.literal("")]).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function addPartyAction(dealId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const parsed = partySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Add meg a nevet; az e-mail-cím legyen érvényes." };
  const p = parsed.data;
  const r = await addParty(user, dealId, { role: p.role, name: p.name, phone: p.phone || null, email: p.email || null, note: p.note || null });
  if (!r.ok) return { error: r.error };
  refresh();
  return { ok: true };
}

export async function deletePartyAction(partyId: string) {
  const user = await getCurrentUser();
  await deleteParty(user, partyId);
  refresh();
}
