"use client";

import { Bold, Braces, Heading1, Heading2, List, Loader2, Save, Sparkles, Trash2, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteTemplateAction, generateDocumentAction, previewTemplateAction, saveTemplateAction } from "@/app/(app)/documents/template-actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { OfficeFolder } from "@/lib/office-docs/data";
import { FIELD_HELP } from "@/lib/office-docs/fields";
import type { DocumentTemplate, Trigger } from "@/lib/office-docs/templates";
import { RecordSearch, recordIcons, type RecordHit } from "./record-search";

const triggerOptions: { value: Trigger; label: string; hint: string }[] = [
  { value: "manual", label: "Csak kézzel", hint: "Az ügyfél, ingatlan vagy ügylet oldalán indítod." },
  { value: "client_created", label: "Új ügyfélnél magától", hint: "Amikor új ügyfél kerül be (űrlap, rögzítés), elkészül és az ügyfélhez kerül." },
  { value: "deal_created", label: "Új ügyletnél magától", hint: "Amikor ügylet indul, elkészül, és az ügylethez, a vevőhöz és az ingatlanhoz kerül." },
];

/** Write a template, see it filled, try it on a record, and choose when it runs by itself. */
export function TemplateEditor({ template, folders }: { template: DocumentTemplate | null; folders: OfficeFolder[] }) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [trigger, setTrigger] = useState<Trigger>(template?.trigger ?? "manual");
  const [folderId, setFolderId] = useState<string | null>(template?.folderId ?? null);
  const [active, setActive] = useState(template?.active ?? true);
  const [sample, setSample] = useState<RecordHit | null>(null);
  const [picking, setPicking] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [saving, startSave] = useTransition();
  const [making, startMake] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const readOnly = template != null && !template.canEdit;

  // The preview follows the text (fields filled from the sample record; AI paragraphs shown as placeholders).
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void previewTemplateAction(body, sample, false).then((h) => live && setHtml(h));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [body, sample]);

  /** Wraps the selection (or inserts at the cursor). */
  function insert(before: string, after = "", placeholder = "") {
    const el = box.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const chosen = body.slice(a, b) || placeholder;
    const next = `${body.slice(0, a)}${before}${chosen}${after}${body.slice(b)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + chosen.length);
    });
  }
  const lineStart = (prefix: string) => {
    const el = box.current;
    if (!el) return;
    const a = body.lastIndexOf("\n", el.selectionStart - 1) + 1;
    setBody(`${body.slice(0, a)}${prefix}${body.slice(a)}`);
    requestAnimationFrame(() => el.focus());
  };

  function save() {
    startSave(async () => {
      const r = await saveTemplateAction(template?.id ?? null, { name, body, trigger, folderId, active }).catch(actionFailed);
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      toast({ message: "Sablon elmentve." });
      if (!template && "id" in r) router.replace(`/documents/templates/${r.id}`);
    });
  }

  function previewWithAi() {
    setPreviewing(true);
    void previewTemplateAction(body, sample, true)
      .then(setHtml)
      .finally(() => setPreviewing(false));
  }

  function make() {
    if (!template || !sample) return;
    startMake(async () => {
      const r = await generateDocumentAction(template.id, sample).catch(actionFailed);
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      toast({ message: `Elkészült: ${r.title} – megtalálod a Dokumentumok között.` });
    });
  }

  const tool = "grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink";
  const SampleIcon = sample ? recordIcons[sample.kind] : null;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 rounded-3xl border border-border bg-background p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          A sablon neve
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} maxLength={120} placeholder="Pl. Bemutatkozó levél vevőnek" className="h-10 rounded-xl border border-border px-3 text-sm text-ink focus:border-ink focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Mikor készüljön?
          <select value={trigger} onChange={(e) => setTrigger(e.target.value as Trigger)} disabled={readOnly} className="h-10 rounded-xl border border-border px-2 text-sm text-ink">
            {triggerOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Melyik mappába?
          <select value={folderId ?? ""} onChange={(e) => setFolderId(e.target.value || null)} disabled={readOnly} className="h-10 rounded-xl border border-border px-2 text-sm text-ink">
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value="">Egyéb</option>
          </select>
        </label>
        <p className="text-xs text-muted sm:col-span-2 lg:col-span-3">{triggerOptions.find((o) => o.value === trigger)?.hint}</p>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={readOnly} className="size-4 accent-[var(--primary)]" /> Bekapcsolva
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="flex flex-col overflow-hidden rounded-3xl border border-border bg-background">
          <div className="relative flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
            <button type="button" className={tool} onClick={() => lineStart("# ")} title="Címsor" aria-label="Címsor">
              <Heading1 className="size-4" />
            </button>
            <button type="button" className={tool} onClick={() => lineStart("## ")} title="Alcím" aria-label="Alcím">
              <Heading2 className="size-4" />
            </button>
            <button type="button" className={tool} onClick={() => insert("**", "**", "félkövér")} title="Félkövér" aria-label="Félkövér">
              <Bold className="size-4" />
            </button>
            <button type="button" className={tool} onClick={() => lineStart("- ")} title="Felsorolás" aria-label="Felsorolás">
              <List className="size-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-border" />
            <button type="button" onClick={() => setFieldsOpen((o) => !o)} aria-expanded={fieldsOpen} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink hover:bg-surface">
              <Braces className="size-4" /> Mező beszúrása
            </button>
            <button type="button" onClick={() => insert("\n[[AI: ", "]]\n", "írj egy rövid, barátságos bekezdést…")} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-accent hover:bg-accent-soft">
              <Sparkles className="size-4" /> AI-bekezdés
            </button>
            {fieldsOpen && (
              <div className="pop-in absolute top-full left-2 z-30 mt-1 grid max-h-72 w-80 grid-cols-1 overflow-y-auto rounded-2xl border border-border bg-background p-1.5 shadow-float [--pop-from:-4px]">
                {FIELD_HELP.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      insert(`{${f.key}}`);
                      setFieldsOpen(false);
                    }}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-left text-sm hover:bg-surface"
                  >
                    <span className="text-ink">{f.label}</span>
                    <span className="font-mono text-[11px] text-subtle">{`{${f.key}}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            ref={box}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            readOnly={readOnly}
            spellCheck
            placeholder={"# Címsor\n\nKedves {vevo_nev}!\n\n[[AI: írj két mondatot arról, miért illik hozzá az ingatlan]]\n\n- **Ár:** {ingatlan_ar}"}
            className="min-h-[28rem] flex-1 resize-y px-5 py-4 font-mono text-[13px] leading-relaxed text-ink focus:outline-none"
            aria-label="A sablon szövege"
          />
          <p className="border-t border-border px-5 py-2.5 text-xs text-muted">
            # címsor · ## alcím · **félkövér** · - felsorolás · {"{mező}"} az adatokból · [[AI: utasítás]] – ezt a bekezdést az AI írja meg, csak a rekord adataiból.
          </p>
        </section>

        <section className="flex flex-col overflow-hidden rounded-3xl border border-border bg-background">
          <div className="relative flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
            <span className="text-xs text-muted">Előnézet:</span>
            {sample && SampleIcon ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface py-0.5 pr-1 pl-2 text-xs text-ink">
                <SampleIcon className="size-3 text-accent" /> <span className="max-w-48 truncate">{sample.title}</span>
                <button type="button" onClick={() => setSample(null)} className="grid size-4 place-items-center rounded-full text-subtle hover:text-ink" aria-label="Minta elvetése">
                  <X className="size-3" />
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setPicking((p) => !p)} className="rounded-full px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft">
                Válassz ügyfelet, ingatlant vagy ügyletet
              </button>
            )}
            <button type="button" onClick={previewWithAi} disabled={previewing} className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
              {previewing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} AI-val is
            </button>
            {picking && (
              <div className="pop-in absolute top-full left-2 z-30 mt-1 w-80 rounded-2xl border border-border bg-background p-2 shadow-float [--pop-from:-4px]">
                <RecordSearch
                  onClose={() => setPicking(false)}
                  onPick={(r) => {
                    setSample(r);
                    setPicking(false);
                  }}
                />
              </div>
            )}
          </div>
          <article
            className={cn(
              "min-h-[28rem] flex-1 px-8 py-7 text-[14px] leading-relaxed text-text",
              "[&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-medium [&_h1]:text-ink [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-ink",
            )}
            // The preview is built from escaped text by template-render.ts.
            dangerouslySetInnerHTML={{ __html: html || "<p style='color:var(--subtle)'>Az előnézet itt jelenik meg.</p>" }}
          />
        </section>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/90 py-4 pr-[5.5rem] pl-4 backdrop-blur sm:-mx-8 sm:pr-24 sm:pl-8">
        <div className="flex items-center gap-2">
          <Link href="/documents/templates" className="text-sm text-muted hover:text-ink">
            ← Sablonok
          </Link>
          {template?.canEdit && (
            <ConfirmAction
              action={deleteTemplateAction.bind(null, template.id)}
              trigger={
                <>
                  <Trash2 /> Törlés
                </>
              }
              size="sm"
              tone="danger"
              title="Törlöd a sablont?"
              description="A belőle már elkészült dokumentumok megmaradnak a Dokumentumok között."
              confirmLabel="Törlés"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {template && (
            <Button variant="secondary" onClick={make} disabled={!sample || making} title={sample ? undefined : "Előbb válassz mintát az előnézethez"}>
              {making ? <Loader2 className="animate-spin" /> : <Wand2 />} Dokumentum készítése
            </Button>
          )}
          {!readOnly && (
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Mentés
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
