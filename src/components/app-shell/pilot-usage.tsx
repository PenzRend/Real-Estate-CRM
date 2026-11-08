import { Sparkles } from "lucide-react";
import Link from "next/link";
import { aiUsage } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/i18n/format";
import { utcToZonedLocal } from "@/lib/i18n/timezone";

const nextMonth = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", timeZone: "Europe/Budapest" });

function Bar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const share = limit > 0 ? Math.min(used / limit, 1) : 1;
  const out = used >= limit;
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn("tabular-nums", out ? "font-medium text-danger" : "text-ink")}>
          {formatNumber(used)} / {formatNumber(limit)}
        </span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
        <span
          className={cn("block h-full rounded-full", out ? "bg-danger" : share >= 0.8 ? "bg-warning" : "bg-ink")}
          style={{ width: `${Math.max(share * 100, used > 0 ? 3 : 0)}%` }}
        />
      </span>
    </span>
  );
}

/** The free pilot's AI allowance, today and this month, at the foot of the menu. */
export async function PilotUsage() {
  const u = await aiUsage(await getCurrentUser());
  const monthOut = u.monthlyLimit !== null && u.month >= u.monthlyLimit;
  const dayOut = u.today >= u.dailyLimit;
  // The month is counted in Budapest time (see monthStart); noon keeps the date clear of the zone shift.
  const [year, month] = utcToZonedLocal(new Date().toISOString()).slice(0, 7).split("-").map(Number);
  const resets = nextMonth.format(new Date(Date.UTC(year, month, 1, 12)));

  return (
    <Link
      href="/settings#ai-keret"
      className="flex flex-col gap-2 rounded-2xl border border-border px-3.5 py-3 transition-colors hover:bg-surface"
      aria-label={`Ingyenes pilot: ma ${u.today} / ${u.dailyLimit}${u.monthlyLimit !== null ? `, ebben a hónapban ${u.month} / ${u.monthlyLimit}` : ""} AI-hívás`}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
        <Sparkles className="size-3.5" /> Ingyenes pilot · AI-hívások
      </span>
      <Bar label="Ma" used={u.today} limit={u.dailyLimit} />
      {u.monthlyLimit !== null && <Bar label="Ebben a hónapban" used={u.month} limit={u.monthlyLimit} />}
      {(monthOut || dayOut) && (
        <span className="text-xs text-danger">{monthOut ? `Elfogyott a havi keret. Újraindul: ${resets}` : "Elfogyott a mai keret. Éjfélkor újraindul."}</span>
      )}
    </Link>
  );
}
