import "server-only";
import Stripe from "stripe";

/** The Stripe client, or null until STRIPE_SECRET_KEY is set on the server. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

/** Stripe counts forints in fillér (two decimals): 9 900 Ft is 990000. */
export const toStripeHuf = (forints: number) => Math.round(forints * 100);
export const fromStripeHuf = (amount: number) => amount / 100;
