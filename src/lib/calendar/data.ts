import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";
import { utcToZonedLocal } from "@/lib/i18n/timezone";
import { isICloudEmail, NOT_APP_PASSWORD, normalizeAppPassword } from "@/lib/mail/app-password";
import { decryptToken, encryptToken } from "@/lib/mail/crypto";
import { MailAccessRevoked } from "@/lib/mail/google";
import { calendarLabels } from "@/lib/mail/provider";
import { listMailboxes, mailboxWithToken } from "@/lib/mail/sync";
import { publicHostProblem } from "@/lib/net/public-host";
import { createClient } from "@/lib/supabase/server";
import { CalendarApiDisabled, CalendarNotAllowed, listEvents } from "@/lib/viewings/calendar";
import { CalDavError, calendarEventsIcs, discoverCalendars, ICLOUD_CALDAV } from "./caldav";
import { nearestColor } from "./caldav-xml";
import { eventsInRange, type ImportedEvent } from "./ics-import";
import type { CalendarEvent } from "./week";

// The Flavio calendar: the workspace's viewings, the agent's tasks, their own
// Google or Outlook calendars, their iCloud (or other CalDAV) calendars, and
// any calendar they subscribed to by iCal link, side by side.

export const SUBSCRIPTION_COLORS = ["sky", "violet", "amber", "rose", "emerald", "slate"] as const;
export type SubscriptionColor = (typeof SUBSCRIPTION_COLORS)[number];

/** An outside calendar: by iCal link, or read over CalDAV (iCloud…) as `username`. */
export type Subscription = { id: string; name: string; color: SubscriptionColor; lastError: string | null; kind: "ics" | "caldav"; username: string | null };

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
  const problem = await publicHostProblem(url.hostname);
  if (problem) throw new IcsFetchError(problem);
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
    .select("id, name, color, last_error, kind, username")
    .eq("user_id", user.id)
    .eq("organization_id", user.organization.id)
    .order("created_at");
  if (error) throw new Error(`Failed to load calendars: ${error.message}`);
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color as SubscriptionColor, lastError: s.last_error, kind: s.kind as Subscription["kind"], username: s.username }));
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
  if ((count ?? 0) >= MAX_SUBSCRIPTIONS) return { ok: false, error: `Legfeljebb ${MAX_SUBSCRIPTIONS} naptárat köthetsz be.` };
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

const MAX_SUBSCRIPTIONS = 20;

/**
 * Adds every event calendar of a CalDAV account (iCloud by default): each shows
 * separately and can be removed on its own. Connecting the same account again
 * replaces its calendars (e.g. after a new app password).
 */
export async function addCalDavCalendars(
  user: CurrentUser,
  input: { username: string; password: string; server?: string | null },
): Promise<{ ok: true; added: number } | { ok: false; error: string; auth?: boolean }> {
  const username = input.username.trim().toLowerCase();
  if (!username || username.length > 320 || !input.password.trim()) return { ok: false, error: "Add meg az Apple ID-t és az Apple-től kapott jelszót." };
  let server = ICLOUD_CALDAV;
  let password = input.password.trim();
  if (input.server?.trim()) {
    const url = normalizeCalendarUrl(input.server.trim().replace(/^(?!https?:\/\/)/i, "https://"));
    if (!url || !url.startsWith("https:")) return { ok: false, error: "A szerver címe https:// kezdetű legyen." };
    server = url;
  } else {
    // iCloud only takes app passwords: catch a pasted normal password before Apple refuses it.
    const appPassword = normalizeAppPassword(password);
    if (!appPassword) return { ok: false, error: NOT_APP_PASSWORD };
    password = appPassword;
  }
  let calendars;
  try {
    calendars = await discoverCalendars(server, { username, password });
  } catch (error) {
    if (error instanceof CalDavError) return { ok: false, error: error.message, auth: error.auth };
    console.error("caldav discovery failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "A naptárakat nem sikerült lekérni. Próbáld újra." };
  }
  if (!calendars.length) return { ok: false, error: "Ebben a fiókban nem találtunk naptárat." };

  const supabase = await createClient();
  const own = { user_id: user.id, organization_id: user.organization.id };
  // Reconnecting the same account replaces its calendars.
  const { error: clearError } = await supabase.from("calendar_subscriptions").delete().match(own).eq("kind", "caldav").eq("username", username);
  if (clearError) return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };
  const { count } = await supabase.from("calendar_subscriptions").select("id", { count: "exact", head: true }).match(own);
  const room = Math.max(0, MAX_SUBSCRIPTIONS - (count ?? 0));
  if (!room) return { ok: false, error: `Legfeljebb ${MAX_SUBSCRIPTIONS} naptárat köthetsz be.` };
  const secret = encryptToken(password);
  const { error } = await supabase.from("calendar_subscriptions").insert(
    calendars.slice(0, room).map((c, i) => ({
      ...own,
      kind: "caldav",
      name: c.name.slice(0, 80),
      url_enc: encryptToken(c.href),
      username,
      secret_enc: secret,
      color: nearestColor(c.color, SUBSCRIPTION_COLORS[i % SUBSCRIPTION_COLORS.length]),
    })),
  );
  if (error) {
    console.error("caldav calendars save failed", error.code);
    return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };
  }
  return { ok: true, added: Math.min(room, calendars.length) };
}

