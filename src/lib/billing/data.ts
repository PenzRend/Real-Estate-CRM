import "server-only";
import type Stripe from "stripe";
import type { CurrentUser } from "@/lib/auth";
import { appOrigin } from "@/lib/origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BillingStatus, WorkspaceBilling } from "./access";
import { fromStripeHuf, stripeClient, toStripeHuf } from "./stripe";

export type Plan = {
  id: string;
  name: string;
  priceMonth: number;
  priceYear: number;
  aiDailyPerSeat: number;
  aiMonthlyPerSeat: number | null;
  stripeProductId: string | null;
  stripePriceMonthId: string | null;
  stripePriceYearId: string | null;
};

type PlanRow = {
  id: string; name: string; price_month_huf: number; price_year_huf: number; ai_daily_per_seat: number; ai_monthly_per_seat: number | null;
  stripe_product_id: string | null; stripe_price_month_id: string | null; stripe_price_year_id: string | null;
};
const PLAN_COLUMNS = "id, name, price_month_huf, price_year_huf, ai_daily_per_seat, ai_monthly_per_seat, stripe_product_id, stripe_price_month_id, stripe_price_year_id";
const toPlan = (r: PlanRow): Plan => ({
  id: r.id,
  name: r.name,
  priceMonth: r.price_month_huf,
  priceYear: r.price_year_huf,
  aiDailyPerSeat: r.ai_daily_per_seat,
  aiMonthlyPerSeat: r.ai_monthly_per_seat,
  stripeProductId: r.stripe_product_id,
  stripePriceMonthId: r.stripe_price_month_id,
  stripePriceYearId: r.stripe_price_year_id,
});

/** The plan on sale; one to start with. */
export const DEFAULT_PLAN = "flavio";

export async function getPlan(id = DEFAULT_PLAN): Promise<Plan | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select(PLAN_COLUMNS).eq("id", id).maybeSingle();
  return data ? toPlan(data as PlanRow) : null;
}

const BILLING_COLUMNS = "billing_status, trial_ends_at, current_period_end, cancel_at_period_end, plan_id, billing_interval, seats, stripe_customer_id";
type BillingRow = {
  billing_status: BillingStatus; trial_ends_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean;
  plan_id: string | null; billing_interval: "month" | "year" | null; seats: number | null; stripe_customer_id: string | null;
};
export const toBilling = (r: BillingRow): WorkspaceBilling => ({
  status: r.billing_status,
  trialEndsAt: r.trial_ends_at,
  currentPeriodEnd: r.current_period_end,
  cancelAtPeriodEnd: r.cancel_at_period_end,
  planId: r.plan_id,
  interval: r.billing_interval,
  seats: r.seats,
  stripeCustomerId: r.stripe_customer_id,
});

/** The user's current workspace's billing state. Before the billing columns exist, everyone counts as a pilot. */
export async function workspaceBilling(user: CurrentUser): Promise<WorkspaceBilling> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").select(BILLING_COLUMNS).eq("id", user.organization.id).maybeSingle();
  if (error || !data) {
    if (error) console.error("workspaceBilling failed", error.code ?? error.message);
    return { status: "pilot", trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, planId: null, interval: null, seats: null, stripeCustomerId: null };
  }
  return toBilling(data as BillingRow);
}

export async function memberCount(organizationId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", organizationId);
  return Math.max(1, count ?? 1);
}

/**
 * The plan's Stripe prices, made the first time they are needed and again
 * whenever the admin changes a price (Stripe prices cannot be edited; running
 * subscriptions keep the price they started with).
 */
export async function ensureStripePrices(stripe: Stripe, plan: Plan): Promise<{ month: string; year: string }> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is not set");
  let product = plan.stripeProductId;
  if (!product) {
    product = (await stripe.products.create({ name: plan.name, metadata: { plan_id: plan.id } })).id;
  }
  const make = (amount: number, interval: "month" | "year") =>
    stripe.prices
      .create({ product: product!, currency: "huf", unit_amount: toStripeHuf(amount), recurring: { interval }, metadata: { plan_id: plan.id } })
      .then((p) => p.id);
  // A stored price is reused only while its amount still matches the plan.
  const current = async (id: string | null, amount: number) => {
    if (!id) return null;
    const p = await stripe.prices.retrieve(id).catch(() => null);
    return p && p.active && p.unit_amount === toStripeHuf(amount) ? id : null;
  };
  const month = (await current(plan.stripePriceMonthId, plan.priceMonth)) ?? (await make(plan.priceMonth, "month"));
  const year = (await current(plan.stripePriceYearId, plan.priceYear)) ?? (await make(plan.priceYear, "year"));
  if (product !== plan.stripeProductId || month !== plan.stripePriceMonthId || year !== plan.stripePriceYearId) {
    await admin.from("plans").update({ stripe_product_id: product, stripe_price_month_id: month, stripe_price_year_id: year }).eq("id", plan.id);
  }
  return { month, year };
}

