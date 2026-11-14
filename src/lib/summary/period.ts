// Daily, weekly and monthly summaries: which days a period covers, what it
// is called, and the line that says it in a notification. Pure, so it is
// tested; data.ts gathers the numbers.

export type PeriodKind = "day" | "week" | "month";
export const PERIOD_KINDS: PeriodKind[] = ["day", "week", "month"];

export type Period = {
  kind: PeriodKind;
  /** First day, "YYYY-MM-DD" (Budapest). */
  from: string;
  /** The day after the last one. */
  to: string;
  /** The same length before it, for the comparison. */
  previousFrom: string;
  /** The same length after it: what is coming up. */
  nextTo: string;
  label: string;
};

const MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
const WEEKDAYS = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => iso(new Date(utc(day).getTime() + n * 86_400_000));
const addMonths = (day: string, n: number) => {
  const d = utc(day);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
};
const dotted = (day: string) => {
  const d = utc(day);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}.`;
};

/**
 * The day, week (Monday to Sunday) or month that holds `today`, moved by
 * `offset` periods (−1: the one before).
 */
export function periodOf(kind: PeriodKind, today: string, offset = 0): Period {
  if (kind === "day") {
    const from = addDays(today, offset);
    const d = utc(from);
    const label = offset === 0 ? "Ma" : offset === -1 ? "Tegnap" : `${d.getUTCFullYear()}. ${dotted(from)}, ${WEEKDAYS[d.getUTCDay()]}`;
    return { kind, from, to: addDays(from, 1), previousFrom: addDays(from, -1), nextTo: addDays(from, 2), label };
  }
  if (kind === "week") {
    const weekday = (utc(today).getUTCDay() + 6) % 7; // Monday 0
    const from = addDays(today, -weekday + offset * 7);
    const to = addDays(from, 7);
    const label = offset === 0 ? "Ez a hét" : offset === -1 ? "Múlt hét" : `${dotted(from)} – ${dotted(addDays(to, -1))}`;
    return { kind, from, to, previousFrom: addDays(from, -7), nextTo: addDays(to, 7), label };
  }
  const from = addMonths(today.slice(0, 8) + "01", offset);
  const to = addMonths(from, 1);
  const d = utc(from);
  const name = MONTHS[d.getUTCMonth()];
  const label = offset === 0 ? `Ez a hónap (${name})` : `${d.getUTCFullYear()}. ${name}`;
  return { kind, from, to, previousFrom: addMonths(from, -1), nextTo: addMonths(to, 1), label };
}

export const periodNames: Record<PeriodKind, string> = { day: "Nap", week: "Hét", month: "Hónap" };

export type SummaryNumbers = {
  newClients: number;
  conversations: number;
  viewings: number;
  newListings: number;
  offers: number;
  dealsWon: number;
  commission: number;
  tasksDone: number;
};

const shortMoney = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")} M Ft` : `${Math.round(v / 1000)} E Ft`);

/** The numbers worth saying, in one line: "3 új ügyfél · 12 beszélgetés · 4 megtekintés". Empty ones are left out. */
export function summaryLine(n: SummaryNumbers): string {
  const parts = [
    n.newClients && `${n.newClients} új ügyfél`,
    n.conversations && `${n.conversations} beszélgetés`,
    n.viewings && `${n.viewings} megtekintés`,
    n.newListings && `${n.newListings} új megbízás`,
    n.offers && `${n.offers} új ügylet`,
    n.dealsWon && `${n.dealsWon} lezárt ügylet${n.commission ? ` (${shortMoney(n.commission)})` : ""}`,
    n.tasksDone && `${n.tasksDone} elvégzett teendő`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Ebben az időszakban még nincs rögzített munka.";
}

/** "↑ 2" / "↓ 1" / "" against the period before. */
export function change(now: number, before: number) {
  return now > before ? `↑ ${now - before}` : now < before ? `↓ ${before - now}` : "";
}
