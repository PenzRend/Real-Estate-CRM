"use client";

import { Check, Clock, Loader2, Mail, Send, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { approveOutboxAction, cancelOutboxAction, sendOutboxNowAction } from "@/app/(app)/inbox/automation-actions";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { OutboxItem } from "@/lib/email-auto/outbox";

const when = new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
const statusBadge: Record<OutboxItem["status"], { tone: "warning" | "accent" | "success" | "danger" | "neutral"; label: string }> = {
  awaiting_approval: { tone: "warning", label: "Jóváhagyásra vár" },
  queued: { tone: "accent", label: "Ütemezve" },
  sent: { tone: "success", label: "Elküldve" },
  failed: { tone: "danger", label: "Nem ment el" },
  cancelled: { tone: "neutral", label: "Visszavonva" },
};

function Row({ item }: { item: OutboxItem }) {
  const [open, setOpen] = useState(item.status === "awaiting_approval");
  const [subject, setSubject] = useState(item.subject);
  const [body, setBody] = useState(item.body);
  const [busy, start] = useTransition();
  const editable = item.status === "awaiting_approval" || item.status === "queued" || item.status === "failed";
  const edits = subject !== item.subject || body !== item.body ? { subject, body } : undefined;
  const b = statusBadge[item.status];

  return (
    <li className="px-5 py-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-muted">
          <Mail className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{item.subject}</span>
            <Badge tone={b.tone}>{b.label}</Badge>
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {item.client.name} · {item.toEmail} · {item.templateName ?? "kézi"} ·{" "}
            {item.status === "sent" && item.sentAt ? `elküldve ${when.format(new Date(item.sentAt))}` : `${when.format(new Date(item.scheduledAt))}`}
          </span>
          {item.error && <span className="mt-1 block text-xs text-danger">{item.error}</span>}
        </span>
      </button>
      {open && (
        <div className="reveal mt-3 flex flex-col gap-2 rounded-2xl bg-surface p-3 sm:ml-12">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} readOnly={!editable} aria-label="Tárgy" className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-ink focus:border-ink focus:outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} readOnly={!editable} rows={Math.min(14, body.split("\n").length + 1)} aria-label="Szöveg" className="resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed text-ink focus:border-ink focus:outline-none" />
          {editable && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    const r = await sendOutboxNowAction(item.id, edits).catch(actionFailed);
                    toast({ message: r.ok ? `Elküldve: ${item.client.name}.` : r.error });
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Küldés most
              </button>
              {item.status === "awaiting_approval" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => start(() => approveOutboxAction(item.id, edits).catch(actionFailed).then(() => void toast({ message: "Jóváhagyva – a megadott időben elmegy." })))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-background px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-surface-strong"
                >
                  <Check className="size-3.5" /> Jóváhagyás ({when.format(new Date(item.scheduledAt))})
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => start(() => cancelOutboxAction(item.id).catch(actionFailed).then(() => void toast({ message: "Visszavonva, nem megy el." })))}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:text-danger"
              >
                <X className="size-3.5" /> Visszavonás
              </button>
              <Link href={`/clients/${item.client.id}`} className="ml-auto text-xs text-muted hover:text-ink">
                Ügyfél megnyitása →
              </Link>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** The outbox: waiting for approval first, then scheduled, then the history. */
export function OutboxList({ items }: { items: OutboxItem[] }) {
  if (!items.length)
    return (
      <p className="flex items-center gap-2 rounded-3xl border border-dashed border-border-strong px-5 py-6 text-sm text-muted">
        <Clock className="size-4" /> Még nincs automatikus levél. Kapcsolj be egy szabályt lent, és a megfelelő pillanatban itt jelennek meg.
      </p>
    );
  const order: OutboxItem["status"][] = ["awaiting_approval", "queued", "failed", "sent", "cancelled"];
  const sorted = [...items].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return <ul className={cn("divide-y divide-border rounded-3xl border border-border bg-background")}>{sorted.map((i) => <Row key={i.id} item={i} />)}</ul>;
}
