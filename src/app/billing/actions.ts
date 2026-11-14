"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { checkoutUrl, portalUrl } from "@/lib/billing/data";
import { createClient } from "@/lib/supabase/server";

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

export type RedeemState = { error?: string; code?: string };

const redeemErrors: Record<string, string> = {
  unknown: "Ez a meghívókód nem érvényes. Ellenőrizd a betűket és a kötőjelet.",
  used: "Ezt a meghívókódot már felhasználták.",
  expired: "Ez a meghívókód lejárt.",
  other_email: "Ez a meghívókód egy másik e-mail-címhez szól, mint amivel bejelentkeztél.",
  not_allowed: "Meghívókódot csak még nem előfizetett munkaterületre, a tulajdonos vagy egy admin válthat be.",
};

/** An invite code entered on the payment page: 30 free days, then on into Flavio. */
export async function redeemCodeAction(_: RedeemState, formData: FormData): Promise<RedeemState> {
  const user = await getCurrentUser();
  const code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 20);
  if (!code) return { error: "Írd be a meghívókódot." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_signup_code", { p_org: user.organization.id, p_code: code });
  if (error) {
    console.error("redeem_signup_code failed", error.code ?? error.message);
    return { error: "A kód beváltása most nem sikerült. Próbáld újra pár perc múlva.", code };
  }
  if (data !== "ok") return { error: redeemErrors[data as string] ?? redeemErrors.unknown, code };
  redirect("/dashboard");
}
