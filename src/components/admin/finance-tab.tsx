import { Check, ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkline, TrendChart } from "@/components/admin/charts";
import { ExpenseForm, ExpenseList } from "@/components/admin/expenses";
import { cn } from "@/lib/cn";
import {
  addDays,
  budapestDay,
  byMonth,
  EXPENSE_CATEGORIES,
  expenseOn,
  lastMonths,
  monthlyRecurring,
  PERIODS,
  percentChange,
  rangeOf,
  runningMonthly,
  seriesOf,
  type Expense,
  type ExpenseCategory,
  type Income,
} from "@/lib/finance";
import { formatNumber, formatPrice } from "@/lib/i18n/format";

const MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
const SHORT = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];
const monthName = (m: string) => `${m.slice(0, 4)}. ${MONTHS[Number(m.slice(5, 7)) - 1]}`;
/** "nov. 14." for a day, "nov." for a month ("nov. 25" when it is another year than `year`). */
const dayLabel = (d: string, bucket: "day" | "month", year: string) =>
  bucket === "month" ? `${SHORT[Number(d.slice(5, 7)) - 1]}${d.slice(0, 4) === year ? "" : ` ${d.slice(2, 4)}`}` : `${SHORT[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}.`;
const signed = (v: number) => (v < 0 ? `−${formatPrice(-v)}` : formatPrice(v));

export type FinanceUser = { createdAt: string; lastSeenAt: string | null; confirmed: boolean };
export type FinanceWorkspace = { status: string; seats: number | null; interval: string | null; cancelAtPeriodEnd: boolean };

/** "↗ 12%" against the period before; for costs a rise is the bad direction. Arrow and sign, never color alone. */
function Change({ now, before, costs = false }: { now: number; before: number; costs?: boolean }) {
  const p = percentChange(now, before);
  if (p == null) return <span className="text-xs text-subtle">nincs előző adat</span>;
  if (p === 0) return <span className="text-xs text-muted">0%</span>;
  const up = p > 0;
  const good = costs ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", good ? "text-success" : "text-danger")}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : "−"}
      {Math.abs(p)}%
    </span>
  );
}

function Metric({ label, value, change, spark, note }: { label: string; value: string; change?: ReactNode; spark?: number[]; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-background p-4">
      <p className="w-fit text-xs text-muted underline decoration-dotted underline-offset-4">{label}</p>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-xl font-medium tracking-[-0.02em] text-ink tabular-nums">{value}</span>
        {change}
      </p>
      {spark ? <Sparkline values={spark} className="mt-1" /> : note ? <p className="mt-1 text-xs text-subtle">{note}</p> : null}
    </div>
  );
}

