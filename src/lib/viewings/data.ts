import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { insertInteraction, insertTasks, SaveError, touchClient } from "@/lib/db/activity";
import { formatDateTime } from "@/lib/i18n/format";
import { zonedLocalToUtc } from "@/lib/i18n/timezone";
import { MailAccessRevoked } from "@/lib/mail/google";
import { mailboxWithToken } from "@/lib/mail/sync";
import { appOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import { CalendarApiDisabled, CalendarNotAllowed, cancelEvent, createEvent, moveEvent } from "./calendar";
import { followUpFor, outcomeLabels, relationFor, type CalendarOutcome, type Interest, type Outcome, type ViewingStatus } from "./logic";

// Viewings: booked by an agent, optionally mirrored in the booking agent's
// Google Calendar, and closed with feedback that lands on the client's
// timeline with the right follow-up. Shared within the workspace (RLS).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS =
  "id, client_id, property_id, starts_at, duration_minutes, location, notes, status, interest, feedback, feedback_at, calendar_user_id, calendar_event_id, calendar_link, created_by";

export type Viewing = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  status: ViewingStatus;
  interest: Interest | null;
  feedback: string | null;
  feedbackAt: string | null;
  client: { id: string; name: string; email: string | null; phone: string | null };
  property: { id: string; name: string; address: string | null };
  /** In someone's Google Calendar; `mine` when it is the current user's. */
  calendar: { link: string | null; mine: boolean } | null;
};

type Row = {
  id: string;
  client_id: string;
  property_id: string;
  starts_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  status: ViewingStatus;
  interest: Interest | null;
  feedback: string | null;
  feedback_at: string | null;
  calendar_user_id: string | null;
  calendar_event_id: string | null;
  calendar_link: string | null;
  created_by: string | null;
};

/** "Budapest, XI. kerület, Bartók Béla út 12." from the listing's own fields. */
function propertyAddress(p: { address: string | null; city: string | null; district: string | null }) {
  return [p.city, p.district, p.address].filter(Boolean).join(", ") || null;
}

async function hydrate(user: CurrentUser, rows: Row[]): Promise<Viewing[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  const propertyIds = [...new Set(rows.map((r) => r.property_id))];
  const [{ data: clients }, { data: properties }] = await Promise.all([
    supabase.from("clients").select("id, full_name, email, phone").in("id", clientIds),
    supabase.from("properties").select("id, title, address, city, district").in("id", propertyIds),
  ]);
  const c = new Map((clients ?? []).map((x) => [x.id as string, x]));
  const p = new Map((properties ?? []).map((x) => [x.id as string, x]));
  return rows.map((r) => {
    const client = c.get(r.client_id);
    const property = p.get(r.property_id);
    return {
      id: r.id,
      startsAt: r.starts_at,
      durationMinutes: r.duration_minutes,
      location: r.location,
      notes: r.notes,
      status: r.status,
      interest: r.interest,
      feedback: r.feedback,
      feedbackAt: r.feedback_at,
      client: { id: r.client_id, name: client?.full_name ?? "Ügyfél", email: client?.email ?? null, phone: client?.phone ?? null },
      property: { id: r.property_id, name: property?.title ?? "Ingatlan", address: property ? propertyAddress(property) : null },
      calendar: r.calendar_event_id ? { link: r.calendar_link, mine: r.calendar_user_id === user.id } : null,
    };
  });
}

/**
 * The dashboard's list: everything still scheduled from the last two weeks
 * (waiting for feedback) through the next two weeks, soonest first.
 */
export async function listOpenViewings(user: CurrentUser, now: Date): Promise<Viewing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("viewings")
    .select(COLUMNS)
    .eq("organization_id", user.organization.id)
    .eq("status", "scheduled")
    .gte("starts_at", new Date(now.getTime() - 14 * 86_400_000).toISOString())
    .lte("starts_at", new Date(now.getTime() + 14 * 86_400_000).toISOString())
    .order("starts_at")
    .limit(30);
  if (error) throw new Error(`Failed to list viewings: ${error.message}`);
  return hydrate(user, (data ?? []) as Row[]);
}

