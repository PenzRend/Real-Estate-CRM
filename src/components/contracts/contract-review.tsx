"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, Download, FileCheck2, Loader2, PencilLine, Printer, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { aiReviewContractAction, approveContractAction, deleteContractAction, previewContractAction, saveContractAction } from "@/app/(app)/(dokumentumok)/contracts/actions";
import { RichTemplateEditor } from "@/components/rich-template/rich-template-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { Check } from "@/lib/contracts/checks";
import type { DraftView } from "@/lib/contracts/data";
import type { FieldGroup } from "@/lib/contracts/kinds";

const GROUPS: FieldGroup[] = ["Felek", "Ingatlan", "Pénzügyek", "Iroda", "Egyéb"];

const PAPER = cn(
  "contract-paper min-h-[40rem] flex-1 px-8 py-8 font-serif text-[14.5px] leading-relaxed text-text sm:px-12",
  "[&_em]:text-muted [&_h1]:mb-1 [&_h1]:text-center [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-ink",
  "[&_mark]:rounded [&_mark]:bg-warning-soft [&_mark]:px-1 [&_mark]:font-sans [&_mark]:text-[12px] [&_mark]:font-medium [&_mark]:text-warning",
);

/**
 * Prints the contract alone: a copy of the paper goes straight under <body>,
 * and the print styles (globals.css, .print-contract) hide everything else.
 */
