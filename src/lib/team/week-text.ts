// The office's week in numbers, and the line that says it. Pure, so it is
// tested; week-summary.ts gathers the numbers.

export type WeekNumbers = { leads: number; viewings: number; listings: number; dealsWon: number; commission: number };

/** Monday of the week before `today` ("YYYY-MM-DD", local), and the Monday after it. */
export function lastWeek(today: string): { from: string; to: string; previousFrom: string } {
  const d = new Date(`${today}T00:00:00Z`);
  const weekday = (d.getUTCDay() + 6) % 7; // Monday 0
  const thisMonday = new Date(d.getTime() - weekday * 86_400_000);
  const day = (offset: number) => new Date(thisMonday.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  return { from: day(-7), to: day(0), previousFrom: day(-14) };
}

/** "↑ 2" / "↓ 1" / "" against the week before. */
export function trend(now: number, before: number) {
  return now > before ? `↑ ${now - before}` : now < before ? `↓ ${before - now}` : "";
}

const shortMoney = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")} M Ft` : `${Math.round(v / 1000)} E Ft`);

/** One line for a notification: "4 új ügyfél · 6 megtekintés · 1 lezárt ügylet (1,5 M Ft)". */
export function weekLine(w: WeekNumbers) {
  const parts = [`${w.leads} új ügyfél`, `${w.viewings} megtekintés`, `${w.listings} új megbízás`, `${w.dealsWon} lezárt ügylet${w.dealsWon && w.commission ? ` (${shortMoney(w.commission)})` : ""}`];
  return parts.join(" · ");
}