/** iCloud mail connected over IMAP: its app password works for iCloud Calendar too. */
export async function addICloudCalendarsFromMailbox(user: CurrentUser, mailboxId: string) {
  const access = await mailboxWithToken(user, mailboxId).catch(() => null);
  const email = access?.mailbox.email_address ?? "";
  if (!access || access.mailbox.provider !== "imap" || !isICloudEmail(email)) {
    return { ok: false as const, error: "Ehhez a postafiókhoz nem tartozik iCloud-naptár." };
  }
  return addCalDavCalendars(user, { username: email, password: access.token });
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

const davCache = new Map<string, { at: number; events: ImportedEvent[] }>();

/** One CalDAV calendar's events in the range, cached for a few minutes. */
async function davEvents(id: string, url: string, login: { username: string; password: string }, from: Date, to: Date) {
  const key = `${id}|${from.toISOString()}|${to.toISOString()}`;
  const hit = davCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS / 2) return hit.events;
  const events = (await calendarEventsIcs(url, login, from, to)).flatMap((ics) => eventsInRange(ics, from, to));
  if (davCache.size > 500) davCache.clear();
  davCache.set(key, { at: Date.now(), events });
  return events;
}

export type WeekData = { events: CalendarEvent[]; problems: string[]; connected: { email: string; label: string }[] };

/**
 * Everything in the calendar between two instants; a calendar that can't be
 * read is named in `problems`, the rest still shows. Viewings are the whole
 * office's (colleagues' ones marked with their name, so two agents don't book
 * the same flat at once), or only the agent's own with `scope: "mine"`.
 */
export async function calendarEvents(user: CurrentUser, from: Date, to: Date, scope: "office" | "mine" = "office"): Promise<WeekData> {
  const supabase = await createClient();
  const problems: string[] = [];
  const range = { from: from.toISOString(), to: to.toISOString() };

  const [viewings, tasks, mailboxes, subscriptions] = await Promise.all([
    (() => {
      const q = supabase
        .from("viewings")
        .select("id, client_id, property_id, starts_at, duration_minutes, location, status, calendar_event_id, created_by")
        .eq("organization_id", user.organization.id)
        .neq("status", "cancelled")
        .gte("starts_at", new Date(from.getTime() - 86_400_000).toISOString())
        .lt("starts_at", range.to)
        .order("starts_at")
        .limit(500);
      return scope === "mine" ? q.eq("created_by", user.id) : q;
    })(),
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
    supabase.from("calendar_subscriptions").select("id, name, color, url_enc, last_error, kind, username, secret_enc").eq("user_id", user.id).eq("organization_id", user.organization.id).order("created_at"),
  ]);

  const events: CalendarEvent[] = [];
  const viewingRows = viewings.data ?? [];
  const flavioEventIds = new Set(viewingRows.map((v) => v.calendar_event_id).filter(Boolean));
  if (viewingRows.length) {
    const others = [...new Set(viewingRows.map((v) => v.created_by).filter((id): id is string => Boolean(id) && id !== user.id))];
    const [{ data: clients }, { data: properties }, { data: agents }] = await Promise.all([
      supabase.from("clients").select("id, full_name").in("id", [...new Set(viewingRows.map((v) => v.client_id))]),
      supabase.from("properties").select("id, title").in("id", [...new Set(viewingRows.map((v) => v.property_id))]),
      others.length ? supabase.from("profiles").select("id, full_name, email").in("id", others) : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
    ]);
    const clientName = new Map((clients ?? []).map((c) => [c.id, c.full_name as string]));
    const propertyName = new Map((properties ?? []).map((p) => [p.id, p.title as string]));
    const agentName = new Map((agents ?? []).map((a) => [a.id, ((a.full_name as string | null) ?? (a.email as string)).split(" ").slice(-1)[0]]));
    for (const v of viewingRows) {
      const end = new Date(Date.parse(v.starts_at) + v.duration_minutes * 60_000).toISOString();
      if (end <= range.from) continue;
      const colleague = v.created_by && v.created_by !== user.id ? (agentName.get(v.created_by) ?? "kolléga") : null;
      events.push({
        id: `viewing:${v.id}`,
        title: `${colleague ? `${colleague}: ` : "Megtekintés: "}${clientName.get(v.client_id) ?? "ügyfél"} – ${propertyName.get(v.property_id) ?? "ingatlan"}`,
        start: v.starts_at,
        end,
        allDay: false,
        source: "viewing",
        calendar: colleague ? `${colleague} megtekintése` : v.status === "done" ? "Megtekintés (lezárva)" : "Megtekintés",
        color: colleague ? "slate" : "accent",
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

  // Calendars subscribed by link or read over CalDAV.
  await Promise.all(
    (subscriptions.data ?? []).map(async (s) => {
      let note: string | null = null;
      try {
        const found: ImportedEvent[] =
          s.kind === "caldav" && s.username && s.secret_enc
            ? await davEvents(s.id, decryptToken(s.url_enc), { username: s.username, password: decryptToken(s.secret_enc) }, from, to)
            : eventsInRange(await fetchIcs(decryptToken(s.url_enc)), from, to);
        for (const e of found) {
          events.push({ id: `${s.id}:${e.uid}`, title: e.title, start: e.start, end: e.end, allDay: e.allDay, source: "external", calendar: s.name, color: s.color, location: e.location, href: null });
        }
      } catch (error) {
        note = error instanceof IcsFetchError || error instanceof CalDavError ? error.message : "A naptárt nem tudtuk beolvasni.";
        problems.push(`${s.name}: ${note}`);
      }
      if (note !== s.last_error) await supabase.from("calendar_subscriptions").update({ last_error: note }).eq("id", s.id).eq("user_id", user.id);
    }),
  );

  return { events, problems, connected: withCalendar.map((m) => ({ email: m.email_address, label: calendarLabels[m.provider] })) };
}
