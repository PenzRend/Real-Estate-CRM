import { Card, Kpi } from "@/components/admin/dashboard";
import { ExpenseForm, ExpenseList } from "@/components/admin/expenses";
import { cn } from "@/lib/cn";
import { byMonth, categoriesThisYear, EXPENSE_CATEGORIES, lastMonths, monthlyRecurring, runningMonthly, type Expense, type Income } from "@/lib/finance";
import { formatNumber, formatPrice } from "@/lib/i18n/format";

const MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
const monthName = (m: string) => `${m.slice(0, 4)}. ${MONTHS[Number(m.slice(5, 7)) - 1]}`;
const signed = (v: number) => (v < 0 ? `−${formatPrice(-v)}` : formatPrice(v));

export type FinanceUsers = { total: number; confirmed: number; active30: number; newThisMonth: number };
export type FinanceWorkspace = { status: string; seats: number | null; interval: string | null; cancelAtPeriodEnd: boolean };

/**
 * The admin's Pénzügyek tab: what came in (Stripe payments), what went out
 * (expenses entered here), the result month by month, the recurring revenue
 * the paying workspaces bring, and how many people use Flavio.
 */
export function FinanceTab({
  income,
  expenses,
  workspaces,
  users,
  price,
  today,
}: {
  income: Income[];
  expenses: Expense[];
  workspaces: FinanceWorkspace[];
  users: FinanceUsers;
  price: { month: number; year: number } | null;
  /** "YYYY-MM-DD", Budapest. */
  today: string;
}) {
  const months = lastMonths(today, 12);
  const rows = byMonth(months, income, expenses);
  const [now, before] = [rows[11], rows[10]];
  const year = byMonth(lastMonths(today, Number(today.slice(5, 7))), income, expenses);
  const yearIncome = year.reduce((s, r) => s + r.income, 0);
  const yearExpenses = year.reduce((s, r) => s + r.expenses, 0);
  const allIncome = income.reduce((s, p) => s + p.amount, 0);
  const mrr = price ? monthlyRecurring(workspaces, price) : 0;
  const fixed = runningMonthly(expenses, today);
  const count = (s: string) => workspaces.filter((w) => w.status === s).length;
  const paying = workspaces.filter((w) => w.status === "active" || w.status === "past_due");
  const seats = paying.reduce((s, w) => s + (w.seats ?? 1), 0);
  const categories = categoriesThisYear(expenses, today);
  const most = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expenses)));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Bevétel ebben a hónapban" value={formatPrice(now.income)} sub={`${now.payments} fizetés · előző hónap ${formatPrice(before.income)}`} />
        <Kpi label="Kiadás ebben a hónapban" value={formatPrice(now.expenses)} sub={`ebből havi fix ${formatPrice(fixed)}`} />
        <Kpi label="Eredmény ebben a hónapban" value={signed(now.result)} tone={now.result < 0 ? "danger" : undefined} sub={`előző hónap ${signed(before.result)}`} />
        <Kpi label={`Idei eredmény (${today.slice(0, 4)})`} value={signed(yearIncome - yearExpenses)} tone={yearIncome - yearExpenses < 0 ? "danger" : undefined} sub={`${formatPrice(yearIncome)} bevétel · ${formatPrice(yearExpenses)} kiadás`} />
        <Kpi label="Havi ismétlődő bevétel" value={formatPrice(mrr)} sub={`becslés · évente ${formatPrice(mrr * 12)}`} />
        <Kpi label="Fizető munkaterület" value={formatNumber(paying.length)} sub={`${formatNumber(seats)} hely${count("past_due") ? ` · ${count("past_due")} elmaradt fizetés` : ""}`} tone={count("past_due") ? "warning" : undefined} />
        <Kpi label="Felhasználók" value={formatNumber(users.total)} sub={`${formatNumber(users.active30)} aktív az elmúlt 30 napban · ${formatNumber(users.newThisMonth)} új ebben a hónapban`} />
        <Kpi label="Összes bevétel eddig" value={formatPrice(allIncome)} sub={`${formatNumber(income.length)} fizetés`} />
      </div>

      <Card title="Hónapról hónapra" description="Az elmúlt 12 hónap. A bevétel a Stripe-fizetések összege, a kiadás az alább rögzített költségeké (a havi fixek minden hónapban számítanak).">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Hónap</th>
                <th className="px-2 py-2 text-right font-medium">Bevétel</th>
                <th className="px-2 py-2 text-right font-medium">Kiadás</th>
                <th className="px-2 py-2 text-right font-medium">Eredmény</th>
                <th className="w-40 px-5 py-2 font-medium" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {[...rows].reverse().map((r) => (
                <tr key={r.month}>
                  <td className="px-5 py-2.5 text-ink">{monthName(r.month)}</td>
                  <td className="px-2 py-2.5 text-right">{formatPrice(r.income)}</td>
                  <td className="px-2 py-2.5 text-right text-muted">{formatPrice(r.expenses)}</td>
                  <td className={cn("px-2 py-2.5 text-right font-medium", r.result < 0 ? "text-danger" : "text-ink")}>{signed(r.result)}</td>
                  <td className="px-5 py-2.5" aria-hidden>
                    <span className="flex flex-col gap-0.5">
                      <span className="h-1.5 rounded-full bg-ink" style={{ width: `${(r.income / most) * 100}%` }} />
                      <span className="h-1.5 rounded-full bg-border-strong" style={{ width: `${(r.expenses / most) * 100}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-ink" /> Bevétel
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-border-strong" /> Kiadás
          </span>
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Felhasználók és munkaterületek">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ["Összes felhasználó", users.total],
              ["Megerősített e-mail", users.confirmed],
              ["Aktív (30 nap)", users.active30],
              ["Új ebben a hónapban", users.newThisMonth],
              ["Előfizető", count("active")],
              ["Elmaradt fizetés", count("past_due")],
              ["Próbaidő", count("trialing")],
              ["Pilot (ingyenes)", count("pilot")],
              ["Lemondva", count("canceled")],
              ["Nincs hozzáférés", count("none")],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium text-ink tabular-nums">{formatNumber(value as number)}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title={`Kiadások kategóriánként (${today.slice(0, 4)})`}>
          {categories.length ? (
            <ul className="flex flex-col gap-2.5 text-sm">
              {categories.map((c) => (
                <li key={c.category} className="flex flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-ink">{EXPENSE_CATEGORIES[c.category]}</span>
                    <span className="text-muted tabular-nums">{formatPrice(c.amount)}</span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${(c.amount / categories[0].amount) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Még nincs idei kiadás rögzítve.</p>
          )}
        </Card>
      </div>

      <Card
        title="Kiadások"
        description="Az üzlet saját költségei. A havonta ismétlődőt (pl. Vercel, Supabase) egyszer rögzítsd: minden hónapban beszámít, amíg le nem állítod. A Stripe díjait a havi kimutatásából írd be."
      >
        <ExpenseForm today={today} />
        <ExpenseList expenses={expenses} today={today} />
      </Card>
    </div>
  );
}
