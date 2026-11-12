// Whether a workspace may use Flavio, and how to say where it stands. Pure,
// so the paywall, the menu card and the admin page agree.

export type BillingStatus = "none" | "pilot" | "trialing" | "active" | "past_due" | "canceled";

export type WorkspaceBilling = {
  status: BillingStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  planId: string | null;
  interval: "month" | "year" | null;
  seats: number | null;
  stripeCustomerId: string | null;
};

/** A missed payment keeps working this long while the card is fixed. */
export const PAST_DUE_GRACE_DAYS = 7;

export function hasAccess(b: WorkspaceBilling, now = Date.now()) {
  switch (b.status) {
    case "pilot":
    case "active":
      return true;
    case "trialing":
      return !!b.trialEndsAt && Date.parse(b.trialEndsAt) > now;
    case "past_due":
      return Date.parse(b.currentPeriodEnd ?? new Date(now).toISOString()) + PAST_DUE_GRACE_DAYS * 86_400_000 > now;
    case "canceled":
      return !!b.currentPeriodEnd && Date.parse(b.currentPeriodEnd) > now;
    default:
      return false;
  }
}

/** Whole days left until `iso`, at least 0. */
export function daysLeft(iso: string | null, now = Date.now()) {
  return iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 86_400_000)) : 0;
}

export const statusLabels: Record<BillingStatus, string> = {
  none: "Nincs előfizetés",
  pilot: "Pilot (ingyenes)",
  trialing: "Ingyenes próbaidő",
  active: "Aktív előfizetés",
  past_due: "Elmaradt fizetés",
  canceled: "Lemondva",
};
