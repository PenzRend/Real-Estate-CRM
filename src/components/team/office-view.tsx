import { CalendarDays, Crown, Handshake, Home, MessageSquare, TrendingUp, UserPlus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/i18n/format";
import { progressPercent, type AgentMonth, type AgentTarget } from "@/lib/team/stats";
import { UserAvatar } from "@/components/ui/user-avatar";
import { TargetEditor } from "./target-editor";

// The Iroda page: the month at a glance (a ring for commission, smaller rings
// for the other goals, a forecast at the current pace), then one card per
// agent. Server-rendered; only the target editor is interactive.

type Totals = Omit<AgentMonth, "userId" | "name" | "target"> & { target: AgentTarget };

/** How far through the month we are, 0–1; null for a month not yet started. Past months are 1. */
export type MonthProgress = { elapsed: number | null; daysLeft: number };

const tone = (p: number | null) => (p == null ? "neutral" : p >= 100 ? "success" : p >= 60 ? "accent" : "warning");
const strokes = { success: "stroke-success", accent: "stroke-accent", warning: "stroke-warning", neutral: "stroke-subtle" } as const;
const fills = { success: "bg-success", accent: "bg-accent", warning: "bg-warning", neutral: "bg-subtle" } as const;

function Ring({ percent, size = 132, width = 10, children }: { percent: number | null; size?: number; width?: number; children?: ReactNode }) {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.min(100, percent ?? 0);
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={width} className="stroke-surface-strong" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          className={cn("ring-progress", strokes[tone(percent)])}
          style={{ ["--ring-length" as string]: c }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

function Bar({ value, target }: { value: number; target: number | null }) {
  const p = progressPercent(value, target);
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
      {p != null && <span className={cn("bar-progress block h-full rounded-full", fills[tone(p)])} style={{ width: `${Math.min(100, p)}%` }} />}
    </span>
  );
}

/** At the current pace, where the month ends up (only while the month runs). */
function forecast(value: number, progress: MonthProgress) {
  if (progress.elapsed == null || progress.elapsed >= 1 || progress.elapsed < 0.1 || value <= 0) return null;
  return Math.round(value / progress.elapsed);
}

export function OfficeHero({ total, progress, manager }: { total: Totals; progress: MonthProgress; manager: boolean }) {
  const p = progressPercent(total.commission, total.target.commission);
  const pace = forecast(total.commission, progress);
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-border bg-gradient-to-br from-accent-soft/70 via-background to-background p-6 sm:flex-row sm:items-center sm:p-8">
      <Ring percent={p} size={148} width={12}>
        <span>
          <span className="block text-2xl font-medium tracking-tight text-ink tabular-nums">{p == null ? "–" : `${p}%`}</span>
          <span className="block text-xs text-muted">{p == null ? "nincs cél" : "a célból"}</span>
        </span>
      </Ring>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm text-muted">Az iroda jutaléka ebben a hónapban</p>
        <p className="text-4xl font-medium tracking-[-0.03em] text-ink tabular-nums sm:text-5xl">{formatPrice(total.commission)}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {total.target.commission != null && <span>Cél: {formatPrice(total.target.commission)}</span>}
          {total.pipeline > 0 && <span>Folyamatban: {formatPrice(total.pipeline)}</span>}
          {progress.elapsed != null && progress.elapsed < 1 && <span>Még {progress.daysLeft} nap a hónapból</span>}
        </p>
        {pace != null ? (
          <p className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-sm text-ink shadow-float">
            <TrendingUp className="size-4 text-accent" /> Ebben a tempóban a hónap végére kb. <span className="font-medium">{formatPrice(pace)}</span>
          </p>
        ) : (
          total.commission === 0 &&
          total.target.commission == null &&
          manager && <p className="mt-1 text-sm text-muted">Tipp: adj meg havi célokat a munkatársak kártyáján – így látszik, ki hol tart.</p>
        )}
      </div>
    </section>
  );
}

const goals = [
  { key: "deals", label: "Lezárt ügylet", icon: Handshake, value: (t: Totals) => t.dealsWon },
  { key: "listings", label: "Új megbízás", icon: Home, value: (t: Totals) => t.listings },
  { key: "viewings", label: "Megtekintés", icon: CalendarDays, value: (t: Totals) => t.viewings },
] as const;

export function OfficeGoals({ total }: { total: Totals }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {goals.map((g) => {
        const target = total.target[g.key];
        const value = g.value(total);
        const p = progressPercent(value, target);
        return (
          <div key={g.key} className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:gap-4">
            <Ring percent={p} size={56} width={6}>
              <g.icon className="size-4 text-muted" />
            </Ring>
            <div className="min-w-0">
              <p className="text-2xl font-medium tracking-tight text-ink tabular-nums">
                {value}
                {target != null && <span className="text-base font-normal text-muted"> / {target}</span>}
              </p>
              <p className="text-xs text-muted">{g.label}</p>
            </div>
          </div>
        );
      })}
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-surface">
          <UserPlus className="size-4 text-muted" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-medium tracking-tight text-ink tabular-nums">{total.leads}</p>
          <p className="text-xs text-muted">Új ügyfél</p>
        </div>
      </div>
    </div>
  );
}

