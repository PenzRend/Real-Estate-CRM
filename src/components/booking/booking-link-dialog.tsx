"use client";

import { CalendarPlus, Check, Copy, Loader2, RefreshCw, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { renewBookingTokenAction, saveBookingLinkAction } from "@/app/(app)/(teendok)/calendar/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import type { BookingLink } from "@/lib/booking/data";
import type { BookingSettings } from "@/lib/booking/slots";
import { cn } from "@/lib/cn";

const DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const time = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** "Foglalási link" on Naptár: the agent's own booking page for clients, its hours, and the link to share. */
export function BookingLinkDialog({ link, defaults }: { link: BookingLink | null; defaults: BookingSettings }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [s, setS] = useState<BookingSettings & { active: boolean }>({ ...(link ?? defaults), active: link?.active ?? true });
  const [token, setToken] = useState(link?.token ?? null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [busy, start] = useTransition();
  const url = token ? `${origin}/b/${token}` : null;
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((x) => ({ ...x, [k]: v }));

  const save = (next = s) =>
    start(async () => {
      const r = await saveBookingLinkAction(next).catch(actionFailed);
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      setToken(r.link.token);
      toast({ message: next.active ? "Mentve – a foglalási link él." : "A foglalási link kikapcsolva." });
    });

  const field = "h-10 rounded-xl border border-border bg-background px-3 text-sm text-ink";
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOrigin(window.location.origin);
          dialog.current?.showModal();
        }}
      >
        <CalendarPlus /> Foglalási link
        {link?.active && <span className="size-1.5 rounded-full bg-success" aria-label="bekapcsolva" />}
      </Button>
      <dialog ref={dialog} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30" aria-label="Foglalási link">
        <div className="flex max-h-[90dvh] flex-col gap-5 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg">Foglalási link</h2>
              <p className="mt-0.5 text-sm text-muted">Küldd el az érdeklődőknek: a szabad időpontjaidból maguk foglalnak megtekintést, és a foglalás bekerül a naptáradba.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Bezárás" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
              <X className="size-4" />
            </button>
          </div>

          {url && s.active && (
            <div className="flex items-center gap-2 rounded-2xl bg-surface p-2 pl-3.5">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{url}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    toast({ message: "Nem sikerült másolni – jelöld ki és másold." });
                  }
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Másolva" : "Másolás"}
              </button>
            </div>
          )}
          {url && s.active && <p className="-mt-3 text-xs text-muted">Egy konkrét ingatlanhoz: az ingatlan oldalán a „…” menüben „Foglalási link másolása”.</p>}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs text-muted">Melyik napokon?</legend>
            <div className="flex gap-1.5">
              {DAYS.map((d, i) => {
                const n = i + 1;
                const on = s.days.includes(n);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("days", on ? s.days.filter((x) => x !== n) : [...s.days, n].sort())}
                    className={cn("h-9 flex-1 rounded-xl border text-sm transition-colors", on ? "border-ink bg-ink text-white" : "border-border text-muted hover:bg-surface")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Ettől
              <input type="time" step={900} value={time(s.startMinute)} onChange={(e) => set("startMinute", minutes(e.target.value))} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Eddig
              <input type="time" step={900} value={time(s.endMinute)} onChange={(e) => set("endMinute", minutes(e.target.value))} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Egy megtekintés
              <select value={s.slotMinutes} onChange={(e) => set("slotMinutes", Number(e.target.value))} className={field}>
                {[30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} perc
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Legalább ennyivel előre
              <select value={s.noticeHours} onChange={(e) => set("noticeHours", Number(e.target.value))} className={field}>
                {[
                  [2, "2 óra"],
                  [12, "12 óra"],
                  [24, "1 nap"],
                  [48, "2 nap"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
              Meddig foglalhatnak előre?
              <select value={s.horizonDays} onChange={(e) => set("horizonDays", Number(e.target.value))} className={field}>
                {[7, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {d} napra
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-muted">A más megtekintéseiddel ütköző időpontok nem jelennek meg. A Google-, Apple- és Outlook-naptárad egyéb eseményeit a link még nem nézi – ezt az időpontok megadásával tudod szabályozni.</p>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => save()} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {link || token ? "Mentés" : "Bekapcsolás"}
            </Button>
            {token && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  const next = { ...s, active: !s.active };
                  setS(next);
                  save(next);
                }}
              >
                {s.active ? "Kikapcsolás" : "Bekapcsolás"}
              </Button>
            )}
            {token && s.active && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Új linket kérsz? A régi azonnal megszűnik – akinek elküldted, nem tud vele foglalni.")) return;
                  start(async () => {
                    const r = await renewBookingTokenAction().catch(actionFailed);
                    if (r && "token" in r && r.token) setToken(r.token);
                    toast({ message: "Új link – a régi már nem működik." });
                  });
                }}
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
              >
                <RefreshCw className="size-3.5" /> Új link
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