/** All viewings of one client or one listing, newest first. */
export async function listViewingsFor(user: CurrentUser, of: { clientId?: string; propertyId?: string }): Promise<Viewing[]> {
  const supabase = await createClient();
  let q = supabase.from("viewings").select(COLUMNS).eq("organization_id", user.organization.id).neq("status", "cancelled");
  if (of.clientId) q = q.eq("client_id", of.clientId);
  if (of.propertyId) q = q.eq("property_id", of.propertyId);
  const { data, error } = await q.order("starts_at", { ascending: false }).limit(20);
  if (error) throw new Error(`Failed to list viewings: ${error.message}`);
  return hydrate(user, (data ?? []) as Row[]);
}

async function getRow(user: CurrentUser, id: string): Promise<Row | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("viewings").select(COLUMNS).eq("id", id).eq("organization_id", user.organization.id).maybeSingle();
  return (data as Row | null) ?? null;
}

// ---------------------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------------------

export type { CalendarOutcome };

/** The user's Google access with the Calendar permission, or why there is none. */
async function calendarAccess(user: CurrentUser): Promise<{ token: string } | { reason: CalendarOutcome }> {
  try {
    const access = await mailboxWithToken(user);
    if (!access) return { reason: "needs_permission" };
    if (!access.mailbox.can_calendar) return { reason: "needs_permission" };
    return { token: access.token };
  } catch (error) {
    if (error instanceof MailAccessRevoked) return { reason: "revoked" };
    throw error;
  }
}

async function calendarFailure(user: CurrentUser, error: unknown): Promise<CalendarOutcome> {
  if (error instanceof CalendarNotAllowed) {
    const supabase = await createClient();
    await supabase.from("mailboxes").update({ can_calendar: false }).eq("user_id", user.id);
    return "needs_permission";
  }
  if (error instanceof CalendarApiDisabled) return "api_disabled";
  if (error instanceof MailAccessRevoked) return "revoked";
  console.error("calendar call failed", error instanceof Error ? error.message : error);
  return "failed";
}

const endOf = (startsAt: string, minutes: number) => new Date(new Date(startsAt).getTime() + minutes * 60_000).toISOString();

/** Puts one viewing in the user's Google Calendar (with reminders), optionally inviting the client. */
async function pushToCalendar(user: CurrentUser, row: Row, invite: boolean, token?: string): Promise<CalendarOutcome> {
  let accessToken = token;
  if (!accessToken) {
    const access = await calendarAccess(user);
    if ("reason" in access) return access.reason;
    accessToken = access.token;
  }
  const [v] = await hydrate(user, [row]);
  const origin = await appOrigin();
  const description = [
    `Ügyfél: ${v.client.name}`,
    v.client.phone && `Telefon: ${v.client.phone}`,
    v.client.email && `E-mail: ${v.client.email}`,
    "",
    `Ingatlan: ${v.property.name}`,
    `${origin}/properties/${v.property.id}`,
    v.notes && `\n${v.notes}`,
    "",
    `Ügyfél a CRM-ben: ${origin}/clients/${v.client.id}`,
  ]
    .filter((l): l is string => typeof l === "string")
    .join("\n");
  try {
    const event = await createEvent(accessToken, {
      summary: `Megtekintés: ${v.client.name} – ${v.property.name}`.slice(0, 250),
      description,
      location: row.location,
      startsAt: row.starts_at,
      endsAt: endOf(row.starts_at, row.duration_minutes),
      attendee: invite && v.client.email ? { email: v.client.email, name: v.client.name } : null,
      viewingId: row.id,
    });
    const supabase = await createClient();
    const { error } = await supabase
      .from("viewings")
      .update({ calendar_user_id: user.id, calendar_event_id: event.id, calendar_link: event.htmlLink })
      .eq("id", row.id)
      .eq("organization_id", user.organization.id);
    if (error) console.error("viewing calendar save failed", error.code);
    return "added";
  } catch (error) {
    return calendarFailure(user, error);
  }
}

