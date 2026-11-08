import { zonedLocalToUtc } from "@/lib/i18n/timezone";

// The free viewing times on an agent's booking page: every slot on the grid
// of their days and hours (Budapest time), at least the notice ahead, within
// the window, and clear of their other viewings. The booking function checks
// the chosen one again. Pure, so it is tested.

export type BookingSettings = { days: number[]; startMinute: number; endMinute: number; slotMinutes: number; noticeHours: number; horizonDays: number };
export type Busy = { start: string; minutes: number };
export type SlotDay = { date: string; slots: { start: string; label: string }[] };

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

export function freeSlots(s: BookingSettings, busy: Busy[], now: Date): SlotDay[] {
  const earliest = now.getTime() + s.noticeHours * 3600_000;
  const latest = now.getTime() + s.horizonDays * 86_400_000;
  const taken = busy.map((b) => [Date.parse(b.start), Date.parse(b.start) + b.minutes * 60_000] as const);
  // Budapest's calendar day today; the window's days from there.
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(now);
  const out: SlotDay[] = [];
  for (let i = 0; i <= s.horizonDays; i++) {
    const date = new Date(Date.parse(`${today}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    if (!s.days.includes(isoDay(date))) continue;
    const slots: SlotDay["slots"] = [];
    for (let m = s.startMinute; m + s.slotMinutes <= s.endMinute; m += s.slotMinutes) {
      const label = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      const iso = zonedLocalToUtc(`${date}T${label}`);
      if (!iso) continue;
      const start = Date.parse(iso);
      const end = start + s.slotMinutes * 60_000;
      if (start < earliest || start > latest) continue;
      if (taken.some(([a, b]) => a < end && b > start)) continue;
      slots.push({ start: iso, label });
    }
    if (slots.length) out.push({ date, slots });
  }
  return out;
}
