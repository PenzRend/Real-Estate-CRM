# Packages and payments

Flavio sells one plan, priced per agent (every member of a workspace is one
seat), monthly or yearly. The price and the AI caps per agent are edited on
**/admin → Előfizetések**; Flavio makes the matching Stripe prices itself on
the next checkout. Prices are final amounts: the seller is VAT-exempt
(alanyi adómentes).

Who can use the app:

| Workspace | Access |
|---|---|
| **Pilot** | Free until the admin changes it (everyone who was here before billing). |
| **Próbaidő** | Free until a date: 30 days from a sign-up code, or set by the admin. |
| **Előfizető** | Paid through Stripe. A missed payment keeps working for 7 days. |
| **Lemondva** | Works until the end of the paid period. |
| **Nincs hozzáférés** | Signed up without a code, or the free period ended: the app sends them to **/billing**. |

The data is never deleted for lack of payment; the paywall only stops using
the app (and its AI) until they subscribe.

## 1. Stripe account

1. Sign up at https://dashboard.stripe.com and activate the account for
   Hungary, with the e.v. details and the bank account for payouts.
2. **Settings → Business → Customer emails**: turn on emails for successful
   payments and failed payments.
3. **Settings → Billing → Customer portal**: turn it on; allow updating the
   payment method, cancelling (at the end of the period) and viewing invoices.
   Leave plan switching off.
4. Try everything in **test mode** first (the toggle in the dashboard), with
   test keys and card `4242 4242 4242 4242`.

## 2. Keys in Vercel

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | **Developers → API keys → Secret key** (`sk_test_…` while testing, `sk_live_…` for real) |
| `STRIPE_WEBHOOK_SECRET` | from step 3 (`whsec_…`) |

Never paste them into chat or commit them.

## 3. Webhook

**Developers → Webhooks → Add endpoint**:

- URL: `<APP_URL>/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.paid`

Copy its **Signing secret** into `STRIPE_WEBHOOK_SECRET`, then redeploy.
Test mode and live mode have separate endpoints and secrets.

## 4. Invoices

Every payment needs a Hungarian invoice. Until Billingo is automated:
**/admin → Előfizetések → Fizetések** lists each payment with the buyer's
name, address and tax number (Stripe Checkout asks for them). Issue the
invoice in Billingo (AAM), type its number next to the payment, and press
**Számlázva**.

## Day to day

- **Change the price or AI caps**: /admin → Előfizetések → Csomag. New
  subscriptions get the new price; running ones keep theirs.
- **Give someone free time**: /admin → Előfizetések → Munkaterületek
  hozzáférése → Pilot, or Próbaidő with a date.
- **Seats** follow the team: when someone joins or leaves a paying office,
  the subscription is updated and Stripe prorates the difference.