/** "Naptárba": adds an existing viewing to the user's calendar. */
export async function addToCalendar(user: CurrentUser, id: string, invite: boolean): Promise<CalendarOutcome> {
  const row = await getRow(user, id);
  if (!row || row.status !== "scheduled") return "skipped";
  if (row.calendar_event_id) return "skipped";
  return pushToCalendar(user, row, invite);
}

/**
 * After the Calendar permission is granted: the user's upcoming viewings not
 * yet in the calendar. Stops at the first failure and says why.
 */
export async function syncPendingToCalendar(user: CurrentUser, now: Date): Promise<{ added: number; problem: CalendarOutcome | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("viewings")
    .select(COLUMNS)
    .eq("organization_id", user.organization.id)
    .eq("created_by", user.id)
    .eq("status", "scheduled")
    .is("calendar_event_id", null)
    .gte("starts_at", now.toISOString())
    .order("starts_at")
    .limit(20);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return { added: 0, problem: null };
  const access = await calendarAccess(user);
  if ("reason" in access) return { added: 0, problem: access.reason };
  let added = 0;
  for (const row of rows) {
    const r = await pushToCalendar(user, row, false, access.token);
    if (r !== "added") return { added, problem: r };
    added++;
  }
  return { added, problem: null };
}

// ---------------------------------------------------------------------------
// Booking, moving, cancelling
// ---------------------------------------------------------------------------

export type BookingInput = {
  clientId: string | null;
  /** A new client, when the inquirer isn't one yet. */
  newClient: { full_name: string; email: string | null; phone: string | null } | null;
  propertyId: string;
  /** Budapest wall clock, "2026-11-03T17:00". */
  start: string;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  addToCalendar: boolean;
  inviteClient: boolean;
  emailId: string | null;
};

export type BookingResult =
  | { ok: true; viewingId: string; clientId: string; startsAt: string; calendar: CalendarOutcome }
  | { ok: false; error: string };