const rows = [
  { key: "commission", label: "Jutalék", value: (a: AgentMonth) => a.commission, money: true },
  { key: "deals", label: "Lezárt ügylet", value: (a: AgentMonth) => a.dealsWon },
  { key: "listings", label: "Új megbízás", value: (a: AgentMonth) => a.listings },
  { key: "viewings", label: "Megtekintés", value: (a: AgentMonth) => a.viewings },
] as const;

export function AgentCard({
  agent,
  rank,
  leader,
  month,
  editable,
  me,
  avatarUrl,
}: {
  agent: AgentMonth;
  /** Null when there is no one to compare with. */
  rank: number | null;
  leader: boolean;
  month: string;
  editable: boolean;
  me: boolean;
  avatarUrl: string | null;
}) {
  return (
    <article className={cn("flex flex-col gap-5 rounded-3xl border bg-background p-5", leader ? "border-accent/40 shadow-float" : "border-border")}>
      <header className="flex items-center gap-3">
        <span className="relative shrink-0">
          <UserAvatar name={agent.name} url={avatarUrl} size="lg" />
          {leader && (
            <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-warning text-white ring-2 ring-background" title="A hónap vezetője">
              <Crown className="size-3" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">
            {agent.name}
            {me && <span className="font-normal text-muted"> (te)</span>}
          </p>
          <p className="text-xs text-muted">
            {rank != null && `${rank}. hely · `}
            {agent.leads} új ügyfél
            {agent.pipeline > 0 && ` · ${formatPrice(agent.pipeline)} folyamatban`}
          </p>
        </div>
        {!me && (
          <Link href={`/messages?with=${agent.userId}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label={`Üzenet ${agent.name} részére`} title="Üzenet">
            <MessageSquare className="size-4" />
          </Link>
        )}
      </header>

      <ul className="flex flex-col gap-3">
        {rows.map((r) => {
          const value = r.value(agent);
          const target = agent.target?.[r.key] ?? null;
          const shown = "money" in r ? formatPrice(value) : String(value);
          return (
            <li key={r.key} className="flex flex-col gap-1.5">
              <p className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted">{r.label}</span>
                <span className="font-medium text-ink tabular-nums">
                  {shown}
                  {target != null && <span className="font-normal text-muted"> / {"money" in r ? formatPrice(target) : target}</span>}
                </span>
              </p>
              <Bar value={value} target={target} />
            </li>
          );
        })}
      </ul>

      {editable && <TargetEditor userId={agent.userId} name={agent.name} month={month} target={agent.target} />}
    </article>
  );
}
