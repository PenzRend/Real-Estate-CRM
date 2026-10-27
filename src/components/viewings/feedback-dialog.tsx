"use client";

import { CheckCircle2, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveFeedbackAction } from "@/app/(app)/viewings/actions";
import { VoiceRecorder } from "@/components/capture/voice-recorder";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/i18n/format";
import type { Viewing } from "@/lib/viewings/data";
import { outcomeLabels, type Outcome } from "@/lib/viewings/logic";

const OUTCOMES: { value: Outcome; hint: string }[] = [
  { value: "high", hint: "Ajánlat vagy második megtekintés holnapra" },
  { value: "medium", hint: "Utánkövetés 2 nap múlva" },
  { value: "low", hint: "Nincs teendő" },
  { value: "none", hint: "Többé nem ajánljuk neki" },
  { value: "no_show", hint: "Új időpont egyeztetése ma" },
];

/**
 * "Hogy sikerült?": one tap for the client's reaction, plus what they said
 * (typed or dictated). Saved on the client's timeline with the follow-up.
 */
export function FeedbackDialog({ viewing, onClose }: { viewing: Viewing; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ task: string | null } | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function save() {
    if (!outcome) return;
    setBusy(true);
    setError(null);
    const r = await saveFeedbackAction(viewing.id, { outcome, feedback }).catch(() => ({ ok: false as const, error: "A mentés nem sikerült. Próbáld újra." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone({ task: r.task });
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
      aria-label="Visszajelzés a megtekintésről"
    >
      <div className="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">Hogy sikerült a megtekintés?</h2>
            <p className="mt-0.5 text-sm text-muted">
              {viewing.client.name} · {viewing.property.name} · {formatDateTime(viewing.startsAt)}
            </p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Bezárás" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
            <X className="size-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" /> Rögzítve az ügyfél idővonalán.
            </p>
            {done.task && <p className="text-sm text-text">Új feladat: {done.task}</p>}
            <div>
              <Button onClick={() => dialog.current?.close()}>Kész</Button>
            </div>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-label="Az ügyfél reakciója" className="grid gap-2 sm:grid-cols-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={outcome === o.value}
                  onClick={() => setOutcome(o.value)}
                  className={cn(
                    "flex flex-col items-start rounded-2xl border px-3.5 py-2.5 text-left transition-colors",
                    outcome === o.value ? "border-ink bg-ink text-white" : "border-border-strong hover:bg-surface",
                    o.value === "no_show" && "sm:col-span-2",
                  )}
                >
                  <span className="text-sm font-medium">{outcomeLabels[o.value]}</span>
                  <span className={cn("text-xs", outcome === o.value ? "text-white/70" : "text-muted")}>{o.hint}</span>
                </button>
              ))}
            </div>

            <Field label="Mit mondott?" htmlFor="fb-text" hint="Pl. tetszett a fekvés, de sötétnek találta a konyhát. Diktálhatod is.">
              <Textarea id="fb-text" value={feedback} onChange={(e) => setFeedback(e.target.value)} className="min-h-24 leading-relaxed" />
            </Field>
            <VoiceRecorder disabled={busy} onTranscript={(t) => setFeedback((f) => (f.trim() ? `${f.trim()}\n${t}` : t))} />

            {error && (
              <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => dialog.current?.close()} disabled={busy}>
                Később
              </Button>
              <Button onClick={save} disabled={!outcome || busy}>
                {busy && <Loader2 className="animate-spin" />} Mentés
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
