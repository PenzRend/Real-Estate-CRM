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
