"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { clientContactFields } from "@/lib/validation/client";
import { prepareBooking, type BookingPrep } from "@/lib/viewings/booking";
import { addToCalendar, bookViewing, cancelViewing, saveFeedback, updateViewing, type BookingResult, type CalendarOutcome, type FeedbackResult } from "@/lib/viewings/data";
import { DURATIONS } from "@/lib/viewings/logic";

const id = z.uuid();
const optionalId = id.nullable().optional();
const text = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(max).nullable());
const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Adj meg dátumot és időpontot.");
const duration = z.coerce.number().int().refine((n) => (DURATIONS as readonly number[]).includes(n));

export async function prepareBookingAction(input: { clientId?: string | null; propertyId?: string | null; emailId?: string | null }): Promise<BookingPrep | null> {
  const parsed = z.object({ clientId: optionalId, propertyId: optionalId, emailId: optionalId }).safeParse(input);
  if (!parsed.success) return null;
  const user = await getCurrentUser();
  return prepareBooking(user, parsed.data, new Date());
}

const bookSchema = z.object({
  clientId: id.nullable(),
  newClient: z.object({ full_name: clientContactFields.full_name, email: clientContactFields.email, phone: clientContactFields.phone }).nullable(),
  propertyId: id,
  start: local,
  durationMinutes: duration,
  location: text(500),
  notes: text(2000),
  addToCalendar: z.boolean(),
  inviteClient: z.boolean(),
  emailId: id.nullable(),
});

export async function bookViewingAction(input: unknown): Promise<BookingResult> {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Hiányos adatok." };
  const user = await getCurrentUser();
  const r = await bookViewing(user, parsed.data, new Date());
  if (r.ok) refresh();
  return r;
}

const moveSchema = z.object({ start: local, durationMinutes: duration, location: text(500), notes: text(2000) });

export async function updateViewingAction(viewingId: string, input: unknown): Promise<{ ok: true; calendar: CalendarOutcome } | { ok: false; error: string }> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success || !id.safeParse(viewingId).success) return { ok: false, error: parsed.error?.issues[0]?.message ?? "Hiányos adatok." };
  const user = await getCurrentUser();
  const r = await updateViewing(user, viewingId, parsed.data, new Date());
  if (r.ok) refresh();
  return r;
}

export async function cancelViewingAction(viewingId: string) {
  if (!id.safeParse(viewingId).success) return { ok: false as const, error: "Ismeretlen megtekintés." };
  const user = await getCurrentUser();
  const r = await cancelViewing(user, viewingId);
  if (r.ok) refresh();
  return r;
}

export async function addToCalendarAction(viewingId: string, invite: boolean): Promise<CalendarOutcome> {
  if (!id.safeParse(viewingId).success) return "skipped";
  const user = await getCurrentUser();
  const r = await addToCalendar(user, viewingId, invite === true);
  if (r === "added") refresh();
  return r;
}

const feedbackSchema = z.object({ outcome: z.enum(["high", "medium", "low", "none", "no_show"]), feedback: text(5000) });

export async function saveFeedbackAction(viewingId: string, input: unknown): Promise<FeedbackResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success || !id.safeParse(viewingId).success) return { ok: false, error: "Válaszd ki, hogyan sikerült." };
  const user = await getCurrentUser();
  const r = await saveFeedback(user, viewingId, parsed.data, new Date());
  if (r.ok) refresh();
  return r;
}
