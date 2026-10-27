// Pure rules for viewings: what the feedback answers mean, which follow-up
// task they leave, and which times the AI may suggest from an email.

import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";

export type ViewingStatus = "scheduled" | "completed" | "no_show" | "cancelled";
export type Interest = "high" | "medium" | "low" | "none";
/** The feedback answer: an interest level, or the client didn't come. */
export type Outcome = Interest | "no_show";

export const DURATIONS = [30, 45, 60, 90] as const;
export const DEFAULT_DURATION = 45;

export const outcomeLabels: Record<Outcome, string> = {
  high: "Nagyon tetszett",
  medium: "Érdekli, gondolkodik",
  low: "Inkább nem",
  none: "Nem érdekli",
  no_show: "Nem jött el",
};

export const statusLabels: Record<ViewingStatus, string> = {
  scheduled: "Tervezett",
  completed: "Megtörtént",
  no_show: "Nem jött el",
  cancelled: "Lemondva",
};

/** Waiting for feedback: scheduled, and its end has passed. */
export function awaitingFeedback(v: { status: ViewingStatus; startsAt: string; durationMinutes: number }, now: Date) {
  return v.status === "scheduled" && new Date(v.startsAt).getTime() + v.durationMinutes * 60_000 <= now.getTime();
}

const DAY = 86_400_000;

/**
 * The follow-up a feedback answer leaves: a task title and when it is due.
 * A clear "no" leaves none; the listing is then not suggested to the client again.
 */
export function followUpFor(outcome: Outcome, names: { client: string; property: string }, now: Date): { title: string; dueAt: string } | null {
  const due = (days: number) => new Date(now.getTime() + days * DAY).toISOString();
  switch (outcome) {
    case "high":
      return { title: `Ajánlat vagy második megtekintés: ${names.property} → ${names.client}`, dueAt: due(1) };
    case "medium":
      return { title: `Utánkövetés a megtekintés után: ${names.property} → ${names.client}`, dueAt: due(2) };
    case "no_show":
      return { title: `Új időpont egyeztetése: ${names.property} → ${names.client}`, dueAt: due(0) };
    default:
      return null;
  }
}

/** The relation the viewing leaves between client and listing. */
export function relationFor(outcome: Outcome): "viewed" | "rejected" | null {
  if (outcome === "no_show") return null;
  return outcome === "none" || outcome === "low" ? "rejected" : "viewed";
}

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const HORIZON_DAYS = 120;

/**
 * Times an email proposed, as the AI read them (Budapest wall clock), kept
 * only when well-formed, in the future and within a few months. Sorted, unique.
 */
export function cleanProposedTimes(times: unknown, now: Date): string[] {
  if (!Array.isArray(times)) return [];
  const out = new Set<string>();
  for (const t of times) {
    if (typeof t !== "string" || !LOCAL.test(t)) continue;
    const utc = zonedLocalToUtc(t);
    if (!utc) continue;
    const at = new Date(utc).getTime();
    if (at <= now.getTime() || at > now.getTime() + HORIZON_DAYS * DAY) continue;
    // Round-trip to drop impossible dates like 2026-02-30.
    if (utcToZonedLocal(utc) !== t) continue;
    out.add(t);
  }
  return [...out].sort().slice(0, 5);
}

/** A sensible default slot: tomorrow at 17:00 Budapest time. */
export function defaultSlot(now: Date): string {
  const tomorrow = new Date(now.getTime() + DAY);
  return `${utcToZonedLocal(tomorrow.toISOString()).slice(0, 10)}T17:00`;
}

/** Fills date placeholders like [időpont] in a reply with the booked time. */
export function fillTimePlaceholders(text: string, when: string) {
  return text.replace(/\[(?:javasolt |megtekintési |pontos )?(?:időpont|dátum|nap és időpont|dátum és időpont|időpontot)\]/gi, when);
}

export type CalendarOutcome = "added" | "updated" | "skipped" | "other_calendar" | "needs_permission" | "api_disabled" | "revoked" | "failed";

/** What to tell the agent about the Google Calendar part; null when there is nothing to say. */
export const calendarMessages: Record<CalendarOutcome, string | null> = {
  added: "Bekerült a Google Naptáradba, emlékeztetővel előtte egy nappal és egy órával.",
  updated: "A Google Naptárad is frissült.",
  skipped: null,
  other_calendar: "A naptáresemény egy kollégád Google Naptárában van, azt ő tudja frissíteni.",
  needs_permission: "A Google Naptárhoz engedély kell.",
  api_disabled: "A Google Naptár-kapcsolat most nem működik, szólj nekünk a Visszajelzés gombbal. A megtekintés mentve van.",
  revoked: "A Google-hozzáférés megszűnt. Kapcsold össze újra a Levelek oldalon.",
  failed: "A Google Naptárba most nem sikerült beírni. A megtekintés mentve van; később próbáld újra.",
};

export const enableCalendarHref = (next: string) => `/api/mail/google/connect?calendar=1&next=${encodeURIComponent(next)}`;

const spoken = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
/** For an email to the client: "november 3., kedd 17:00". */
export const spokenTime = (iso: string) => spoken.format(new Date(iso));