export async function bookViewing(user: CurrentUser, input: BookingInput, now: Date): Promise<BookingResult> {
  const startsAt = zonedLocalToUtc(input.start);
  if (!startsAt) return { ok: false, error: "Adj meg érvényes dátumot és időpontot." };
  if (new Date(startsAt).getTime() < now.getTime() - 3600_000) return { ok: false, error: "Az időpont a múltban van." };
  if (!UUID.test(input.propertyId)) return { ok: false, error: "Válassz ingatlant." };
  const supabase = await createClient();
  const org = user.organization.id;

  const { data: property } = await supabase.from("properties").select("id").eq("id", input.propertyId).eq("organization_id", org).maybeSingle();
  if (!property) return { ok: false, error: "A kiválasztott ingatlan nem található." };

  let clientId = input.clientId;
  if (clientId) {
    const { data } = UUID.test(clientId) ? await supabase.from("clients").select("id").eq("id", clientId).eq("organization_id", org).maybeSingle() : { data: null };
    if (!data) return { ok: false, error: "A kiválasztott ügyfél nem található." };
  } else if (input.newClient) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        organization_id: org,
        full_name: input.newClient.full_name,
        email: input.newClient.email,
        phone: input.newClient.phone,
        client_type: "buyer",
        status: "active",
        lead_source: input.emailId ? "E-mail" : "Megtekintés",
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("viewing client insert failed", error?.code);
      return { ok: false, error: "Az ügyfél mentése nem sikerült. Próbáld újra." };
    }
    clientId = data.id as string;
  } else {
    return { ok: false, error: "Válassz ügyfelet." };
  }

  const { data: row, error } = await supabase
    .from("viewings")
    .insert({
      organization_id: org,
      client_id: clientId,
      property_id: input.propertyId,
      starts_at: startsAt,
      duration_minutes: input.durationMinutes,
      location: input.location,
      notes: input.notes,
      source_email_id: input.emailId && UUID.test(input.emailId) ? input.emailId : null,
    })
    .select(COLUMNS)
    .single();
  if (error || !row) {
    console.error("viewing insert failed", error?.code);
    return { ok: false, error: "A megtekintés mentése nem sikerült. Próbáld újra." };
  }

  // Bookkeeping: the client is interested in the listing, it no longer needs
  // suggesting, and the email now belongs to the client.
  await Promise.all([
    supabase
      .from("property_clients")
      .upsert({ organization_id: org, property_id: input.propertyId, client_id: clientId, relation: "interested" }, { onConflict: "property_id,client_id", ignoreDuplicates: true })
      .then(({ error: e }) => e && console.error("viewing relation failed", e.code)),
    supabase
      .from("property_client_matches")
      .upsert({ organization_id: org, property_id: input.propertyId, client_id: clientId, status: "task_created" }, { onConflict: "property_id,client_id" })
      .then(({ error: e }) => e && console.error("viewing match mark failed", e.code)),
    input.emailId && UUID.test(input.emailId)
      ? supabase
          .from("emails")
          .update({ client_id: clientId })
          .eq("id", input.emailId)
          .eq("user_id", user.id)
          .is("client_id", null)
          .then(({ error: e }) => e && console.error("viewing email link failed", e.code))
      : null,
  ]);

  const calendar = input.addToCalendar ? await pushToCalendar(user, row as Row, input.inviteClient) : "skipped";
  return { ok: true, viewingId: (row as Row).id, clientId, startsAt, calendar };
}

export type MoveInput = { start: string; durationMinutes: number; location: string | null; notes: string | null };

/** New time or details; the calendar event follows when it is in the user's calendar. */
export async function updateViewing(user: CurrentUser, id: string, input: MoveInput, now: Date): Promise<{ ok: true; calendar: CalendarOutcome } | { ok: false; error: string }> {
  const row = await getRow(user, id);
  if (!row || row.status !== "scheduled") return { ok: false, error: "Ez a megtekintés már nem módosítható." };
  const startsAt = zonedLocalToUtc(input.start);
  if (!startsAt) return { ok: false, error: "Adj meg érvényes dátumot és időpontot." };
  if (startsAt !== row.starts_at && new Date(startsAt).getTime() < now.getTime() - 3600_000) return { ok: false, error: "Az időpont a múltban van." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("viewings")
    .update({ starts_at: startsAt, duration_minutes: input.durationMinutes, location: input.location, notes: input.notes })
    .eq("id", id)
    .eq("organization_id", user.organization.id);
  if (error) return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };

  if (!row.calendar_event_id || row.calendar_user_id !== user.id) return { ok: true, calendar: "skipped" };
  const access = await calendarAccess(user);
  if ("reason" in access) return { ok: true, calendar: access.reason };
  try {
    await moveEvent(access.token, row.calendar_event_id, { startsAt, endsAt: endOf(startsAt, input.durationMinutes), location: input.location });
    return { ok: true, calendar: "updated" };
  } catch (e) {
    return { ok: true, calendar: await calendarFailure(user, e) };
  }
}

