"use client";

import { FileText, Loader2, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { draftReportAction, sendReportAction, setWeeklyReportAction } from "@/app/(app)/properties/report-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import { formatDate, formatDateTime } from "@/lib/i18n/format";
import { permissionHref } from "@/lib/mail/provider";
import type { Report } from "@/lib/reports/data";
import { cn } from "@/lib/cn";

/**
 * The weekly report to the listing's owner: switch on Monday-morning sending,
 * or write one now (Flavio drafts it from the week's viewings, feedback and
 * offers; the agent edits and sends it from their own mailbox).
 */
export function SellerReportCard({
  propertyId,
  owner,
  weekly,
  reports,
}: {
  propertyId: string;
  owner: { id: string; name: string; email: string | null } | null;
  weekly: boolean;
  reports: Report[];
}) {
  const [on, setOn] = useOptimistic(weekly);
  const [switching, startSwitch] = useTransition();
  const [draft, setDraft] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [busy, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const subject = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();
  const ready = Boolean(owner?.email);

  const write = () =>
    start(async () => {
      setError(null);
      const r = await draftReportAction(propertyId).catch(actionFailed);
      if (!r.ok) return setError(r.error);
      setDraft(r.report);
      dialog.current?.showModal();
    });
  const send = () =>
    start(async () => {
      if (!draft) return;
      setError(null);
      const r = await sendReportAction(draft.id, subject.current?.value ?? draft.subject, body.current?.value ?? draft.body).catch(actionFailed);
      if (r.ok) {
        dialog.current?.close();
        setDraft(null);
      } else {
        setError(r.error);
        setNeedsPermission(Boolean("needsPermission" in r && r.needsPermission));
      }
    });

  return (
    <Card>
      <CardHeader title="Heti riport a tulajdonosnak" />
      <div className="flex flex-col gap-4 p-5">
        {!owner ? (
          <p className="text-sm text-muted">Add meg a tulajdonost (Szerkesztés → Tulajdonos), és a Flavio hetente megírja neki, mi történt a hirdetéssel.</p>
        ) : !owner.email ? (
          <p className="text-sm text-muted">
            {owner.name} e-mail-címe hiányzik.{" "}
            <Link href={`/clients/${owner.id}/edit`} className="font-medium text-ink underline">
              Add meg
            </Link>
            , és mehet a heti riport.
          </p>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={switching}
                onClick={() =>
                  startSwitch(async () => {
                    setOn(!on);
                    await setWeeklyReportAction(propertyId, !on);
                  })
                }
                className={cn("relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors", on ? "bg-success" : "bg-border-strong")}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", on ? "left-[18px]" : "left-0.5")} />
              </button>
              <span className="text-sm">
                <span className="font-medium text-ink">Hetente automatikusan, hétfő reggel</span>
                <span className="block text-muted">
                  {owner.name} e-mailt kap a megtekintésekről, a vevők visszajelzéseiről (név nélkül) és az ajánlatokról – a te postafiókodból.
                </span>
              </span>
            </label>
            <div>
              <Button variant="secondary" size="sm" onClick={write} disabled={busy || !ready}>
                {busy && !draft ? <Loader2 className="animate-spin" /> : <FileText />} Riport most
              </Button>
            </div>
          </>
        )}
        {error && !draft && <p className="text-sm text-danger">{error}</p>}

        {reports.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
            {reports.slice(0, 4).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-muted">
                  {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                </span>
                {r.status === "sent" ? (
                  <Badge tone="success">Elküldve {r.sentAt ? formatDateTime(r.sentAt) : ""}</Badge>
                ) : r.status === "failed" ? (
                  <Badge tone="danger">Nem ment el</Badge>
                ) : (
                  <Badge>Piszkozat</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <dialog ref={dialog} onClose={() => setDraft(null)} className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30" aria-label="Heti riport">
        {draft && (
          <div className="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto p-6">
            <h2 className="text-xl">Heti riport – {owner?.name}</h2>
            <p className="text-xs text-muted">Címzett: {owner?.email}. Nézd át, írj hozzá, ha kell – a vevők neve nem szerepel benne.</p>
            <Field label="Tárgy" htmlFor="report-subject">
              <Input ref={subject} id="report-subject" defaultValue={draft.subject} maxLength={300} />
            </Field>
            <Field label="Szöveg" htmlFor="report-body">
              <Textarea ref={body} id="report-body" defaultValue={draft.body} className="min-h-80 leading-relaxed" />
            </Field>
            {error && (
              <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}{" "}
                {needsPermission && (
                  <a href={permissionHref("send", pathname)} className="inline-flex items-center gap-1 font-medium underline">
                    <ShieldCheck className="size-3.5" /> Küldés engedélyezése
                  </a>
                )}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={send} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />} Küldés
              </Button>
              <Button variant="ghost" onClick={() => dialog.current?.close()}>
                Később
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </Card>
  );
}
