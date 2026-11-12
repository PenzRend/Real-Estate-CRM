import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasAccess } from "@/lib/billing/access";
import { workspaceBilling } from "@/lib/billing/data";

/**
 * The paywall: a workspace without a pilot, a running trial or a paid
 * subscription goes to /billing. Data stays where it is; AI calls are refused
 * on the server too (lib/ai/usage.ts).
 */
export async function BillingGate() {
  const user = await getCurrentUser();
  if (!hasAccess(await workspaceBilling(user))) redirect("/billing");
  return null;
}
