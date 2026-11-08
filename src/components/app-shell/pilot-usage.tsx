import { Sparkles } from "lucide-react";
import Link from "next/link";
import { monthlyAiUsage } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/i18n/format";
import { utcToZonedLocal } from "@/lib/i18n/timezone";

const nextMonth = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", timeZone: "Europe/Budapest" });

/** The free pilot's AI allowance for this month, at the foot of the menu. Hidden when there is no cap. */
export async function PilotUsage() {
  const { used, limit } = await monthlyAiUsage(await getCurrentUser());
  if (limit === null) return null;
  const share = limit > 0 ? Math.min(used / limit, 1) : 1;
  const out = used >= limit;
  // The month is counted in Budapest time (see monthStart); noon keeps the date clear of the zone shift.
  const [year, month] = utcToZonedLocal(new Date().toISOString()).slice(0, 7).split("-").map(Number);
  const resets = nextMonth.format(new Date(Date.UTC(year, month, 1, 12)));

  return (
    <Link
      href="/settings#ai-keret"
      className="flex flex-col gap-2 rounded-2xl border border-border px-3.5 py-3 transition-colors hover:bg-surface"
      aria-label={`Ingyenes pilot: ${used} / ${limit} AI-hívás ebben a hónapban`}
    >
      <span className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <Sparkles className="size-3.5" /> Ingyenes pilot
        </span>
        <span className={cn("tabular-nums", out ? "font-medium text-danger" : "text-muted")}>
          {formatNumber(used)} / {formatNumber(limit)}
        </span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
        <span
          className={cn("block h-full rounded-full", out ? "bg-danger" : share >= 0.8 ? "bg-warning" : "bg-ink")}
          style={{ width: `${Math.max(share * 100, used > 0 ? 3 : 0)}%` }}
        />
      </span>
      <span className="text-xs text-muted">{out ? `Elfogyott az AI-keret. Újraindul: ${resets}` : `AI-hívás ebben a hónapban · újraindul: ${resets}`}</span>
    </Link>
  );
}