/** A Stripe Checkout page for the workspace: the plan, one seat per member. */
export async function checkoutUrl(user: CurrentUser, interval: "month" | "year"): Promise<string> {
  const stripe = stripeClient();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not set");
  const plan = await getPlan();
  if (!plan) throw new Error("No plan");
  const [prices, seats, billing, origin] = await Promise.all([ensureStripePrices(stripe, plan), memberCount(user.organization.id), workspaceBilling(user), appOrigin()]);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: interval === "year" ? prices.year : prices.month, quantity: seats }],
    client_reference_id: user.organization.id,
    subscription_data: { metadata: { organization_id: user.organization.id, plan_id: plan.id } },
    metadata: { organization_id: user.organization.id },
    ...(billing.stripeCustomerId
      ? { customer: billing.stripeCustomerId, customer_update: { address: "auto", name: "auto" } }
      : { customer_email: user.email }),
    // Name, address and tax number are needed for the Hungarian invoice.
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    locale: "hu",
    success_url: `${origin}/billing?fizetve=1`,
    cancel_url: `${origin}/billing`,
  });
  if (!session.url) throw new Error("Checkout session without a URL");
  return session.url;
}

/** Stripe's own page for the card, the invoices and cancelling. */
export async function portalUrl(user: CurrentUser): Promise<string> {
  const stripe = stripeClient();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not set");
  const billing = await workspaceBilling(user);
  if (!billing.stripeCustomerId) throw new Error("No Stripe customer");
  const session = await stripe.billingPortal.sessions.create({ customer: billing.stripeCustomerId, return_url: `${await appOrigin()}/billing`, locale: "hu" });
  return session.url;
}

const statusFromStripe = (s: Stripe.Subscription.Status): BillingStatus =>
  s === "active" || s === "trialing" ? "active" : s === "past_due" || s === "unpaid" || s === "incomplete" ? "past_due" : "canceled";

const isoOf = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/** Copies a subscription's state onto its workspace (from the webhook). */
export async function syncSubscription(subscription: Stripe.Subscription) {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is not set");
  const item = subscription.items.data[0];
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const organizationId = subscription.metadata.organization_id;
  const values = {
    billing_status: statusFromStripe(subscription.status),
    plan_id: subscription.metadata.plan_id || DEFAULT_PLAN,
    billing_interval: item?.price.recurring?.interval === "year" ? "year" : "month",
    seats: item?.quantity ?? 1,
    current_period_end: isoOf(item?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    stripe_customer_id: customer,
    stripe_subscription_id: subscription.id,
  };
  const query = admin.from("organizations").update(values);
  const { error } = organizationId ? await query.eq("id", organizationId) : await query.eq("stripe_subscription_id", subscription.id);
  if (error) throw new Error(`syncSubscription: ${error.message}`);
}

/** Records a paid invoice, for the admin to issue the Hungarian invoice. */
export async function recordPayment(invoice: Stripe.Invoice) {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is not set");
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
  const organizationId =
    invoice.parent?.subscription_details?.metadata?.organization_id ??
    (subscriptionId ? ((await admin.from("organizations").select("id").eq("stripe_subscription_id", subscriptionId).maybeSingle()).data?.id as string | undefined) : undefined) ??
    null;
  const a = invoice.customer_address;
  const line = invoice.lines.data[0];
  const { error } = await admin.from("payments").upsert(
    {
      organization_id: organizationId,
      stripe_invoice_id: invoice.id,
      stripe_invoice_number: invoice.number,
      amount_huf: fromStripeHuf(invoice.amount_paid),
      paid_at: isoOf(invoice.status_transitions?.paid_at) ?? new Date().toISOString(),
      period_start: isoOf(line?.period?.start),
      period_end: isoOf(line?.period?.end),
      description: line?.description ?? null,
      customer_email: invoice.customer_email,
      customer_name: invoice.customer_name,
      customer_address: a ? [a.postal_code, a.city, a.line1, a.line2, a.country].filter(Boolean).join(", ") : null,
      customer_tax_id: invoice.customer_tax_ids?.map((t) => t.value).join(", ") || null,
      receipt_url: invoice.hosted_invoice_url ?? null,
    },
    { onConflict: "stripe_invoice_id", ignoreDuplicates: false },
  );
  if (error) throw new Error(`recordPayment: ${error.message}`);
}

/**
 * Keeps the paid seats equal to the team's size after someone joins or
 * leaves. Stripe prorates the difference on the next invoice.
 */
export async function syncSeats(organizationId: string) {
  const stripe = stripeClient();
  const admin = createAdminClient();
  if (!stripe || !admin) return;
  const { data: org } = await admin.from("organizations").select("stripe_subscription_id, billing_status").eq("id", organizationId).maybeSingle();
  const subscriptionId = (org as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id;
  if (!subscriptionId) return;
  const { count } = await admin.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", organizationId);
  const seats = Math.max(1, count ?? 1);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  if (!item || item.quantity === seats || subscription.status === "canceled") return;
  await stripe.subscriptions.update(subscriptionId, { items: [{ id: item.id, quantity: seats }] });
}
