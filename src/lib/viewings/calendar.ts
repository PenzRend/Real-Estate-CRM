import "server-only";
import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";
import { MailAccessRevoked } from "@/lib/mail/google";
import { graph, GraphNotAllowed } from "@/lib/mail/microsoft";
import type { MailProvider } from "@/lib/mail/provider";

// The few calendar calls viewings need, in the agent's own calendar (Google
// Calendar or Outlook, whichever mailbox they connected): create, move and
// cancel the event the CRM created.

/** The connected provider and an access token with the calendar permission. */
export type CalendarAccess = { provider: MailProvider; token: string };

export class CalendarNotAllowed extends Error {}
/** The Calendar API is not switched on in the Google Cloud project. */
export class CalendarApiDisabled extends Error {}

export type EventInput = {
  summary: string;
  description: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  /** Invite the client (Google emails them the invitation). */
  attendee: { email: string; name: string } | null;
  viewingId: string;
};

const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

async function call<T>(url: string, accessToken: string, init: { method: string; body?: unknown }): Promise<T | null> {
  const res = await fetch(url, {
    method: init.method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401) throw new MailAccessRevoked("Google Calendar rejected the access token");
  if (res.status === 403) {
    const text = await res.text().catch(() => "");
    if (/accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(text)) throw new CalendarApiDisabled("Calendar API disabled");
    throw new CalendarNotAllowed("Google Calendar refused (missing permission)");
  }
  // Already gone at Google: nothing left to change.
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Google Calendar returned ${res.status}`);
  return res.status === 204 ? null : ((await res.json()) as T);
}

function eventBody(e: EventInput) {
  return {
    summary: e.summary,
    description: e.description,
    location: e.location ?? undefined,
    start: { dateTime: e.startsAt, timeZone: DEFAULT_TIMEZONE },
    end: { dateTime: e.endsAt, timeZone: DEFAULT_TIMEZONE },
    // A day before and an hour before.
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 24 * 60 }, { method: "popup", minutes: 60 }] },
    attendees: e.attendee ? [{ email: e.attendee.email, displayName: e.attendee.name }] : [],
    extendedProperties: { private: { crmViewingId: e.viewingId } },
  };
}

// Outlook (Microsoft Graph): times go as UTC wall-clock, invitations and
// updates to attendees are sent by Outlook itself.
const utc = (iso: string) => ({ dateTime: new Date(iso).toISOString().replace("Z", ""), timeZone: "UTC" });

async function outlook<T>(path: string, token: string, init: { method?: string; body?: unknown } = {}) {
  try {
    return await graph<T>(path, token, init);
  } catch (error) {
    if (error instanceof GraphNotAllowed) throw new CalendarNotAllowed("Outlook calendar refused (missing permission)");
    throw error;
  }
}

export async function createEvent(cal: CalendarAccess, e: EventInput): Promise<{ id: string; htmlLink: string }> {
  if (cal.provider === "outlook") {
    const r = await outlook<{ id: string; webLink: string }>("events", cal.token, {
      method: "POST",
      body: {
        subject: e.summary,
        body: { contentType: "text", content: e.description },
        start: utc(e.startsAt),
        end: utc(e.endsAt),
        ...(e.location ? { location: { displayName: e.location } } : {}),
        attendees: e.attendee ? [{ emailAddress: { address: e.attendee.email, name: e.attendee.name }, type: "required" }] : [],
        isReminderOn: true,
        reminderMinutesBeforeStart: 60,
        // Outlook ignores a repeated create with the same id: no duplicate on a retry.
        transactionId: e.viewingId,
      },
    });
    if (!r) throw new Error("Outlook returned no event");
    return { id: r.id, htmlLink: r.webLink };
  }
  const r = await call<{ id: string; htmlLink: string }>(`${BASE}?sendUpdates=${e.attendee ? "all" : "none"}`, cal.token, { method: "POST", body: eventBody(e) });
  if (!r) throw new Error("Google Calendar returned no event");
  return r;
}

/** Moves the event; invited guests get the update. Null when the event no longer exists. */
export async function moveEvent(cal: CalendarAccess, eventId: string, p: { startsAt: string; endsAt: string; location: string | null }) {
  if (cal.provider === "outlook") {
    return outlook<{ id: string }>(`events/${encodeURIComponent(eventId)}`, cal.token, {
      method: "PATCH",
      body: { start: utc(p.startsAt), end: utc(p.endsAt), ...(p.location ? { location: { displayName: p.location } } : {}) },
    });
  }
  return call<{ id: string; htmlLink: string }>(`${BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, cal.token, {
    method: "PATCH",
    body: {
      start: { dateTime: p.startsAt, timeZone: DEFAULT_TIMEZONE },
      end: { dateTime: p.endsAt, timeZone: DEFAULT_TIMEZONE },
      ...(p.location ? { location: p.location } : {}),
    },
  });
}

/** Removes the event; invited guests get the cancellation. */
export async function cancelEvent(cal: CalendarAccess, eventId: string) {
  if (cal.provider === "outlook") {
    const path = `events/${encodeURIComponent(eventId)}`;
    try {
      // A meeting with the client: "cancel" tells them. An event without guests can't be cancelled, only deleted.
      await outlook(`${path}/cancel`, cal.token, { method: "POST", body: { comment: "" } });
    } catch (error) {
      if (error instanceof CalendarNotAllowed || error instanceof MailAccessRevoked) throw error;
      await outlook(path, cal.token, { method: "DELETE" });
    }
    return;
  }
  await call(`${BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, cal.token, { method: "DELETE" });
}
