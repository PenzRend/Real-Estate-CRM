import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import { sendNewEmail } from "@/lib/mail/send";
import { appOrigin } from "@/lib/origin";
import { hashSecretToken, newSecretToken } from "@/lib/secret-token";
import { db } from "@/lib/supabase/db";
import { reminderEmail } from "./reminder";

// Day-before reminders to clients, from the agent's own mailbox: when, where,
// and a link to answer "I'll come" / "I can't come". The daily job sends them
// for tomorrow's viewings; the agent can also send one by hand.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function sendViewingReminder(user: CurrentUser, viewingId: string, now: Date): Promise<{ ok: true } | { ok: false; error: string; needsPermission?: boolean }> {
  if (!UUID.test(viewingId)) return { ok: false, error: "Ismeretlen megtekintés." };
  const supabase = await db();
  const { data: v } = await supabase
    .from("viewings")
    .select("id, client_id, property_id, starts_at, duration_minutes, location, status")
    .eq("id", viewingId)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (!v || v.status !== "scheduled") return { ok: false, error: "Ez a megtekintés már nem aktuális." };
  if (Date.parse(v.starts_at) < now.getTime()) return { ok: false, error: "Ez a megtekintés már elkezdődött." };
  const [{ data: client }, { data: property }, { data: contact }] = await Promise.all([
    supabase.from("clients").select("full_name, email").eq("id", v.client_id).maybeSingle(),
    supabase.from("properties").select("title, address, postal_code, city, district").eq("id", v.property_id).maybeSingle(),
    supabase.from("property_shares").select("contact_name, contact_phone").eq("organization_id", user.organization.id).eq("created_by", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!client?.email) return { ok: false, error: "Az ügyfélnek nincs e-mail-címe a Flavióban." };

  // A fresh link each time; the previous one stops working.
  const token = newSecretToken();
  const { error: tokenError } = await supabase.from("viewings").update({ response_token_hash: hashSecretToken(token) }).eq("id", v.id);
  if (tokenError) return { ok: false, error: "Az emlékeztetőt nem sikerült előkészíteni." };

  const address = property ? [property.address, [property.postal_code, property.city].filter(Boolean).join(" "), property.district].filter(Boolean).join(", ") : null;
  const { subject, body } = reminderEmail({
    clientName: client.full_name,
    startsAt: v.starts_at,
    durationMinutes: v.duration_minutes,
    propertyTitle: property?.title ?? "ingatlan",
    place: v.location || address || null,
    link: `${await appOrigin()}/v/${token}`,
    agentName: contact?.contact_name || user.fullName || "Az ingatlanosa",
    agentPhone: contact?.contact_phone || null,
  });
  const sent = await sendNewEmail(user, { to: client.email, subject, body, clientId: v.client_id, propertyId: v.property_id, followUpDays: null, taskTitle: "" }, now);
  if (!sent.ok) return sent;
  await supabase.from("viewings").update({ reminder_sent_at: sent.sentAt }).eq("id", v.id);
  return { ok: true };
}

/** Tomorrow's viewings (Budapest time) whose client should get a reminder this morning. */
export async function dueReminders(now: Date): Promise<{ viewingId: string; organizationId: string; agentId: string }[]> {
  const supabase = await db();
  const tomorrow = addDays(utcToZonedLocal(now.toISOString()).slice(0, 10), 1);
  const { data } = await supabase
    .from("viewings")
    .select("id, organization_id, created_by, client_id")
    .eq("status", "scheduled")
    .eq("client_reminders", true)
    .is("reminder_sent_at", null)
    .gte("starts_at", zonedLocalToUtc(`${tomorrow}T00:00`)!)
    .lt("starts_at", zonedLocalToUtc(`${addDays(tomorrow, 1)}T00:00`)!)
    .limit(2000);
  return (data ?? []).flatMap((v) => (v.created_by ? [{ viewingId: v.id as string, organizationId: v.organization_id as string, agentId: v.created_by as string }] : []));
}

export async function setClientReminders(user: CurrentUser, viewingId: string, on: boolean) {
  if (!UUID.test(viewingId)) return;
  const supabase = await db();
  await supabase.from("viewings").update({ client_reminders: on }).eq("id", viewingId).eq("organization_id", user.organization.id);
}
