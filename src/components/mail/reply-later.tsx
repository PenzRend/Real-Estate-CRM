"use client";

import { AlarmClock, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { replyLaterAction } from "@/app/(app)/inbox/actions";
import { buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { laterChoices, type LaterChoice } from "@/lib/mail/later";

/** "Később": a task to answer this email at a chosen time (in an hour, this evening, tomorrow, Monday). */
export function ReplyLater({ emailId }: { emailId: string }) {
  const [choices, setChoices] = useState<LaterChoice[] | null>(null);
  const [busy, start] = useTransition();
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setChoices((c) => (c ? null : laterChoices(new Date())))}
        aria-expanded={choices != null}
        disabled={busy}
        className={buttonClasses("ghost", "xs", "text-muted hover:text-ink")}
      >
        {busy ? <Loader2 className="animate-spin" /> : <AlarmClock />} Később
      </button>
      {choices && (
        <span className="menu-motion absolute right-0 z-30 mt-1 flex w-44 flex-col rounded-2xl border border-border bg-background p-1.5 shadow-float">
          <span className="px-2.5 pt-1 pb-1.5 text-[11px] text-subtle">Emlékeztess, hogy válaszoljak:</span>
          {choices.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setChoices(null);
                start(async () => {
                  const r = await replyLaterAction(emailId, c.at).catch(actionFailed);
                  toast({ message: r.ok ? `Feladat felírva: ${c.label.toLowerCase()} válaszolsz.` : r.error });
                });
              }}
              className="rounded-xl px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface"
            >
              {c.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