function Section({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-background p-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * The admin's Pénzügyek tab, laid out like a shop's analytics: a period at
 * the top that everything below follows, compared with the one before; the
 * key numbers with their trend; income over time; where it went; who uses
 * Flavio; then the monthly table and the expenses.
 */
export function FinanceTab({
  income,
  expenses,
  workspaces,
  users,
  price,
  today,
  period,
}: {
  income: Income[];
  expenses: Expense[];
  workspaces: FinanceWorkspace[];
  users: FinanceUser[];
  price: { month: number; year: number } | null;
  /** "YYYY-MM-DD", Budapest. */
  today: string;
  period: string;
}) {
  const r = rangeOf(period, today);
  const data = {
    income: income.map((p) => ({ amount: p.amount, day: budapestDay(p.paidAt) })),
    expenses,
    userDays: users.map((u) => budapestDay(u.createdAt)),
  };
  const cur = seriesOf(r.from, r.to, r.bucket, data);
  const prev = seriesOf(r.prevFrom, r.prevTo, r.bucket, data);
  const sum = (s: typeof cur, k: "income" | "expenses" | "payments" | "newUsers") => s.reduce((t, p) => t + p[k], 0);
  const now = { income: sum(cur, "income"), expenses: sum(cur, "expenses"), payments: sum(cur, "payments"), users: sum(cur, "newUsers") };
  const before = { income: sum(prev, "income"), expenses: sum(prev, "expenses"), payments: sum(prev, "payments"), users: sum(prev, "newUsers") };
  const avg = (s: { income: number; payments: number }) => (s.payments ? Math.round(s.income / s.payments) : 0);

  const mrr = price ? monthlyRecurring(workspaces, price) : 0;
  const count = (s: string) => workspaces.filter((w) => w.status === s).length;
  const paying = workspaces.filter((w) => w.status === "active" || w.status === "past_due");
  const seats = paying.reduce((s, w) => s + (w.seats ?? 1), 0);
  const monthAgo = Date.parse(`${addDays(today, -30)}T00:00:00Z`);
  const active30 = users.filter((u) => u.lastSeenAt && Date.parse(u.lastSeenAt) > monthAgo).length;

  // Where the money went in the period, by category.
  const byCategory = new Map<ExpenseCategory, number>();
  for (let d = r.from; d < r.to; d = addDays(d, 1)) for (const e of expenses) {
    const v = expenseOn(e, d);
    if (v) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + v);
  }
  const categories = [...byCategory].map(([category, amount]) => ({ category, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount);

  const points = cur.map((p, i) => ({
    label: dayLabel(p.start, r.bucket, today.slice(0, 4)),
    value: p.income,
    prevLabel: prev[i] ? dayLabel(prev[i].start, r.bucket, today.slice(0, 4)) : "",
    prev: prev[i]?.income ?? 0,
  }));
  const fmtRange = (from: string, to: string) => `${from.slice(0, 4) === today.slice(0, 4) ? "" : `${from.slice(0, 4)}. `}${dayLabel(from, "day", "")} – ${dayLabel(addDays(to, -1), "day", "")}`;
  const monthly = byMonth(lastMonths(today, 12), income, expenses);

  return (
    // White cards on a light gray ground, like a shop's analytics.
    <div className="-mx-4 flex flex-col gap-5 bg-surface px-4 py-5 sm:mx-0 sm:rounded-3xl sm:p-5">
      {/* The period: everything below follows it. */}
      <div className="flex flex-wrap items-center gap-3">
        <details className="relative">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-border-strong bg-background px-4 text-sm font-medium text-ink hover:bg-surface [&::-webkit-details-marker]:hidden">
            {r.label}
            <ChevronDown className="size-4 text-muted" />
          </summary>
          <div className="absolute left-0 z-20 mt-2 flex w-56 flex-col rounded-2xl border border-border bg-background p-1.5 shadow-float">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin?tab=penzugyek&idoszak=${p.key}`}
                scroll={false}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                {p.label}
                {p.key === r.key && <Check className="size-4" strokeWidth={2.5} />}
              </Link>
            ))}
          </div>
        </details>
        <p className="text-sm text-muted">
          {fmtRange(r.from, r.to)} · összehasonlítva: {fmtRange(r.prevFrom, r.prevTo)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Bevétel" value={formatPrice(now.income)} change={<Change now={now.income} before={before.income} />} spark={cur.map((p) => p.income)} />
        <Metric label="Kiadás" value={formatPrice(now.expenses)} change={<Change now={now.expenses} before={before.expenses} costs />} spark={cur.map((p) => p.expenses)} />
        <Metric
          label="Eredmény"
          value={signed(now.income - now.expenses)}
          change={<Change now={now.income - now.expenses} before={before.income - before.expenses} />}
          spark={cur.map((p) => p.income - p.expenses)}
        />
        <Metric label="Fizetések" value={formatNumber(now.payments)} change={<Change now={now.payments} before={before.payments} />} spark={cur.map((p) => p.payments)} />
        <Metric label="Átlagos fizetés" value={formatPrice(avg(now))} change={<Change now={avg(now)} before={avg(before)} />} note="bevétel / fizetések száma" />
        <Metric label="Havi ismétlődő bevétel" value={formatPrice(mrr)} note={`becslés · évente ${formatPrice(mrr * 12)} · havi fix költség ${formatPrice(runningMonthly(expenses, today))}`} />
        <Metric label="Új felhasználók" value={formatNumber(now.users)} change={<Change now={now.users} before={before.users} />} spark={cur.map((p) => p.newUsers)} />
        <Metric label="Aktív felhasználók" value={formatNumber(active30)} note={`az elmúlt 30 napban · ${formatNumber(users.length)} összesen`} />
      </div>

      <Section
        title="Bevétel az idő múlásával"
        aside={
          <p className="flex items-baseline gap-2">
            <span className="text-lg font-medium text-ink tabular-nums">{formatPrice(now.income)}</span>
            <Change now={now.income} before={before.income} />
          </p>
        }
      >
        <TrendChart points={points} currentLabel={r.label} previousLabel="Előző időszak" />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Bevétel és kiadás bontása">
          <dl className="flex flex-col text-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5">
              <dt className="text-ink">Bevétel (Stripe)</dt>
              <dd className="flex items-baseline gap-2 tabular-nums">
                <Change now={now.income} before={before.income} /> <span className="text-ink">{formatPrice(now.income)}</span>
              </dd>
            </div>
            {categories.map((c) => (
              <div key={c.category} className="flex items-baseline justify-between gap-3 border-b border-border py-2 pl-4">
                <dt className="text-muted">{EXPENSE_CATEGORIES[c.category]}</dt>
                <dd className="text-muted tabular-nums">−{formatPrice(c.amount)}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5">
              <dt className="text-ink">Kiadás összesen</dt>
              <dd className="flex items-baseline gap-2 tabular-nums">
                <Change now={now.expenses} before={before.expenses} costs /> <span className="text-ink">−{formatPrice(now.expenses)}</span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 pt-3">
              <dt className="font-medium text-ink">Eredmény</dt>
              <dd className={cn("font-medium tabular-nums", now.income - now.expenses < 0 ? "text-danger" : "text-ink")}>{signed(now.income - now.expenses)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted">A havi fix költségek napokra osztva számítanak, így a rövid időszakok is arányosak.</p>
        </Section>

        <Section title="Felhasználók és munkaterületek">
          <dl className="grid grid-cols-2 gap-x-6 text-sm">
            {[
              ["Összes felhasználó", users.length],
              ["Megerősített e-mail", users.filter((u) => u.confirmed).length],
              ["Aktív (30 nap)", active30],
              ["Új az időszakban", now.users],
              ["Fizető munkaterület", paying.length],
              ["Fizetett hely", seats],
              ["Elmaradt fizetés", count("past_due")],
              ["Próbaidő", count("trialing")],
              ["Pilot (ingyenes)", count("pilot")],
              ["Lemondva", count("canceled")],
              ["Nincs hozzáférés", count("none")],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium text-ink tabular-nums">{formatNumber(value as number)}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      <Section title="Hónapról hónapra" aside={<span className="text-xs text-muted">az elmúlt 12 hónap, táblázatban</span>}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Hónap</th>
                <th className="px-2 py-2 text-right font-medium">Bevétel</th>
                <th className="px-2 py-2 text-right font-medium">Kiadás</th>
                <th className="px-5 py-2 text-right font-medium">Eredmény</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {[...monthly].reverse().map((m) => (
                <tr key={m.month}>
                  <td className="px-5 py-2.5 text-ink">{monthName(m.month)}</td>
                  <td className="px-2 py-2.5 text-right">{formatPrice(m.income)}</td>
                  <td className="px-2 py-2.5 text-right text-muted">{formatPrice(m.expenses)}</td>
                  <td className={cn("px-5 py-2.5 text-right font-medium", m.result < 0 ? "text-danger" : "text-ink")}>{signed(m.result)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Kiadások">
        <p className="-mt-2 text-sm text-muted">
          Az üzlet saját költségei. A havonta ismétlődőt (pl. Vercel, Supabase) egyszer rögzítsd: minden hónapban beszámít, amíg le nem állítod. A Stripe díjait a havi kimutatásából írd be.
        </p>
        <ExpenseForm today={today} />
        <ExpenseList expenses={expenses} today={today} />
      </Section>
    </div>
  );
}