function printContract(html: string) {
  document.getElementById("contract-print")?.remove();
  const sheet = document.createElement("article");
  sheet.id = "contract-print";
  sheet.className = PAPER;
  sheet.innerHTML = html;
  document.body.append(sheet);
  document.body.classList.add("print-contract");
  const done = () => {
    document.body.classList.remove("print-contract");
    sheet.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/** Review a contract draft: fill the gaps, read and edit the text, let the AI look it over, approve into a Word file. */
export function ContractReview({ draft, documentUrl }: { draft: DraftView; documentUrl: string | null }) {
  const [extra, setExtra] = useState<Record<string, string>>(draft.extra);
  const [body, setBody] = useState(draft.body);
  const [editing, setEditing] = useState(false);
  const [html, setHtml] = useState(draft.html);
  const [missing, setMissing] = useState(draft.missing);
  const [checks, setChecks] = useState<Check[]>(draft.checks);
  const [aiIssues, setAiIssues] = useState<Check[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [approving, startApprove] = useTransition();
  const [reviewing, startReview] = useTransition();
  const first = useRef(true);

  // The preview follows every change (nothing is saved until "Mentés").
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      void previewContractAction(draft.id, body, extra).then((p) => {
        if (!p) return;
        setHtml(p.html);
        setMissing(p.missing);
        setChecks(p.checks);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [body, extra, draft.id]);

  const valueOf = (key: string) => extra[key] ?? draft.values[key] ?? "";
  const set = (key: string, v: string) => {
    setExtra((e) => ({ ...e, [key]: v }));
    setDirty(true);
  };
  const missingLabels = useMemo(() => draft.fields.filter((f) => missing.includes(f.key)).map((f) => f.label), [draft.fields, missing]);
  const errors = checks.filter((c) => c.level === "error");

  const save = (then?: () => void) =>
    startSave(async () => {
      const r = await saveContractAction(draft.id, { body, extra }).catch(actionFailed);
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      setDirty(false);
      if (then) then();
      else toast({ message: "Tervezet elmentve." });
    });

  const approve = (then?: () => void) =>
    save(() =>
      startApprove(async () => {
        const r = await approveContractAction(draft.id).catch(actionFailed);
        if (!r.ok) {
          toast({ message: r.error });
          return;
        }
        if (then) then();
        else toast({ message: "Jóváhagyva – a Word-fájl a Dokumentumok → Szerződések mappában van." });
      }),
    );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[24rem_1fr]">
      <aside className="flex flex-col gap-4">
        <section className="rounded-3xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-center gap-2">
            {draft.status === "approved" && !dirty ? <Badge tone="success">Jóváhagyva</Badge> : <Badge tone="warning">Felülvizsgálatra vár</Badge>}
            {draft.origin === "auto" && <Badge tone="accent">Automatikusan készült</Badge>}
          </div>
          {missingLabels.length ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-warning">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> Még {missingLabels.length} adat hiányzik: {missingLabels.join(", ")}.
            </p>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" /> Minden kötelező adat megvan.
            </p>
          )}
          {[...checks, ...(aiIssues ?? [])].length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {[...checks, ...(aiIssues ?? [])].map((c, i) => (
                <li key={i} className={cn("flex items-start gap-2 rounded-xl px-3 py-2 text-sm", c.level === "error" ? "bg-danger-soft text-danger" : c.text.startsWith("✓") ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {c.text}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={reviewing}
            onClick={() =>
              startReview(async () => {
                if (dirty) await saveContractAction(draft.id, { body, extra }).catch(actionFailed);
                setDirty(false);
                const r = await aiReviewContractAction(draft.id).catch(actionFailed);
                if (!r.ok) toast({ message: r.error });
                else setAiIssues(r.issues);
              })
            }
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft"
          >
            {reviewing ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} AI-ellenőrzés
          </button>
          {draft.note && <p className="mt-2 text-xs text-muted">{draft.note}</p>}
        </section>

        {GROUPS.map((group) => {
          const fields = draft.fields.filter((f) => f.group === group);
          if (!fields.length) return null;
          return (
            <section key={group} className="rounded-3xl border border-border bg-background p-5">
              <h2 className="mb-3 text-sm font-medium text-ink">{group}</h2>
              <div className="flex flex-col gap-3">
                {fields.map((f) => {
                  const v = valueOf(f.key);
                  const gap = missing.includes(f.key);
                  const fromRecord = !(f.key in extra) && Boolean(draft.values[f.key]);
                  return (
                    <label key={f.key} className="flex flex-col gap-1 text-xs text-muted">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn(gap && "font-medium text-warning")}>
                          {f.label}
                          {f.required && " *"}
                        </span>
                        {fromRecord && <span className="text-[10px] text-subtle">a rekordból</span>}
                      </span>
                      {f.options ? (
                        <select value={v} onChange={(e) => set(f.key, e.target.value)} className={cn("h-9 rounded-xl border bg-background px-2 text-sm text-ink", gap ? "border-warning" : "border-border")}>
                          <option value="">Válassz…</option>
                          {f.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={v}
                          onChange={(e) => set(f.key, e.target.value)}
                          className={cn("h-9 rounded-xl border bg-background px-3 text-sm text-ink focus:border-ink focus:outline-none", gap ? "border-warning bg-warning-soft/30" : "border-border")}
                        />
                      )}
                      {f.hint && <span className="text-[11px] text-subtle">{f.hint}</span>}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </aside>

      <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-background">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="text-sm font-medium text-ink">{editing ? "A szerződés szövege" : "Előnézet"}</span>
          <span className="text-xs text-muted">{editing ? "Írj bele, mint egy Word-dokumentumba. A kék címkék az adatok." : "A sárgával jelölt részek még hiányoznak."}</span>
          <button type="button" onClick={() => setEditing((e) => !e)} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-ink hover:bg-surface">
            <PencilLine className="size-3.5" /> {editing ? "Előnézet" : "Szöveg szerkesztése"}
          </button>
        </div>
        {editing ? (
          <RichTemplateEditor
            value={body}
            onChange={(next) => {
              setBody(next);
              setDirty(true);
            }}
            // A filled field shows its value, so the text reads like the finished contract.
            fields={draft.fields.map((f) => ({ key: f.key, label: valueOf(f.key).trim() || f.label, group: f.group }))}
            ai={false}
            minHeight="40rem"
            ariaLabel="A szerződés szövege"
            className="rounded-none border-0"
          />
        ) : (
          <article
            className={PAPER}
            // Built from escaped text on the server (contracts/render.ts).
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/90 py-4 pr-[5.5rem] pl-4 backdrop-blur sm:-mx-8 sm:pr-24 sm:pl-8 xl:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/contracts" className="text-sm text-muted hover:text-ink">
            ← Szerződések
          </Link>
          <ConfirmAction
            action={deleteContractAction.bind(null, draft.id)}
            trigger={
              <>
                <Trash2 /> Törlés
              </>
            }
            size="sm"
            tone="danger"
            title="Törlöd a tervezetet?"
            description="A már jóváhagyott Word-fájl megmarad a Dokumentumok között."
            confirmLabel="Törlés"
          />
          {documentUrl && draft.status === "approved" && !dirty && (
            <a href={documentUrl} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-success hover:bg-success-soft">
              <Download className="size-4" /> Word letöltése
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => save()} disabled={saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Mentés
          </Button>
          {draft.status === "approved" && !dirty ? (
            <Button variant="secondary" onClick={() => printContract(html)}>
              <Printer /> Nyomtatás
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => approve(() => setTimeout(() => printContract(html), 50))}
              disabled={approving || saving || missing.length > 0 || errors.length > 0}
              title={missing.length ? "Előbb töltsd ki a hiányzó adatokat" : undefined}
            >
              <Printer /> Jóváhagyás és nyomtatás
            </Button>
          )}
          <Button onClick={() => approve()} disabled={approving || saving || missing.length > 0 || errors.length > 0} title={missing.length ? "Előbb töltsd ki a hiányzó adatokat" : undefined}>
            {approving ? <Loader2 className="animate-spin" /> : <FileCheck2 />} Jóváhagyás és Word
          </Button>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted xl:col-span-2">
        <Sparkles className="size-3.5" /> A szöveg kiindulópont, nem jogi tanács. Aláírás előtt mindig olvasd el; adásvételhez ügyvédi ellenjegyzés kell.
      </p>
    </div>
  );
}
