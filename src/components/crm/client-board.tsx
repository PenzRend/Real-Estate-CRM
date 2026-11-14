"use client";

import { ArrowRightLeft, CalendarClock, ChevronLeft, ChevronRight, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { setClientStatusAction } from "@/app/(app)/clients/actions";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/cn";
import { formatDate, formatPriceShort } from "@/lib/i18n/format";
import { clientStatusLabels, clientTypeLabels, type ClientStatus } from "@/lib/i18n/labels";
import type { ClientListItem } from "@/lib/types/view-models";

/** The stages, in the order a client usually moves through them. */
export const BOARD_STATUSES = ["new_lead", "contacted", "qualified", "active", "negotiation", "converted", "lost"] as const satisfies readonly ClientStatus[];
type BoardStatus = (typeof BOARD_STATUSES)[number];

const STAGE: Record<BoardStatus, { dot: string; avatar: string }> = {
  new_lead: { dot: "bg-accent", avatar: "bg-accent-soft text-accent" },
  contacted: { dot: "bg-subtle", avatar: "bg-surface-strong text-ink" },
  qualified: { dot: "bg-muted", avatar: "bg-surface-strong text-ink" },
  active: { dot: "bg-success", avatar: "bg-success-soft text-success" },
  negotiation: { dot: "bg-warning", avatar: "bg-warning-soft text-warning" },
  converted: { dot: "bg-primary", avatar: "bg-primary text-white" },
  lost: { dot: "bg-danger", avatar: "bg-danger-soft text-danger" },
};

function budget(c: ClientListItem) {
  if (c.budgetMin == null && c.budgetMax == null) return null;
  if (c.budgetMin != null && c.budgetMax != null) return `${formatPriceShort(c.budgetMin).replace(" M Ft", "")}–${formatPriceShort(c.budgetMax)}`;
  return c.budgetMax != null ? `max. ${formatPriceShort(c.budgetMax)}` : `min. ${formatPriceShort(c.budgetMin)}`;
}

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/**
 * Értékesítési tölcsér: a column per stage, with the stages and their counts
 * on top (a tap there jumps to the column). A card is dragged to another
 * column on a computer, or moved with its ⇄ menu on a phone; the change saves
 * at once and the toast offers to undo it.
 */
export function ClientBoard({ clients, total, limit, now }: { clients: ClientListItem[]; total: number; limit: number; now: string }) {
  const [shown, move] = useOptimistic(clients, (list, m: { id: string; status: ClientStatus }) => list.map((c) => (c.id === m.id ? { ...c, status: m.status } : c)));
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<BoardStatus | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [inView, setInView] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLElement>(null);

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

  function measure() {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }

  function jumpTo(status: BoardStatus) {
    const el = scroller.current;
    const col = el?.querySelector<HTMLElement>(`[data-stage="${status}"]`);
    if (!el || !col) return;
    el.scrollTo({ left: el.scrollLeft + col.getBoundingClientRect().left - el.getBoundingClientRect().left - 16, behavior: "smooth" });
  }

  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // On a phone one column fits the screen: open on the first one with cards, not on an empty "Új érdeklődő".
    if (!window.matchMedia("(min-width: 640px)").matches) {
      const first = el.querySelector<HTMLElement>("[data-stage]:has(li[draggable])");
      if (first) el.scrollLeft += first.getBoundingClientRect().left - el.getBoundingClientRect().left - 16;
    }
    const resize = new ResizeObserver(() => measure());
    resize.observe(el);
    // Which columns are on screen, so the stages above light up as the board scrolls.
    const seen = new IntersectionObserver(
      (entries) =>
        setInView((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const s = (e.target as HTMLElement).dataset.stage!;
            if (e.isIntersecting) next.add(s);
            else next.delete(s);
          }
          return next;
        }),
      { root: el, threshold: 0.6 },
    );
    el.querySelectorAll("[data-stage]").forEach((c) => seen.observe(c));
    return () => {
      resize.disconnect();
      seen.disconnect();
    };
  }, []);

  // When the strip is wider than the screen (a phone), it follows the board to the stages in view.
  useEffect(() => {
    const nav = strip.current;
    const first = BOARD_STATUSES.find((s) => inView.has(s));
    const button = first && nav?.querySelector<HTMLElement>(`[data-jump="${first}"]`);
    if (!nav || !button || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: button.offsetLeft - 16, behavior: "smooth" });
  }, [inView]);

  const nowMs = new Date(now).getTime();
  const counts = Object.fromEntries(BOARD_STATUSES.map((s) => [s, shown.filter((c) => c.status === s).length])) as Record<BoardStatus, number>;
  const most = Math.max(1, ...Object.values(counts));
  const fade = `linear-gradient(to right, ${edges.left ? "transparent, black 3rem" : "black"}, ${edges.right ? "black calc(100% - 3rem), transparent" : "black"})`;

  return (
    <div className="flex flex-col gap-4">
      {/* The stages at a glance: how many clients in each, and a jump to its column. */}
      <nav ref={strip} aria-label="Szakaszok" className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ol className="flex w-full min-w-max gap-1 rounded-2xl border border-border p-1">
          {BOARD_STATUSES.map((s) => (
            <li key={s} className="flex-1">
              <button
                type="button"
                data-jump={s}
                onClick={() => jumpTo(s)}
                className={cn(
                  "flex w-full min-w-28 flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left transition-opacity duration-300 hover:opacity-100",
                  !inView.has(s) && "opacity-55",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
                  <span className={cn("size-1.5 rounded-full", STAGE[s].dot)} aria-hidden />
                  {clientStatusLabels[s]}
                </span>
                <span className="text-xl leading-none font-medium tracking-[-0.02em] text-ink tabular-nums">{counts[s]}</span>
                <span className="h-0.5 w-full overflow-hidden rounded-full bg-surface" aria-hidden>
                  <span className={cn("block h-full rounded-full transition-[width] duration-500", STAGE[s].dot)} style={{ width: `${(counts[s] / most) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {total > limit ? `${total} ügyfélből a legutóbb módosított ${limit} látható. Szűkítsd a keresést.` : `${total} ügyfél`}
          <span className="max-sm:hidden"> · Húzd a kártyát a következő szakaszba.</span>
        </p>
        <div className="flex shrink-0 gap-1.5 max-sm:hidden">
          <button
            type="button"
            onClick={() => page(-1)}
            disabled={!edges.left}
            aria-label="Balra"
            className="grid size-9 place-items-center rounded-full border border-border text-ink transition-opacity hover:bg-surface disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            disabled={!edges.right}
            aria-label="Jobbra"
            className="grid size-9 place-items-center rounded-full border border-border text-ink transition-opacity hover:bg-surface disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={measure}
        onDragOver={(e) => {
          // Near an edge while dragging, the board scrolls on, so every column can be reached.
          const el = scroller.current;
          if (!dragging || !el) return;
          const r = el.getBoundingClientRect();
          if (e.clientX < r.left + 64) el.scrollLeft -= 14;
          else if (e.clientX > r.right - 64) el.scrollLeft += 14;
        }}
        style={{ maskImage: fade, WebkitMaskImage: fade }}
        className="-mx-4 scroll-px-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max snap-x snap-mandatory items-start gap-3 sm:snap-none sm:items-stretch">
          {BOARD_STATUSES.map((status) => {
            const cards = shown.filter((c) => c.status === status);
            return (
              <section
                key={status}
                data-stage={status}
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
                  "flex w-[80vw] shrink-0 snap-start flex-col rounded-3xl border border-border bg-surface/40 p-2 transition-[background-color,border-color] duration-200 sm:min-h-44 sm:w-[17.5rem]",
                  over === status && "border-accent/50 bg-accent-soft/40",
                )}
              >
                <header className="flex items-center gap-2 px-2.5 pt-1.5 pb-2.5">
                  <span className={cn("size-2 rounded-full", STAGE[status].dot)} aria-hidden />
                  <h3 className="text-sm font-medium text-ink">{clientStatusLabels[status]}</h3>
                  <span className="ml-auto text-xs text-muted tabular-nums">{cards.length}</span>
                </header>
                <ul className="flex flex-1 flex-col gap-2">
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
                          "rounded-2xl border border-border bg-background p-3 transition-[box-shadow,transform,opacity] duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-6px_rgb(0_0_0/0.12)] sm:cursor-grab sm:active:cursor-grabbing",
                          dragging === c.id && "rotate-1 opacity-40",
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold", STAGE[status].avatar)} aria-hidden>
                            {initials(c.fullName)}
                          </span>
                          <span className="min-w-0 flex-1 pt-0.5">
                            <Link href={`/clients/${c.id}`} draggable={false} className="block truncate text-sm font-medium text-ink hover:underline">
                              {c.fullName}
                            </Link>
                            <span className="block truncate text-xs text-muted">
                              {clientTypeLabels[c.clientType]}
                              {c.preferredLocations.length > 0 && ` · ${c.preferredLocations.join(", ")}`}
                            </span>
                          </span>
                          {c.phone && (
                            <a
                              href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                              draggable={false}
                              title="Hívás"
                              className="-mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-surface hover:text-ink"
                              aria-label={`${c.fullName} hívása`}
                            >
                              <Phone className="size-3.5" />
                            </a>
                          )}
                          <label className="relative -mt-0.5 -mr-1 grid size-7 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-surface hover:text-ink" title="Áthelyezés">
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
                        {(money || c.nextFollowUpAt) && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-[2.6rem] text-[11px] tabular-nums">
                            {money && <span className="rounded-full bg-surface px-2 py-0.5 font-medium text-ink">{money}</span>}
                            {c.nextFollowUpAt && (
                              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", overdue ? "bg-danger-soft text-danger" : "bg-surface text-muted")}>
                                <CalendarClock className="size-3" aria-hidden />
                                {formatDate(c.nextFollowUpAt)}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {cards.length === 0 && (
                    <li
                      className={cn(
                        "grid place-items-center rounded-2xl border border-dashed border-transparent px-4 py-6 text-center text-xs text-subtle transition-colors",
                        dragging && "flex-1 border-border-strong",
                        over === status && "border-accent text-accent",
                      )}
                    >
                      {dragging ? "Engedd el itt" : "Nincs itt ügyfél"}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
