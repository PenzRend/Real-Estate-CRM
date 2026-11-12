"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isPlatformAdmin, newSignupCode } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { appOrigin } from "@/lib/origin";
import { createAdminClient } from "@/lib/supabase/admin";

export type CodeResult = { ok: true; code: string; link: string; note: string | null; email: string | null } | { ok: false; error: string };
type Result = { ok: true } | { ok: false; error: string };

/** The admin's service client, or null for anyone else (and when the key is missing). */
async function adminClient() {
  const user = await getCurrentUser();
  return isPlatformAdmin(user) ? createAdminClient() : null;
}

const codeSchema = z.object({
  note: z.string().trim().max(200),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Adj meg egy érvényes e-mail-címet, vagy hagyd üresen.").max(320)]),
});

/** Makes a sign-up code, optionally locked to one address, and returns the link to send. */
export async function createSignupCodeAction(input: { note: string; email: string }): Promise<CodeResult> {
  const admin = await adminClient();
  if (!admin) return { ok: false, error: "Ehhez nincs jogosultságod." };
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const note = parsed.data.note || null;
  const email = parsed.data.email || null;

  // A clash with an existing code is unlikely; try again a few times if it happens.
  for (let i = 0; i < 3; i++) {
    const code = newSignupCode();
    const { error } = await admin.from("signup_codes").insert({ code, note, email });
    if (!error) {
      refresh();
      return { ok: true, code, note, email, link: `${await appOrigin()}/signup?code=${code}` };
    }
    if (error.code !== "23505") break;
  }
  return { ok: false, error: "A kód létrehozása nem sikerült. Próbáld újra." };
}

export async function revokeSignupCodeAction(id: string): Promise<Result> {
  const admin = await adminClient();
  if (!admin) return { ok: false, error: "Ehhez nincs jogosultságod." };
  const { error } = await admin.from("signup_codes").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("used_at", null);
  if (error) return { ok: false, error: "A visszavonás nem sikerült." };
  refresh();
  return { ok: true };
}

/** The workspace's own daily or monthly AI cap; null goes back to the server default. */
export async function setAiLimitAction(organizationId: string, period: "daily" | "monthly", limit: number | null): Promise<Result> {
  const admin = await adminClient();
  if (!admin) return { ok: false, error: "Ehhez nincs jogosultságod." };
  if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 1_000_000)) return { ok: false, error: "Adj meg egy nem negatív egész számot." };
  const column = period === "daily" ? "ai_daily_limit" : "ai_monthly_limit";
  const { error } = await admin.from("organizations").update({ [column]: limit }).eq("id", organizationId);
  if (error) return { ok: false, error: "A mentés nem sikerült." };
  refresh();
  return { ok: true };
}

const planSchema = z.object({
  name: z.string().trim().min(1, "Adj nevet a csomagnak.").max(60),
  priceMonth: z.number().int().min(0).max(10_000_000),
  priceYear: z.number().int().min(0).max(100_000_000),
  aiDailyPerSeat: z.number().int().min(0).max(100_000),
  aiMonthlyPerSeat: z.number().int().min(0).max(10_000_000).nullable(),
});

/**
 * The plan's price and AI caps. New prices take effect for new subscriptions
 * (Stripe prices are made on the next checkout); running ones keep theirs.
 */
export async function updatePlanAction(planId: string, input: z.input<typeof planSchema>): Promise<Result> {
  const admin = await adminClient();
  if (!admin) return { ok: false, error: "Ehhez nincs jogosultságod." };
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const p = parsed.data;
  const { error } = await admin
    .from("plans")
    .update({ name: p.name, price_month_huf: p.priceMonth, price_year_huf: p.priceYear, ai_daily_per_seat: p.aiDailyPerSeat, ai_monthly_per_seat: p.aiMonthlyPerSeat, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) return { ok: false, error: "A mentés nem sikerült." };
  refresh();
  return { ok: true };
}

/**
 * A workspace's free access, set by hand: pilot (free until changed), a trial
 * until a date, or none (pays). Paid subscriptions are left to Stripe.
 */
export async function setWorkspaceAccessAction(organizationId: string, access: "pilot" | "none" | "trialing", trialEndsAt?: string): Promise<Result> {
  const admin = await adminClient();
  if (!admin) return { ok: false, error: "Ehhez nincs jogosultságod." };
  if (!z.uuid().safeParse(organizationId).success) return { ok: false, error: "Ismeretlen munkaterület." };
  const { data: org } = await admin.from("organizations").select("stripe_subscription_id, billing_status").eq("id", organizationId).maybeSingle();
  const o = org as { stripe_subscription_id: string | null; billing_status: string } | null;
  if (o?.stripe_subscription_id && ["active", "past_due"].includes(o.billing_status)) {
    return { ok: false, error: "Ennek a munkaterületnek fizetős előfizetése van; azt a Stripe-ban lehet módosítani." };
  }
  let until: string | null = null;
  if (access === "trialing") {
    const d = trialEndsAt ? new Date(`${trialEndsAt}T23:59:59`) : null;
    if (!d || Number.isNaN(d.getTime()) || d.getTime() < Date.now()) return { ok: false, error: "Adj meg egy jövőbeli dátumot." };
    until = d.toISOString();
  }
  const { error } = await admin.from("organizations").update({ billing_status: access, trial_ends_at: until }).eq("id", organizationId);
  if (error) return { ok: false, error: "A mentés nem sikerült." };
  refresh();
  return { ok: true };
}

/** Marks a payment as invoiced, with the invoice's number (empty clears it). */
export async function markInvoicedAction(paymentId: string, invoiceNumber: string): Promise<Result> {
  const admin = await adminClient();
  if (!admin) return { ok: false, error: "Ehhez nincs jogosultságod." };
  if (!z.uuid().safeParse(paymentId).success) return { ok: false, error: "Ismeretlen fizetés." };
  const number = invoiceNumber.trim().slice(0, 60);
  const { error } = await admin
    .from("payments")
    .update({ invoice_number: number || null, invoiced_at: number ? new Date().toISOString() : null })
    .eq("id", paymentId);
  if (error) return { ok: false, error: "A mentés nem sikerült." };
  refresh();
  return { ok: true };
}
