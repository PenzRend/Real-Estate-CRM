import "server-only";
import { randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth";
import { pushToUser } from "@/lib/push/server";
import { createClient } from "@/lib/supabase/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import type { BookingSettings, Busy } from "./slots";

// The agent's booking link (settings, on/off) and the public page's two calls,
// made as an anonymous visitor through booking_page() and book_viewing_public().

export type BookingLink = BookingSettings & { token: string; active: boolean };
export const DEFAULT_BOOKING: BookingSettings = { days: [1, 2, 3, 4, 5], startMinute: 9 * 60, endMinute: 18 * 60, slotMinutes: 45, noticeHours: 12, horizonDays: 14 };
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

type Row = { token: string; active: boolean; days: number[]; start_minute: number; end_minute: number; slot_minutes: number; notice_hours: number; horizon_days: number };
const fromRow = (r: Row): BookingLink => ({
  token: r.token,
  active: r.active,
  days: r.days,
  startMinute: r.start_minute,
  endMinute: r.end_minute,
  slotMinutes: r.slot_minutes,
  noticeHours: r.notice_hours,
  horizonDays: r.horizon_days,
});

export async function myBookingLink(user: CurrentUser): Promise<BookingLink | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_links")
    .select("token, active, days, start_minute, end_minute, slot_minutes, notice_hours, horizon_days")
    .eq("organization_id", user.organization.id)
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? fromRow(data as Row) : null;
}

/** Switches the link on (made the first time with the defaults) or off, and saves the hours. */
export async function saveBookingLink(user: CurrentUser, input: BookingSettings & { active: boolean }): Promise<{ ok: true; link: BookingLink } | { ok: false; error: string }> {
  const days = [...new Set(input.days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
  if (!days.length) return { ok: false, error: "Válassz legalább egy napot." };
  if (!(input.endMinute > input.startMinute + 15)) return { ok: false, error: "A záró időpont legyen a kezdés után." };
  const row = {
    active: Boolean(input.active),
    days,
    start_minute: Math.max(0, Math.min(1425, Math.round(input.startMinute))),
    end_minute: Math.max(15, Math.min(1440, Math.round(input.endMinute))),
    slot_minutes: Math.max(15, Math.min(180, Math.round(input.slotMinutes))),
    notice_hours: Math.max(0, Math.min(168, Math.round(input.noticeHours))),
    horizon_days: Math.max(1, Math.min(60, Math.round(input.horizonDays))),
  };
  const supabase = await createClient();
  const existing = await myBookingLink(user);
  const q = existing
    ? supabase.from("booking_links").update(row).eq("organization_id", user.organization.id).eq("user_id", user.id)
    : supabase.from("booking_links").insert({ ...row, organization_id: user.organization.id, user_id: user.id, token: randomBytes(18).toString("base64url") });
  const { data, error } = await q.select("token, active, days, start_minute, end_minute, slot_minutes, notice_hours, horizon_days").single();
  if (error || !data) return { ok: false, error: "A foglalási linket nem sikerült menteni." };
  return { ok: true, link: fromRow(data as Row) };
}

/** A new address; the old one stops working. */
export async function renewBookingToken(user: CurrentUser) {
  const supabase = await createClient();
  await supabase.from("booking_links").update({ token: randomBytes(18).toString("base64url") }).eq("organization_id", user.organization.id).eq("user_id", user.id);
}

// --- The public page (no session) ---

const anon = () => createSupabaseClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });

export type BookingListing = { id: string; title: string; place: string; price: number | null; currency: string; rent: boolean };
export type BookingPage = BookingSettings & { agent: string; agency: string; listings: BookingListing[]; busy: Busy[] };

export async function bookingPage(token: string): Promise<BookingPage | null> {
  if (!TOKEN.test(token)) return null;
  const { data, error } = await anon().rpc("booking_page", { p_token: token });
  if (error || !data) return null;
  const r = data as {
    agent: string;
    agency: string;
    days: number[];
    start_minute: number;
    end_minute: number;
    slot_minutes: number;
    notice_hours: number;
    horizon_days: number;
    listings: { id: string; title: string; city: string | null; district: string | null; price: number | null; currency: string; listing_type: string }[];
    busy: Busy[];
  };
  return {
    agent: r.agent,
    agency: r.agency,
    days: r.days,
    startMinute: r.start_minute,
    endMinute: r.end_minute,
    slotMinutes: r.slot_minutes,
    noticeHours: r.notice_hours,
    horizonDays: r.horizon_days,
    busy: r.busy,
    listings: r.listings.map((l) => ({
      id: l.id,
      title: l.title,
      place: [l.city, l.district].filter(Boolean).join(", "),
      price: l.price == null ? null : Number(l.price),
      currency: l.currency,
      rent: l.listing_type === "rent",
    })),
  };
}

export async function bookPublic(
  token: string,
  input: { propertyId: string; start: string; name: string; phone: string; email: string; note: string },
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  if (!TOKEN.test(token)) return { ok: false, error: "Ez a foglalási link már nem él." };
  const { data, error } = await anon().rpc("book_viewing_public", {
    p_token: token,
    p_property: input.propertyId,
    p_start: input.start,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_note: input.note,
  });
  if (error || !data) {
    console.error("book_viewing_public failed", error?.code);
    return { ok: false, error: "A foglalás most nem sikerült. Próbáld újra, vagy hívd az ingatlanost." };
  }
  const r = data as { ok: boolean; error?: string; agent_id?: string; title?: string };
  if (!r.ok) return { ok: false, error: r.error ?? "A foglalás nem sikerült." };
  // The agent hears about it on their phone (where notifications are on).
  if (r.agent_id) {
    const when = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" }).format(new Date(input.start));
    await pushToUser(r.agent_id, { title: "Új online foglalás", body: `${input.name.trim()} – ${r.title}, ${when}`, url: "/calendar" }).catch(() => 0);
  }
  return { ok: true, title: r.title ?? "" };
}