export async function cancelViewing(user: CurrentUser, id: string): Promise<{ ok: true; calendar: CalendarOutcome } | { ok: false; error: string }> {
  const row = await getRow(user, id);
  if (!row || row.status !== "scheduled") return { ok: false, error: "Ez a megtekintés már nem mondható le." };
  const supabase = await createClient();
  const { error } = await supabase.from("viewings").update({ status: "cancelled" }).eq("id", id).eq("organization_id", user.organization.id);
  if (error) return { ok: false, error: "A lemondás nem sikerült. Próbáld újra." };
  if (!row.calendar_event_id || row.calendar_user_id !== user.id) return { ok: true, calendar: "skipped" };
  const access = await calendarAccess(user);
  if ("reason" in access) return { ok: true, calendar: access.reason };
  try {
    await cancelEvent(access.token, row.calendar_event_id);
    return { ok: true, calendar: "updated" };
  } catch (e) {
    return { ok: true, calendar: await calendarFailure(user, e) };
  }
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export type FeedbackResult = { ok: true; task: string | null } | { ok: false; error: string };

/**
 * Closes a viewing with the client's reaction: a "Megtekintés" entry on the
 * client's timeline, the client–listing relation, and the follow-up task.
 * A clear "no" also stops suggesting the listing to the client.
 */
export async function saveFeedback(user: CurrentUser, id: string, input: { outcome: Outcome; feedback: string | null }, now: Date): Promise<FeedbackResult> {
  const row = await getRow(user, id);
  if (!row || row.status !== "scheduled") return { ok: false, error: "Ehhez a megtekintéshez már van visszajelzés." };
  const [v] = await hydrate(user, [row]);
  const supabase = await createClient();
  const org = user.organization.id;
  const noShow = input.outcome === "no_show";
  const label = outcomeLabels[input.outcome];

  let interactionId: string;
  try {
    interactionId = await insertInteraction(user, {
      client_id: v.client.id,
      property_id: v.property.id,
      interaction_type: "viewing",
      occurred_at: row.starts_at,
      summary: (noShow ? `Nem jelent meg a megtekintésen: ${v.property.name}` : `Megtekintés: ${v.property.name} – ${label}`).slice(0, 1000),
      notes: input.feedback,
      outcome: label,
      follow_up_required: input.outcome !== "none" && input.outcome !== "low",
      source: "manual",
    });
  } catch (error) {
    return { ok: false, error: error instanceof SaveError ? error.userMessage : "A mentés nem sikerült. Próbáld újra." };
  }

  const { error } = await supabase
    .from("viewings")
    .update({
      status: noShow ? "no_show" : "completed",
      interest: noShow ? null : input.outcome,
      feedback: input.feedback,
      feedback_at: now.toISOString(),
      interaction_id: interactionId,
    })
    .eq("id", id)
    .eq("organization_id", org);
  if (error) {
    console.error("viewing feedback save failed", error.code);
    return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };
  }

  const relation = relationFor(input.outcome);
  const followUp = followUpFor(input.outcome, { client: v.client.name, property: v.property.name }, now);
  await Promise.all([
    relation &&
      supabase
        .from("property_clients")
        .upsert({ organization_id: org, property_id: v.property.id, client_id: v.client.id, relation, notes: input.feedback?.slice(0, 2000) ?? null }, { onConflict: "property_id,client_id" })
        .then(({ error: e }) => e && console.error("viewing relation failed", e.code)),
    relation === "rejected" &&
      supabase
        .from("property_client_matches")
        .upsert({ organization_id: org, property_id: v.property.id, client_id: v.client.id, status: "dismissed" }, { onConflict: "property_id,client_id" })
        .then(({ error: e }) => e && console.error("viewing match dismiss failed", e.code)),
    followUp &&
      insertTasks(user, [
        {
          title: followUp.title,
          due_at: followUp.dueAt,
          priority: input.outcome === "high" ? "high" : "normal",
          client_id: v.client.id,
          property_id: v.property.id,
          interaction_id: interactionId,
          source: "manual",
        },
      ]).catch((e) => console.error("viewing follow-up failed", e instanceof Error ? e.message : e)),
    touchClient(user, v.client.id, noShow ? now.toISOString() : row.starts_at).catch(() => undefined),
  ]);
  return { ok: true, task: followUp?.title ?? null };
}

/** For a reply: the booked time in words, e.g. "2026. nov. 3. 17:00". */
export const viewingTimeText = (startsAt: string) => formatDateTime(startsAt);
