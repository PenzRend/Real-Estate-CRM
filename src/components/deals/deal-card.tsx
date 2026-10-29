import { CalendarClock, UserRound } from "lucide-react";
import Link from "next/link";
import type { Deal } from "@/lib/deals/data";
import { stageLabels } from "@/lib/deals/logic";
import { formatDate, formatPrice, formatPriceShort } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";

/** A deal on the board or in a list: listing, buyer, price, the next date, the commission. */
export function DealCard({ deal: d, today, showStage = false }: { deal: Deal; today: string; showStage?: boolean }) {
  const overdue = d.next && d.next.date < today;
  return (
    <Link href={`/deals/${d.id}`} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors hover:border-border-strong hover:bg-surface/40">
      <p className="line-clamp-2 text-sm leading-snug font-medium text-ink">{d.property.name}</p>
      {d.buyer && (
        <p className="flex items-center gap-1.5 truncate text-xs text-muted">
          <UserRound className="size-3.5 shrink-0" /> {d.buyer.name}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
        <span className="font-medium text-ink tabular-nums">{d.agreed_price != null ? formatPriceShort(d.agreed_price) : d.property.askingPrice != null ? `Irányár: ${formatPriceShort(d.property.askingPrice)}` : "Ár: —"}</span>
        {d.commissionValue != null && <span className="text-success tabular-nums">Jutalék: {formatPrice(d.commissionValue, d.currency)}</span>}
      </div>
      {(d.next || showStage || d.status !== "open") && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2 text-xs">
          {showStage && <span className="rounded-full bg-surface px-2 py-0.5 text-muted">{stageLabels[d.stage]}</span>}
          {d.status === "lost" && <span className="text-danger">Meghiúsult{d.lost_reason ? `: ${d.lost_reason}` : ""}</span>}
          {d.status === "won" && d.closed_at && <span className="text-success">Lezárva: {formatDate(d.closed_at)}</span>}
          {d.next && (
            <span className={cn("flex items-center gap-1", overdue ? "font-medium text-danger" : "text-muted")}>
              <CalendarClock className="size-3.5" /> {d.next.label}: {formatDate(d.next.date)}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
