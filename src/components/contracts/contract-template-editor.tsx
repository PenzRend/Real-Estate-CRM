"use client";

import { FileUp, Loader2, Plus, RotateCcw, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { previewContractTemplateAction, resetContractTemplateAction, saveContractTemplateAction } from "@/app/(app)/contracts/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { ContractField, CustomField, FieldGroup } from "@/lib/contracts/kinds";

type Props = {
  kind: string;
  label: string;
  defaultBody: string;
  office: { body: string; customFields: CustomField[]; sourceName: string | null; updatedAt: string } | null;
  fields: ContractField[];
  /** Every key some contract knows; anything else in the text is the office's own field. */
  knownKeys: string[];
  moneyKeys: string[];
  canEdit: boolean;
  initialHtml: string;
};

const GROUPS: FieldGroup[] = ["Felek", "Ingatlan", "Pénzügyek", "Iroda", "Egyéb"];
const keysIn = (body: string) => [...new Set([...body.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1].replace(/_szoveg$/, "")))];
const keyFor = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
const when = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });

/** An office's own wording for one contract: edit by hand, or upload its Word/PDF for the AI to rebuild as a template. */
export function ContractTemplateEditor({ kind, label, defaultBody, office, fields, knownKeys, moneyKeys, canEdit, initialHtml }: Props) {
  const router = useRouter();
  const [body, setBody] = useState(office?.body ?? defaultBody);
  const [labels, setLabels] = useState<CustomField[]>(office?.customFields ?? []);
  const [sourceName, setSourceName] = useState<string | null>(office?.sourceName ?? null);
  const [notes, setNotes] = useState<string[]>([]);
  const [html, setHtml] = useState(initialHtml);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();
  const [resetting, startReset] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const first = useRef(true);

  const known = useMemo(() => new Set(knownKeys), [knownKeys]);
  const ownKeys = useMemo(() => keysIn(body).filter((k) => !known.has(k)), [body, known]);
  const labelOf = (key: string) => labels.find((l) => l.key === key)?.label ?? "";

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      void previewContractTemplateAction(kind, body, labels).then((h) => h != null && setHtml(h));
    }, 350);
    return () => clearTimeout(t);
  }, [kind, body, labels]);

  const edit = (next: string) => {
    setBody(next);
    setDirty(true);
  };
  const insert = (text: string) => {
    const el = area.current;
    if (!el) return edit(body + text);
    const at = el.selectionStart ?? body.length;
    edit(body.slice(0, at) + text + body.slice(el.selectionEnd ?? at));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = at + text.length;
    });
  };
  const setLabel = (key: string, value: string) => {
    setLabels((ls) => [...ls.filter((l) => l.key !== key), { key, label: value }]);
    setDirty(true);
  };
  const newField = () => {
    const name = window.prompt("Az új mező neve (pl. Közös költség):")?.trim();
    if (!name) return;
    const key = keyFor(name);
    if (!key) return;
    setLabels((ls) => [...ls.filter((l) => l.key !== key), { key, label: name }]);
    insert(`{${key}}`);
  };

  async function upload(file: File) {
    setUploading(true);
    setNotes([]);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const res = await fetch("/api/contracts/template-import", { method: "POST", body: form });
      const r = (await res.json()) as { ok: true; body: string; customFields: CustomField[]; notes: string[]; sourceName: string } | { ok: false; error: string };
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      setBody(r.body);
      setLabels(r.customFields);
      setSourceName(r.sourceName);
      setNotes(r.notes);
      setDirty(true);
      toast({ message: "Kész – nézd át a szöveget és a mezőket, aztán mentsd." });
    } catch {
      toast({ message: "A feltöltés nem sikerült. Ellenőrizd az internetkapcsolatot, és próbáld újra." });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const save = () =>
    startSave(async () => {
      const r = await saveContractTemplateAction(kind, { body, customFields: labels, sourceName }).catch(actionFailed);
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      setDirty(false);
      toast({ message: `Mentve – az új ${label.toLowerCase()} tervezetek ezzel a szöveggel készülnek.` });
    });

  const reset = () => {
    if (!window.confirm("Visszaállítod Flavio alapszövegét? Az iroda saját szövege törlődik.")) return;
    startReset(async () => {
      const r = await resetContractTemplateAction(kind).catch(actionFailed);
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      setBody(defaultBody);
      setLabels([]);
      setSourceName(null);
      setNotes([]);
      setDirty(false);
      toast({ message: "Visszaállítva Flavio alapszövegére." });
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <section className="rounded-3xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-center gap-2">
            {office ? <Badge tone="accent">Saját szöveg</Badge> : <Badge tone="neutral">Flavio alapszövege</Badge>}
            {dirty && <Badge tone="warning">Nincs mentve</Badge>}
          </div>
          <p className="mt-2 text-xs text-muted">
            {office ? `${office.sourceName ? `Forrás: ${office.sourceName} · ` : ""}frissítve ${when.format(new Date(office.updatedAt))}` : "Az irodád még nem adott meg saját szöveget ehhez a szerződéshez."}
          </p>
          {!canEdit && <p className="mt-3 rounded-2xl bg-surface px-3 py-2 text-xs text-muted">A szöveget az iroda tulajdonosa vagy egy admin módosíthatja.</p>}
        </section>

        {canEdit && (
          <section
            className={cn("rounded-3xl border border-dashed border-border-strong bg-background p-5", uploading && "opacity-80")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f && !uploading) void upload(f);
            }}
          >
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
              <Sparkles className="size-4 text-accent" /> Van már saját szerződésetek?
            </h2>
            <p className="mt-1 text-xs text-muted">
              Töltsd fel Wordben vagy PDF-ben: Flavio sablonná írja át – a kitöltendő részekből mezők lesznek, a szöveg a tiétek marad. Lehetőleg üres mintát tölts fel; a személyi okmány-, adó- és bankszámlaszámokat, e-mail-címeket és telefonszámokat kivágjuk, mielőtt az AI látná.
            </p>
            <input ref={fileInput} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            <Button size="sm" variant="secondary" className="mt-3" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <FileUp />} {uploading ? "Flavio olvassa a szerződést… (fél perc is lehet)" : "Word vagy PDF feltöltése"}
            </Button>
          </section>
        )}

        {notes.length > 0 && (
          <section className="reveal rounded-3xl border border-accent/25 bg-accent-soft/40 p-5">
            <h2 className="text-sm font-medium text-ink">Amit Flavio csinált</h2>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs text-text">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </section>
        )}

        {canEdit && (
          <section className="rounded-3xl border border-border bg-background p-5">
            <h2 className="text-sm font-medium text-ink">Mezők beszúrása</h2>
            <p className="mt-1 text-xs text-muted">Kattints oda a szövegben, ahová kell, majd a mezőre. Az adatok az ügyletből, az ingatlanból és az ügyfelekből töltődnek ki.</p>
            <div className="mt-3 flex flex-col gap-3">
              {GROUPS.map((g) => {
                const list = fields.filter((f) => f.group === g);
                if (!list.length) return null;
                return (
                  <div key={g}>
                    <p className="mb-1.5 text-[11px] font-medium tracking-wide text-subtle uppercase">{g}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((f) => (
                        <button key={f.key} type="button" onClick={() => insert(`{${moneyKeys.includes(f.key) ? `${f.key}_szoveg` : f.key}}`)} title={`{${f.key}}`} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-ink hover:bg-surface-strong">
                          {f.label}
                          {moneyKeys.includes(f.key) && <span className="text-muted"> + betűvel</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <button type="button" onClick={newField} className="inline-flex w-fit items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                <Plus className="size-3" /> Új mező
              </button>
            </div>
          </section>
        )}

        {ownKeys.length > 0 && (
          <section className="rounded-3xl border border-border bg-background p-5">
            <h2 className="text-sm font-medium text-ink">Az iroda saját mezői</h2>
            <p className="mt-1 text-xs text-muted">Ezeket az ingatlanos tölti ki a tervezet átnézésekor. Itt adhatsz nekik érthető nevet.</p>
            <div className="mt-3 flex flex-col gap-2">
              {ownKeys.map((k) => (
                <label key={k} className="flex flex-col gap-1 text-xs text-muted">
                  <code className="text-[11px]">{`{${k}}`}</code>
                  <input
                    value={labelOf(k)}
                    readOnly={!canEdit}
                    onChange={(e) => setLabel(k, e.target.value)}
                    placeholder={k.replace(/_/g, " ")}
                    className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-ink focus:border-ink focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-background">
            <h2 className="border-b border-border px-5 py-3 text-sm font-medium text-ink">Szöveg</h2>
            <textarea
              ref={area}
              value={body}
              readOnly={!canEdit}
              onChange={(e) => edit(e.target.value)}
              aria-label="A szerződés szövege"
              spellCheck={false}
              className="min-h-[36rem] flex-1 resize-y px-5 py-4 font-mono text-[13px] leading-relaxed text-ink focus:outline-none"
            />
            <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted"># cím · ## alcím · **félkövér** · - felsorolás · {"{mező}"} · [[AI: utasítás]] esetenként megírt bekezdés</p>
          </section>
          <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-background">
            <h2 className="border-b border-border px-5 py-3 text-sm font-medium text-ink">Előnézet</h2>
            <article
              className={cn(
                "min-h-[36rem] flex-1 px-8 py-8 font-serif text-[14.5px] leading-relaxed text-text",
                "[&_em]:text-muted [&_h1]:mb-1 [&_h1]:text-center [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-ink",
                "[&_mark]:rounded [&_mark]:bg-accent-soft [&_mark]:px-1 [&_mark]:font-sans [&_mark]:text-[12px] [&_mark]:font-medium [&_mark]:text-accent",
              )}
              // Built from escaped text on the server (contracts/render.ts).
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </section>
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur xl:col-span-2">
        <div className="flex items-center gap-2">
          <Link href="/contracts" className={buttonClasses("ghost", "sm")}>
            Vissza
          </Link>
          {canEdit && office && (
            <Button size="sm" variant="ghost" onClick={reset} disabled={resetting}>
              {resetting ? <Loader2 className="animate-spin" /> : <RotateCcw />} Flavio alapszövege
            </Button>
          )}
        </div>
        {canEdit && (
          <Button onClick={save} disabled={saving || !dirty || !body.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Mentés
          </Button>
        )}
      </div>
    </div>
  );
}
