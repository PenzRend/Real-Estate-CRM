import "server-only";
import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";
import { MailAccessRevoked } from "@/lib/mail/google";

// The few Google Calendar calls viewings need, in the agent's primary
// calendar: create, move and cancel the event the CRM created.

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

export async function createEvent(accessToken: string, e: EventInput) {
  const r = await call<{ id: string; htmlLink: string }>(`${BASE}?sendUpdates=${e.attendee ? "all" : "none"}`, accessToken, { method: "POST", body: eventBody(e) });
  if (!r) throw new Error("Google Calendar returned no event");
  return r;
}

/** Moves the event; invited guests get the update. Null when the event no longer exists. */
export async function moveEvent(accessToken: string, eventId: string, p: { startsAt: string; endsAt: string; location: string | null }) {
  return call<{ id: string; htmlLink: string }>(`${BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, accessToken, {
    method: "PATCH",
    body: {
      start: { dateTime: p.startsAt, timeZone: DEFAULT_TIMEZONE },
      end: { dateTime: p.endsAt, timeZone: DEFAULT_TIMEZONE },
      ...(p.location ? { location: p.location } : {}),
    },
  });
}

/** Removes the event; invited guests get the cancellation. */
export async function cancelEvent(accessToken: string, eventId: string) {
  await call(`${BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, accessToken, { method: "DELETE" });
}
