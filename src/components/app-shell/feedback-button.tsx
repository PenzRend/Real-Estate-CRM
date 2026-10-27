"use client";

import { CheckCircle2, Loader2, MessageSquarePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sendFeedbackAction } from "@/app/(app)/feedback/actions";
import { VoiceRecorder } from "@/components/capture/voice-recorder";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";

type Kind = "bug" | "idea" | "other";
const KINDS: { value: Kind; label: string }[] = [
  { value: "bug", label: "Hiba" },
  { value: "idea", label: "Ötlet" },
  { value: "other", label: "Egyéb" },
];

function FeedbackDialog({ page, onClose }: { page: string | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<Kind>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function send() {
    setBusy(true);
    setError(null);
    const r = await sendFeedbackAction({ kind, message, page }).catch(() => ({ ok: false as const, error: "A küldés nem sikerült. Próbáld újra." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSent(true);
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
      aria-label="Visszajelzés"
    >
      <div className="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">Visszajelzés</h2>
            <p className="mt-0.5 text-sm text-muted">Mi nem működik, mi hiányzik, mit csinálnál másképp? Minden üzenetet elolvasunk.</p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label="Bezárás">
            <X className="size-4" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm text-success">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Köszönjük! Megkaptuk az üzenetedet.
            </p>
            <Button className="self-end" onClick={() => dialog.current?.close()}>
              Bezárás
            </Button>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-label="Típus" className="flex gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.value}
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm",
                    kind === k.value ? "border-primary bg-primary text-white" : "border-border-strong text-ink hover:bg-surface",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <Field label="Üzenet" htmlFor="feedback-message" hint="Azt is elküldjük, melyik oldalon voltál.">
              <Textarea id="feedback-message" value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-32 leading-relaxed" autoFocus />
            </Field>
            <VoiceRecorder disabled={busy} onTranscript={(t) => setMessage((m) => (m.trim() ? `${m.trim()}\n${t}` : t))} />
            {error && (
              <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => dialog.current?.close()}>
                Mégse
              </Button>
              <Button onClick={send} disabled={busy || !message.trim()}>
                {busy && <Loader2 className="animate-spin" />} Küldés
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

/** Sidebar link that opens the feedback form; the current page goes along with the message. */
export function FeedbackButton() {
  // Read on click: the address is request data, and the sidebar renders without it.
  const [page, setPage] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setPage(window.location.pathname)}
        className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <MessageSquarePlus className="size-[18px]" strokeWidth={1.75} /> Visszajelzés
      </button>
      {page != null && <FeedbackDialog page={page} onClose={() => setPage(null)} />}
    </>
  );
}
