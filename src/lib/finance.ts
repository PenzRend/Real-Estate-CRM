// The admin's Pénzügyek page: income from Stripe payments, the business's own
// expenses, the result month by month, and the recurring revenue the paying
// workspaces bring. Pure, so it is tested; lib/admin.ts loads the rows.

export const EXPENSE_CATEGORIES = {
  hosting: "Tárhely (Vercel)",
  database: "Adatbázis (Supabase)",
  ai: "AI-szolgáltatók",
  email: "E-mail-küldés",
  domain: "Domain",
  payment_fees: "Fizetési díjak (Stripe)",
  accounting: "Könyvelés",
  marketing: "Marketing",
  tools: "Egyéb szoftverek",
  other: "Egyéb",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export type Expense = {
  id: string;
  /** "YYYY-MM-DD" */
  spentOn: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  /** Counted every month from spentOn's month, until endsOn's month if set. */
  monthly: boolean;
  endsOn: string | null;
};

export type Income = { amount: number; paidAt: string };

const month = (iso: string) => iso.slice(0, 7);

/** The `count` months ending with the one holding `today`, oldest first ("YYYY-MM"). */
export function lastMonths(today: string, count: number): string[] {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/** What an expense costs in a given month ("YYYY-MM"). */
export function expenseIn(e: Expense, m: string): number {
  const start = month(e.spentOn);
  if (!e.monthly) return start === m ? e.amount : 0;
  if (m < start) return 0;
  if (e.endsOn && m > month(e.endsOn)) return 0;
  return e.amount;
}

export type MonthRow = { month: string; income: number; expenses: number; result: number; payments: number };

/** Income, expenses and the result for each of the months given. */
export function byMonth(months: string[], income: Income[], expenses: Expense[]): MonthRow[] {
  return months.map((m) => {
    const paid = income.filter((p) => month(p.paidAt) === m);
    const inc = paid.reduce((s, p) => s + p.amount, 0);
    const exp = expenses.reduce((s, e) => s + expenseIn(e, m), 0);
    return { month: m, income: inc, expenses: exp, result: inc - exp, payments: paid.length };
  });
}

/** This year's expenses by category, largest first. */
export function categoriesThisYear(expenses: Expense[], today: string): { category: ExpenseCategory; amount: number }[] {
  const months = lastMonths(today, Number(today.slice(5, 7)));
  const totals = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    const sum = months.reduce((s, m) => s + expenseIn(e, m), 0);
    if (sum) totals.set(e.category, (totals.get(e.category) ?? 0) + sum);
  }
  return [...totals].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/** The monthly costs still running, for the "Havi fix költség" line. */
export function runningMonthly(expenses: Expense[], today: string): number {
  return expenses.reduce((s, e) => s + (e.monthly ? expenseIn(e, month(today)) : 0), 0);
}

export type PayingWorkspace = { status: string; seats: number | null; interval: string | null; cancelAtPeriodEnd: boolean };

/**
 * Recurring revenue a month, estimated: every paying workspace's seats at
 * today's price (a yearly one counted as a twelfth). Running subscriptions
 * may still be on an older price, and ones set to end are left out.
 */
export function monthlyRecurring(workspaces: PayingWorkspace[], price: { month: number; year: number }): number {
  return Math.round(
    workspaces
      .filter((w) => (w.status === "active" || w.status === "past_due") && !w.cancelAtPeriodEnd)
      .reduce((s, w) => s + (w.seats ?? 1) * (w.interval === "year" ? price.year / 12 : price.month), 0),
  );
}

// --- Periods, Shopify style: a range, the same length before it, and a point per day or month. ---

export const PERIODS = [
  { key: "7", label: "Elmúlt 7 nap", days: 7 },
  { key: "30", label: "Elmúlt 30 nap", days: 30 },
  { key: "90", label: "Elmúlt 90 nap", days: 90 },
  { key: "ev", label: "Idén", days: 0 },
  { key: "12h", label: "Elmúlt 12 hónap", days: 0 },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

export type Range = {
  key: PeriodKey;
  label: string;
  /** First day, "YYYY-MM-DD". */
  from: string;
  /** The day after the last one. */
  to: string;
  prevFrom: string;
  prevTo: string;
  bucket: "day" | "month";
};

const DAY = 86_400_000;
const utcDay = (d: string) => Date.parse(`${d}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => isoDay(utcDay(d) + n * DAY);
const firstOfMonth = (d: string, n = 0) => {
  const x = new Date(utcDay(d));
  return isoDay(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1));
};
const daysInMonth = (d: string) => (utcDay(firstOfMonth(d, 1)) - utcDay(firstOfMonth(d))) / DAY;

/** The chosen range ending today, and the one of the same length before it. */
export function rangeOf(key: string, today: string): Range {
  const p = PERIODS.find((x) => x.key === key) ?? PERIODS[1];
  const to = addDays(today, 1);
  if (p.key === "ev") {
    const from = `${today.slice(0, 4)}-01-01`;
    const prevFrom = `${Number(today.slice(0, 4)) - 1}-01-01`;
    // Last year up to the same day, so the two compare like for like.
    const prevTo = addDays(prevFrom, (utcDay(to) - utcDay(from)) / DAY);
    return { key: p.key, label: p.label, from, to, prevFrom, prevTo, bucket: "month" };
  }
  if (p.key === "12h") {
    const from = firstOfMonth(today, -11);
    return { key: p.key, label: p.label, from, to, prevFrom: firstOfMonth(today, -23), prevTo: from, bucket: "month" };
  }
  const from = addDays(to, -p.days);
  return { key: p.key, label: p.label, from, to, prevFrom: addDays(from, -p.days), prevTo: from, bucket: "day" };
}

/** A payment's day in Budapest ("YYYY-MM-DD"). */
export const budapestDay = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(new Date(iso));

/** What an expense costs on one day: a one-off on its day, a monthly one spread over its month's days. */
export function expenseOn(e: Expense, day: string): number {
  if (!e.monthly) return e.spentOn === day ? e.amount : 0;
  return expenseIn(e, day.slice(0, 7)) / daysInMonth(day);
}

/** The points of a range: one per day, or one per month for the long ranges. */
export function bucketsOf(from: string, to: string, bucket: "day" | "month"): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  for (let d = from; d < to; ) {
    const next = bucket === "day" ? addDays(d, 1) : firstOfMonth(d, 1) < to ? firstOfMonth(d, 1) : to;
    out.push({ start: d, end: next });
    d = next;
  }
  return out;
}

export type Point = { start: string; income: number; expenses: number; payments: number; newUsers: number };

/** Income, expenses, payments and new users per point between two days. */
export function seriesOf(
  from: string,
  to: string,
  bucket: "day" | "month",
  data: { income: { amount: number; day: string }[]; expenses: Expense[]; userDays: string[] },
): Point[] {
  return bucketsOf(from, to, bucket).map(({ start, end }) => {
    const paid = data.income.filter((p) => p.day >= start && p.day < end);
    let expenses = 0;
    for (let d = start; d < end; d = addDays(d, 1)) for (const e of data.expenses) expenses += expenseOn(e, d);
    return {
      start,
      income: paid.reduce((s, p) => s + p.amount, 0),
      expenses: Math.round(expenses),
      payments: paid.length,
      newUsers: data.userDays.filter((d) => d >= start && d < end).length,
    };
  });
}

/** The change against the period before, in percent; null when there was nothing to compare with. */
export function percentChange(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}
