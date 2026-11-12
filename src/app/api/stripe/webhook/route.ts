import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { recordPayment, syncSubscription } from "@/lib/billing/data";
import { stripeClient } from "@/lib/billing/stripe";

/**
 * Stripe's events about subscriptions and payments (see docs/BILLING.md).
 * The signature proves they come from Stripe; anything else is refused.
 */
export async function POST(request: NextRequest) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "billing is not configured" }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (id) await syncSubscription(await stripe.subscriptions.retrieve(id));
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "invoice.paid":
        if (event.data.object.amount_paid > 0) await recordPayment(event.data.object);
        break;
    }
  } catch (error) {
    console.error("stripe webhook failed", event.type, error instanceof Error ? error.message : error);
    // Stripe retries on an error status.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
