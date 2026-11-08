"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { addCalDavCalendars, addICloudCalendarsFromMailbox, addSubscription, removeSubscription, SUBSCRIPTION_COLORS, type SubscriptionColor } from "@/lib/calendar/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SubscriptionState = { ok?: boolean; error?: string };

/** "Naptár hozzáadása": a calendar's iCal link (iCloud, Google, Outlook…), checked before it is saved. */
export async function addSubscriptionAction(_prev: SubscriptionState, form: FormData): Promise<SubscriptionState> {
  const user = await getCurrentUser();
  const color = String(form.get("color") ?? "");
  const r = await addSubscription(user, {
    name: String(form.get("name") ?? "").slice(0, 200),
    url: String(form.get("url") ?? "").slice(0, 2000),
    color: (SUBSCRIPTION_COLORS as readonly string[]).includes(color) ? (color as SubscriptionColor) : "sky",
  });
  if (!r.ok) return { error: r.error };
  refresh();
  return { ok: true };
}

export async function removeSubscriptionAction(id: string) {
  if (!UUID.test(id)) return;
  const user = await getCurrentUser();
  await removeSubscription(user, id);
  refresh();
}

/** "iCloud-naptár": Apple ID and an app password (or another CalDAV server); every calendar of the account is added. */
export async function addCalDavAction(_prev: SubscriptionState, form: FormData): Promise<SubscriptionState> {
  const user = await getCurrentUser();
  const r = await addCalDavCalendars(user, {
    username: String(form.get("username") ?? "").slice(0, 320),
    password: String(form.get("password") ?? "").slice(0, 500),
    server: String(form.get("server") ?? "").slice(0, 500) || null,
  });
  if (!r.ok) return { error: r.error };
  refresh();
  return { ok: true };
}

/** The iCloud mailbox's app password opens its calendars too: one click. */
export async function addICloudFromMailboxAction(mailboxId: string): Promise<SubscriptionState> {
  if (!UUID.test(mailboxId)) return { error: "Ismeretlen postafiók." };
  const user = await getCurrentUser();
  const r = await addICloudCalendarsFromMailbox(user, mailboxId);
  if (!r.ok) return { error: r.error };
  refresh();
  return { ok: true };
}
