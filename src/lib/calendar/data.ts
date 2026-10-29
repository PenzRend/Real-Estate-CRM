import "server-only";
import { lookup } from "node:dns/promises";
import type { CurrentUser } from "@/lib/auth";
import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";
import { utcToZonedLocal } from "@/lib/i18n/timezone";
import { decryptToken, encryptToken } from "@/lib/mail/crypto";
import { MailAccessRevoked } from "@/lib/mail/google";
import { calendarLabels } from "@/lib/mail/provider";
import { listMailboxes, mailboxWithToken } from "@/lib/mail/sync";
import { isPublicAddress } from "@/lib/net/address";
import { createClient } from "@/lib/supabase/server";
import { CalendarApiDisabled, CalendarNotAllowed, listEvents } from "@/lib/viewings/calendar";
import { eventsInRange } from "./ics-import";
import type { CalendarEvent } from "./week";

// The Flavio calendar: the workspace's viewings, the agent's tasks, their own
// Google or Outlook calendars, and any calendar they subscribed to by iCal link
// (iCloud, a colleague's Google calendar, a booking system…), side by side.

export const SUBSCRIPTION_COLORS = ["sky", "violet", "amber", "rose", "emerald", "slate"] as const;
export type SubscriptionColor = (typeof SUBSCRIPTION_COLORS)[number];

export type Subscription = { id: string; name: string; color: SubscriptionColor; lastError: string | null };

const MAX_ICS_BYTES = 5_000_000;
const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; text: string }>();

export class IcsFetchError extends Error {}

/** "webcal://…" → "https://…"; null for anything that isn't an http(s) link. */
export function normalizeCalendarUrl(raw: string): string | null {
  const value = raw.trim().replace(/^webcals?:\/\//i, "https://");
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function assertPublicHost(url: URL) {
  let addresses;
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new IcsFetchError("A naptár címe nem található.");
  }
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) throw new IcsFetchError("Ez a link nem nyilvános naptárra mutat.");
}

/** Downloads an iCal file: public hosts only (also after redirects), size- and time-limited, cached for a few minutes. */
async function fetchIcs(link: string, fresh = false): Promise<string> {
  const hit = cache.get(link);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.text;
  let url = new URL(link);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, { redirect: "manual", headers: { Accept: "text/calendar, */*" }, signal: AbortSignal.timeout(15_000) }).catch(() => {
      throw new IcsFetchError("A naptár nem érhető el.");
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new IcsFetchError("A naptár nem érhető el.");
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) throw new IcsFetchError("A link már nem érvényes, vagy a naptár nem nyilvános.");
    if (!res.ok || !res.body) throw new IcsFetchError("A naptár nem érhető el.");
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ICS_BYTES) {
        await reader.cancel();
        throw new IcsFetchError("A naptár túl nagy.");
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) throw new IcsFetchError("Ez a link nem naptárfájlra (iCal) mutat.");
    cache.set(link, { at: Date.now(), text });
    return text;
  }
  throw new IcsFetchError("A naptár nem érhető el (túl sok átirányítás).");
}

export async function listSubscriptions(user: CurrentUser): Promise<Subscription[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_subscriptions")
    .select("id, name, color, last_error")
    .eq("user_id", user.id)
    .eq("organization_id", user.organization.id)
    .order("created_at");
  if (error) throw new Error(`Failed to load calendars: ${error.message}`);
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color as SubscriptionColor, lastError: s.last_error }));
}

/** Checks the link really is a calendar before saving it (encrypted: whoever has it can read the calendar). */
export async function addSubscription(user: CurrentUser, input: { name: string; url: string; color: SubscriptionColor }): Promise<{ ok: true } | { ok: false; error: string }> {
  const link = normalizeCalendarUrl(input.url);
  if (!link) return { ok: false, error: "Adj meg egy naptárlinket (https:// vagy webcal://)." };
  const name = input.name.trim().slice(0, 80) || new URL(link).hostname;
  try {
    eventsInRange(await fetchIcs(link, true), new Date(), new Date(Date.now() + 86_400_000));
  } catch (error) {
    return { ok: false, error: error instanceof IcsFetchError ? error.message : "A linken lévő naptárt nem tudtuk beolvasni." };
  }
  const supabase = await createClient();
  const { count } = await supabase.from("calendar_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("organization_id", user.organization.id);
  if ((count ?? 0) >= 20) return { ok: false, error: "Legfeljebb 20 naptárat köthetsz be." };
  const { error } = await supabase.from("calendar_subscriptions").insert({
    organization_id: user.organization.id,
    user_id: user.id,
    name,
    url_enc: encryptToken(link),
    color: input.color,
  });
  if (error) {
    console.error("calendar subscription save failed", error.code);
    return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };
  }
  return { ok: true };
}

export async function removeSubscription(user: CurrentUser, id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_subscriptions").delete().eq("id", id).eq("user_id", user.id).eq("organization_id", user.organization.id);
  if (error) throw new Error(`Failed to remove calendar: ${error.code}`);
}

const providerColor = { gmail: "sky", outlook: "violet", imap: "slate" } as const;

/** A task's due time: at a time of day it is a short slot; at midnight (or 23:59) the whole day. */
function taskEvent(t: { id: string; title: string; due_at: string; client_id: string | null }): CalendarEvent {
  const time = utcToZonedLocal(t.due_at, DEFAULT_TIMEZONE).slice(11, 16);
  const allDay = time === "00:00" || time === "23:59";
  const start = allDay ? new Date(Date.parse(t.due_at) - (time === "23:59" ? 23 * 3600_000 + 59 * 60_000 : 0)).toISOString() : t.due_at;
  return {
    id: `task:${t.id}`,
    title: t.title,
    start,
    end: new Date(Date.parse(start) + (allDay ? 86_400_000 : 30 * 60_000)).toISOString(),
    allDay,
    source: "task",
    calendar: "Feladat",
    color: "amber",
    location: null,
    href: t.client_id ? `/clients/${t.client_id}` : "/tasks",
  };
}

