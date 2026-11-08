"use client";

import { FileUp, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { resetContractTemplateAction, saveContractTemplateAction } from "@/app/(app)/(dokumentumok)/contracts/actions";
import { RichTemplateEditor, type EditorField } from "@/components/rich-template/rich-template-editor";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { ContractField, CustomField } from "@/lib/contracts/kinds";

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
};

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
export function ContractTemplateEditor({ kind, label, defaultBody, office, fields, knownKeys, moneyKeys, canEdit }: Props) {
  const router = useRouter();
  const [body, setBody] = useState(office?.body ?? defaultBody);
  const [labels, setLabels] = useState<CustomField[]>(office?.customFields ?? []);
  const [sourceName, setSourceName] = useState<string | null>(office?.sourceName ?? null);
  const [notes, setNotes] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();
  const [resetting, startReset] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const known = useMemo(() => new Set(knownKeys), [knownKeys]);
  const ownKeys = useMemo(() => keysIn(body).filter((k) => !known.has(k)), [body, known]);
  const labelOf = (key: string) => labels.find((l) => l.key === key)?.label ?? "";

  const edit = (next: string) => {
    setBody(next);
    setDirty(true);
  };
  const setLabel = (key: string, value: string) => {
    setLabels((ls) => [...ls.filter((l) => l.key !== key), { key, label: value }]);
    setDirty(true);
  };
  const newField = (name: string) => {
    const key = keyFor(name);
    if (!key) return null;
    setLabels((ls) => [...ls.filter((l) => l.key !== key), { key, label: name }]);
    return key;
  };
  // The editor's field list: the contract's own, amounts also with their words, then the office's own fields.
  const editorFields = useMemo<EditorField[]>(
    () => [
      ...fields.flatMap((f) => [
        { key: f.key, label: f.label, group: f.group },
        ...(moneyKeys.includes(f.key) ? [{ key: `${f.key}_szoveg`, label: `${f.label} – számmal és betűvel`, group: f.group }] : []),
      ]),
      ...[...new Set([...ownKeys, ...labels.map((l) => l.key)])].map((k) => ({ key: k, label: labelOf(k) || k.replace(/_/g, " "), group: "Az iroda saját mezői" })),
    ],
    [fields, moneyKeys, ownKeys, labels], // eslint-disable-line react-hooks/exhaustive-deps
  );

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

      <div className="flex min-w-0 flex-col gap-2">
        <RichTemplateEditor value={body} onChange={edit} fields={editorFields} onNewField={newField} readOnly={!canEdit} minHeight="40rem" ariaLabel="A szerződés szövege" />
        <p className="px-2 text-xs text-muted">A kék címkék a mezők – a tervezetben az ügylet, az ingatlan és az ügyfelek adatai kerülnek a helyükre. Az AI-bekezdést Flavio írja meg esetenként; dupla kattintással módosíthatod, mit írjon.</p>
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
