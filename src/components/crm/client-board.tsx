"use client";

import { ArrowRightLeft, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { setClientStatusAction } from "@/app/(app)/clients/actions";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/cn";
import { formatDate, formatPriceShort } from "@/lib/i18n/format";
import { clientStatusLabels, clientTypeLabels, type ClientStatus } from "@/lib/i18n/labels";
import type { ClientListItem } from "@/lib/types/view-models";

/** The columns, in the order a client usually moves through them. */
export const BOARD_STATUSES = ["new_lead", "contacted", "qualified", "active", "negotiation", "converted", "lost"] as const satisfies readonly ClientStatus[];
type BoardStatus = (typeof BOARD_STATUSES)[number];

const DOT: Record<BoardStatus, string> = {
  new_lead: "bg-accent",
  contacted: "bg-subtle",
  qualified: "bg-muted",
  active: "bg-success",
  negotiation: "bg-warning",
  converted: "bg-primary",
  lost: "bg-danger",
};

function budget(c: ClientListItem) {
  if (c.budgetMin == null && c.budgetMax == null) return null;
  if (c.budgetMin != null && c.budgetMax != null) return `${formatPriceShort(c.budgetMin).replace(" M Ft", "")}–${formatPriceShort(c.budgetMax)}`;
  return c.budgetMax != null ? `max. ${formatPriceShort(c.budgetMax)}` : `min. ${formatPriceShort(c.budgetMin)}`;
}

/**
 * Ügyfelek as a board: one column per status. A card is dragged to another
 * column on a computer, or moved with its menu on a phone; the change saves
 * at once and the toast offers to undo it.
 */
export function ClientBoard({ clients, now }: { clients: ClientListItem[]; now: string }) {
  const [shown, move] = useOptimistic(clients, (list, m: { id: string; status: ClientStatus }) => list.map((c) => (c.id === m.id ? { ...c, status: m.status } : c)));
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<BoardStatus | null>(null);

  function moveTo(id: string, status: BoardStatus) {
    const client = shown.find((c) => c.id === id);
    if (!client || client.status === status) return;
    const from = client.status;
    startTransition(async () => {
      move({ id, status });
      const r = await setClientStatusAction(id, status);
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      toast({
        message: `${client.fullName} → ${clientStatusLabels[status]}`,
        undo: () => setClientStatusAction(id, from),
        undoneMessage: `Visszaállítva: ${clientStatusLabels[from]}`,
      });
    });
  }

  const nowMs = new Date(now).getTime();
  const scroller = useRef<HTMLDivElement>(null);

  // On a phone one column fits the screen: open on the first one with cards, not on an empty "Új érdeklődő".
  useEffect(() => {
    const el = scroller.current;
    if (!el || window.matchMedia("(min-width: 640px)").matches) return;
    const first = el.querySelector<HTMLElement>("section:has(li[draggable])");
    if (first) el.scrollLeft += first.getBoundingClientRect().left - el.getBoundingClientRect().left - 16;
  }, []);

  return (
    <div ref={scroller} className="-mx-4 scroll-px-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
      <div className="flex w-max snap-x snap-mandatory items-start gap-3 sm:snap-none sm:items-stretch">
        {BOARD_STATUSES.map((status) => {
          const cards = shown.filter((c) => c.status === status);
          const closed = status === "converted" || status === "lost";
          return (
            <section
              key={status}
              aria-label={clientStatusLabels[status]}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== status) setOver(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragging;
                setOver(null);
                setDragging(null);
                if (id) moveTo(id, status);
              }}
              className={cn(
                "flex w-[78vw] shrink-0 snap-start flex-col rounded-2xl border border-border bg-surface/60 transition-colors sm:w-64",
                over === status && "border-accent bg-accent-soft/50",
                closed && "sm:w-56",
              )}
            >
              <header className="flex items-center gap-2 px-3.5 pt-3 pb-2">
                <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden />
                <h3 className="text-sm font-medium text-ink">{clientStatusLabels[status]}</h3>
                <span className="ml-auto text-xs text-muted tabular-nums">{cards.length}</span>
              </header>
              <ul className="flex min-h-24 flex-col gap-2 px-2 pb-2">
                {cards.map((c) => {
                  const overdue = c.nextFollowUpAt != null && new Date(c.nextFollowUpAt).getTime() < nowMs;
                  const money = budget(c);
                  return (
                    <li
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", c.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(c.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      className={cn(
                        "group relative rounded-xl border border-border bg-background p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-opacity sm:cursor-grab sm:active:cursor-grabbing",
                        dragging === c.id && "opacity-40",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Link href={`/clients/${c.id}`} draggable={false} className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline">
                          {c.fullName}
                        </Link>
                        <label className="relative grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
                          <ArrowRightLeft className="size-3.5" aria-hidden />
                          <select
                            aria-label={`${c.fullName} áthelyezése`}
                            value={c.status}
                            onChange={(e) => moveTo(c.id, e.target.value as BoardStatus)}
                            className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                          >
                            {BOARD_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {clientStatusLabels[s]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {clientTypeLabels[c.clientType]}
                        {c.preferredLocations.length > 0 && ` · ${c.preferredLocations.join(", ")}`}
                      </p>
                      {(money || c.nextFollowUpAt || c.phone) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                          {money && <span className="text-ink">{money}</span>}
                          {c.nextFollowUpAt && <span className={overdue ? "text-danger" : "text-muted"}>{overdue ? "Lejárt: " : "Hívd: "}{formatDate(c.nextFollowUpAt)}</span>}
                          {c.phone && (
                            <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} draggable={false} className="ml-auto inline-flex items-center gap-1 text-muted hover:text-ink" aria-label={`${c.fullName} hívása`}>
                              <Phone className="size-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
                {cards.length === 0 && (
                  <li className={cn("grid h-20 place-items-center rounded-xl border border-dashed border-border text-xs text-subtle", over === status && "border-accent text-accent")}>
                    {dragging ? "Ide húzd" : "Üres"}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
