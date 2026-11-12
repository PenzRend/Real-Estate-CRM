"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { checkoutUrl, portalUrl } from "@/lib/billing/data";

export type BillingActionState = { error?: string };

const canPay = (role: string) => role === "owner" || role === "admin";

/** Sends the owner to Stripe's payment page for the chosen period. */
export async function checkoutAction(_: BillingActionState, formData: FormData): Promise<BillingActionState> {
  const user = await getCurrentUser();
  if (!canPay(user.organization.role)) return { error: "Az előfizetést a munkaterület tulajdonosa vagy egy admin intézheti." };
  const interval = formData.get("interval") === "year" ? "year" : "month";
  let url: string;
  try {
    url = await checkoutUrl(user, interval);
  } catch (error) {
    console.error("checkout failed", error instanceof Error ? error.message : error);
    return { error: "A fizetési oldal most nem érhető el. Próbáld újra pár perc múlva." };
  }
  redirect(url);
}

/** Stripe's page for the card, the invoices and cancelling. */
export async function portalAction(): Promise<BillingActionState> {
  const user = await getCurrentUser();
  if (!canPay(user.organization.role)) return { error: "Az előfizetést a munkaterület tulajdonosa vagy egy admin kezelheti." };
  let url: string;
  try {
    url = await portalUrl(user);
  } catch (error) {
    console.error("billing portal failed", error instanceof Error ? error.message : error);
    return { error: "Az előfizetés kezelése most nem érhető el. Próbáld újra pár perc múlva." };
  }
  redirect(url);
}