export type WeekData = { events: CalendarEvent[]; problems: string[]; connected: { email: string; label: string }[] };

/** Everything in the calendar between two instants; a calendar that can't be read is named in `problems`, the rest still shows. */
export async function calendarEvents(user: CurrentUser, from: Date, to: Date): Promise<WeekData> {
  const supabase = await createClient();
  const problems: string[] = [];
  const range = { from: from.toISOString(), to: to.toISOString() };

  const [viewings, tasks, mailboxes, subscriptions] = await Promise.all([
    supabase
      .from("viewings")
      .select("id, client_id, property_id, starts_at, duration_minutes, location, status, calendar_event_id")
      .eq("organization_id", user.organization.id)
      .neq("status", "cancelled")
      .gte("starts_at", new Date(from.getTime() - 86_400_000).toISOString())
      .lt("starts_at", range.to)
      .order("starts_at")
      .limit(500),
    supabase
      .from("tasks")
      .select("id, title, due_at, client_id")
      .eq("organization_id", user.organization.id)
      .in("status", ["todo", "in_progress"])
      .or(`assigned_to.eq.${user.id},assigned_to.is.null`)
      .gte("due_at", range.from)
      .lt("due_at", range.to)
      .limit(500),
    listMailboxes(user),
    supabase.from("calendar_subscriptions").select("id, name, color, url_enc, last_error").eq("user_id", user.id).eq("organization_id", user.organization.id).order("created_at"),
  ]);

  const events: CalendarEvent[] = [];
  const viewingRows = viewings.data ?? [];
  const flavioEventIds = new Set(viewingRows.map((v) => v.calendar_event_id).filter(Boolean));
  if (viewingRows.length) {
    const [{ data: clients }, { data: properties }] = await Promise.all([
      supabase.from("clients").select("id, full_name").in("id", [...new Set(viewingRows.map((v) => v.client_id))]),
      supabase.from("properties").select("id, title").in("id", [...new Set(viewingRows.map((v) => v.property_id))]),
    ]);
    const clientName = new Map((clients ?? []).map((c) => [c.id, c.full_name as string]));
    const propertyName = new Map((properties ?? []).map((p) => [p.id, p.title as string]));
    for (const v of viewingRows) {
      const end = new Date(Date.parse(v.starts_at) + v.duration_minutes * 60_000).toISOString();
      if (end <= range.from) continue;
      events.push({
        id: `viewing:${v.id}`,
        title: `Megtekintés: ${clientName.get(v.client_id) ?? "ügyfél"} – ${propertyName.get(v.property_id) ?? "ingatlan"}`,
        start: v.starts_at,
        end,
        allDay: false,
        source: "viewing",
        calendar: v.status === "done" ? "Megtekintés (lezárva)" : "Megtekintés",
        color: "accent",
        location: v.location,
        href: `/clients/${v.client_id}`,
      });
    }
  }
  for (const t of tasks.data ?? []) if (t.due_at) events.push(taskEvent(t));

  // The agent's own Google / Outlook calendars (those with the calendar permission).
  const withCalendar = mailboxes.filter((m) => m.can_calendar && m.status !== "revoked" && m.provider !== "imap");
  await Promise.all(
    withCalendar.map(async (m) => {
      const label = `${calendarLabels[m.provider]} · ${m.email_address}`;
      try {
        const access = await mailboxWithToken(user, m.id);
        if (!access) return;
        const read = await listEvents({ mailboxId: m.id, provider: m.provider, token: access.token }, from, to);
        for (const e of read) {
          // Viewings Flavio put there are already shown as viewings.
          if (e.fromFlavio || flavioEventIds.has(e.id)) continue;
          events.push({ id: `${m.id}:${e.id}`, title: e.title, start: e.start, end: e.end, allDay: e.allDay, source: "external", calendar: label, color: providerColor[m.provider], location: e.location, href: e.link });
        }
      } catch (error) {
        if (error instanceof CalendarNotAllowed || error instanceof CalendarApiDisabled) problems.push(`${label}: nincs olvasási engedély.`);
        else if (error instanceof MailAccessRevoked) problems.push(`${label}: a hozzáférés megszűnt.`);
        else {
          console.error("calendar read failed", error instanceof Error ? error.message : error);
          problems.push(`${label}: most nem olvasható.`);
        }
      }
    }),
  );

  // Calendars subscribed by link.
  await Promise.all(
    (subscriptions.data ?? []).map(async (s) => {
      let note: string | null = null;
      try {
        const text = await fetchIcs(decryptToken(s.url_enc));
        for (const e of eventsInRange(text, from, to)) {
          events.push({ id: `${s.id}:${e.uid}`, title: e.title, start: e.start, end: e.end, allDay: e.allDay, source: "external", calendar: s.name, color: s.color, location: e.location, href: null });
        }
      } catch (error) {
        note = error instanceof IcsFetchError ? error.message : "A naptárt nem tudtuk beolvasni.";
        problems.push(`${s.name}: ${note}`);
      }
      if (note !== s.last_error) await supabase.from("calendar_subscriptions").update({ last_error: note }).eq("id", s.id).eq("user_id", user.id);
    }),
  );

  return { events, problems, connected: withCalendar.map((m) => ({ email: m.email_address, label: calendarLabels[m.provider] })) };
}
