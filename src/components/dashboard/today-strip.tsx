import { CalendarDays, CheckSquare, Handshake, Mail, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/i18n/format";

export type TodayCounts = {
  overdue: number;
  dueToday: number;
  viewings: number;
  viewingsWaiting: number;
  /** The next scheduled viewing, ISO. */
  nextViewing: string | null;
  /** Null when no mailbox is connected. */
  mailsWaiting: number | null;
  openDeals: number;
  pipeline: number;
};

type Tone = "danger" | "warning" | "accent" | "neutral";

const toneClasses: Record<Tone, { tile: string; icon: string; note: string }> = {
  danger: { tile: "border-danger/25 bg-danger-soft/60", icon: "bg-danger text-white", note: "text-danger" },
  warning: { tile: "border-warning/25 bg-warning-soft/60", icon: "bg-warning text-white", note: "text-warning" },
  accent: { tile: "border-accent/25 bg-accent-soft/60", icon: "bg-accent text-white", note: "text-accent" },
  neutral: { tile: "border-border bg-background", icon: "bg-surface text-muted", note: "text-muted" },
};

const nextAt = new Intl.DateTimeFormat("hu-HU", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });

function Tile({ href, icon: Icon, label, value, note, tone }: { href: string; icon: LucideIcon; label: string; value: string; note: string; tone: Tone }) {
  const t = toneClasses[tone];
  return (
    <Link href={href} className={cn("group flex flex-col gap-3 rounded-2xl border p-4 transition-colors hover:border-border-strong sm:p-5", t.tile)}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        <span className={cn("grid size-8 place-items-center rounded-xl", t.icon)}>
          <Icon className="size-4" />
        </span>
      </span>
      <span className="text-3xl font-medium tracking-tight text-ink tabular-nums">{value}</span>
      <span className={cn("truncate text-xs font-medium", t.note)}>{note}</span>
    </Link>
  );
}

/** The dashboard's first glance: four numbers, each a door to its page, coloured by what needs attention. */
export function TodayStrip({ c }: { c: TodayCounts }) {
  const tasks = c.overdue + c.dueToday;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        href="/tasks"
        icon={CheckSquare}
        label="Teendők"
        value={String(tasks)}
        tone={c.overdue ? "danger" : c.dueToday ? "accent" : "neutral"}
        note={c.overdue ? `${c.overdue} lejárt` : c.dueToday ? "mára" : "nincs mára"}
      />
      <Tile
        href="/calendar"
        icon={CalendarDays}
        label="Megtekintések"
        value={String(c.viewings)}
        tone={c.viewingsWaiting ? "warning" : c.viewings ? "accent" : "neutral"}
        note={c.viewingsWaiting ? `${c.viewingsWaiting} visszajelzésre vár` : c.nextViewing ? `következő: ${nextAt.format(new Date(c.nextViewing))}` : "a következő 2 hétben nincs"}
      />
      <Tile
        href="/inbox"
        icon={Mail}
        label="Levelek"
        value={c.mailsWaiting == null ? "–" : String(c.mailsWaiting)}
        tone={c.mailsWaiting ? "warning" : "neutral"}
        note={c.mailsWaiting == null ? "kösd be a postafiókod" : c.mailsWaiting ? "válaszra vár" : "minden megválaszolva"}
      />
      <Tile
        href="/deals"
        icon={Handshake}
        label="Ügyletek"
        value={String(c.openDeals)}
        tone="neutral"
        note={c.openDeals ? `${formatPrice(c.pipeline)} jutalék folyamatban` : "nincs folyamatban"}
      />
    </div>
  );
}
