"use client";

import { ArrowRightLeft, Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { handOffClientAction } from "@/app/(app)/clients/handoff-actions";
import { chatTargetsAction } from "@/app/(app)/messages/actions";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/cn";

type Colleague = Awaited<ReturnType<typeof chatTargetsAction>>["colleagues"][number];

/** "Átadás kollégának" (in the client's "…" menu): the colleague becomes the client's agent and gets a message with a note. */
export function HandOffClient({ clientId, name }: { clientId: string; name: string }) {
  // Rendered into <body> once opened: the "…" menu it sits in hides itself after a click.
  const [open, setOpen] = useState(false);
  const [colleagues, setColleagues] = useState<Colleague[] | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function openDialog() {
    setDone(null);
    setError(null);
    setOpen(true);
    if (!colleagues) void chatTargetsAction().then((t) => setColleagues(t.colleagues));
  }

  return (
    <>
      <Button variant="secondary" onClick={openDialog}>
        <ArrowRightLeft /> Átadás kollégának
      </Button>
      {open &&
        createPortal(
          <dialog
            ref={(d) => {
              if (d && !d.open) d.showModal();
            }}
            onClose={() => setOpen(false)}
            onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
            className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
            aria-label="Átadás kollégának"
          >
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <div>
                <h2 className="text-lg tracking-tight">{name} átadása</h2>
                <p className="mt-1 text-sm text-muted">
                  A kolléga lesz az ügyfél felelőse; üzenetben megkapja az ügyfél kártyáját és a megjegyzésedet. Az előzmények maradnak.
                </p>
              </div>
              {done ? (
                <p className="pop-in flex items-center gap-2 rounded-2xl bg-success-soft p-4 text-sm font-medium text-success">
                  <Check className="size-4" /> Átadva {done} részére.
                </p>
              ) : (
                <>
                  <div className="flex max-h-60 flex-col gap-1 overflow-y-auto" role="radiogroup" aria-label="Kinek?">
                    {!colleagues && (
                      <p className="flex items-center gap-2 py-3 text-sm text-muted">
                        <Loader2 className="size-4 animate-spin" /> Betöltés…
                      </p>
                    )}
                    {colleagues?.map((c) => (
                      <button
                        key={c.userId}
                        type="button"
                        role="radio"
                        aria-checked={to === c.userId}
                        onClick={() => setTo(c.userId)}
                        className={cn("flex items-center gap-3 rounded-2xl px-3 py-2 text-left", to === c.userId ? "bg-surface-strong" : "hover:bg-surface")}
                      >
                        <UserAvatar name={c.name} url={c.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{c.name}</span>
                          {c.username && <span className="block truncate text-xs text-muted">@{c.username}</span>}
                        </span>
                        {to === c.userId && <Check className="size-4 text-accent" />}
                      </button>
                    ))}
                    {colleagues && !colleagues.length && (
                      <p className="text-sm text-muted">Még nincs kollégád a munkaterületen – meghívni a Beállításokban tudod.</p>
                    )}
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Mit érdemes tudnia? Pl. „Csütörtökre ígértem neki visszahívást.”"
                    aria-label="Megjegyzés a kollégának"
                    className="w-full resize-none rounded-2xl border border-border px-4 py-3 text-sm focus:border-ink focus:outline-none"
                  />
                  {error && (
                    <p role="alert" className="text-sm text-danger">
                      {error}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                      Mégse
                    </Button>
                    <Button
                      disabled={!to || busy}
                      onClick={() =>
                        start(async () => {
                          const r = await handOffClientAction(clientId, to!, note).catch(() => ({ ok: false as const, error: "Az átadás nem sikerült." }));
                          if (r.ok) setDone(r.name);
                          else setError(r.error);
                        })
                      }
                    >
                      {busy ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />} Átadás
                    </Button>
                  </div>
                </>
              )}
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
