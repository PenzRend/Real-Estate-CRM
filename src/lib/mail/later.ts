import { zonedLocalToUtc } from "@/lib/i18n/timezone";

// "Később válaszolok": when to be reminded, in Budapest time. Pure, so it is tested.

export type LaterChoice = { key: string; label: string; at: string };

const local = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d).replace(" ", "T");

export function laterChoices(now: Date): LaterChoice[] {
  const [today, time] = local(now).split("T");
  const plusDays = (n: number) => new Date(Date.parse(`${today}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const toMonday = ((8 - weekday) % 7) || 7;
  const out: LaterChoice[] = [{ key: "hour", label: "1 óra múlva", at: new Date(now.getTime() + 3600_000).toISOString() }];
  if (time < "16:30") out.push({ key: "evening", label: "Ma 17:00", at: zonedLocalToUtc(`${today}T17:00`)! });
  out.push({ key: "tomorrow", label: "Holnap 9:00", at: zonedLocalToUtc(`${plusDays(1)}T09:00`)! });
  if (toMonday > 1) out.push({ key: "monday", label: "Hétfő 9:00", at: zonedLocalToUtc(`${plusDays(toMonday)}T09:00`)! });
  return out;
}
