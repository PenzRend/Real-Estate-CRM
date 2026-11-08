"use client";

import { Loader2, Plus, Sparkles, Trash2, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { addEmailStartersAction, deleteEmailTemplateAction, saveEmailTemplateAction, toggleEmailTemplateAction } from "@/app/(app)/inbox/automation-actions";
import { RichTemplateEditor } from "@/components/rich-template/rich-template-editor";
import { Badge } from "@/components/ui/badge";
import { useOneOpen } from "@/components/ui/one-open";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import type { EmailTemplate, EmailTrigger } from "@/lib/email-auto/templates";

const TRIGGERS: { value: EmailTrigger; label: string }[] = [
  { value: "client_created", label: "Új ügyfél érkezésekor" },
  { value: "viewing_booked", label: "Megtekintés foglalásakor" },
  { value: "viewing_completed", label: "Megtekintés után" },
  { value: "deal_created", label: "Ügylet indulásakor" },
  { value: "deal_won", label: "Sikeres lezáráskor" },
  { value: "no_contact", label: "Ha egy ügyféllel régóta nem beszéltünk" },
  { value: "listing_match", label: "Új ingatlan, ami illik hozzá" },
  { value: "price_drop", label: "Árcsökkenés egy megnézett ingatlanon" },
  { value: "manual", label: "Csak kézzel (kikapcsolt szabály)" },
];
const triggerLabel = (t: EmailTrigger) => TRIGGERS.find((x) => x.value === t)?.label ?? t;

const DELAYS = [
  { value: 0, label: "azonnal" },
  { value: 10, label: "10 perc múlva" },
  { value: 60, label: "1 óra múlva" },
  { value: 120, label: "2 óra múlva" },
  { value: 1440, label: "másnap" },
  { value: 4320, label: "3 nap múlva" },
];
const delayLabel = (m: number) => DELAYS.find((d) => d.value === m)?.label ?? (m < 60 ? `${m} perc múlva` : m < 1440 ? `${Math.round(m / 60)} óra múlva` : `${Math.round(m / 1440)} nap múlva`);

const FIELDS = [
  ["keresztnev", "Keresztnév"],
  ["vevo_nev", "Ügyfél neve"],
  ["ingatlan_megnevezes", "Ingatlan"],
  ["ingatlan_cim", "Ingatlan címe"],
  ["ingatlan_ar", "Irányár"],
  ["ingatlan_link", "Link az ingatlanhoz"],
  ["korabbi_ar", "Korábbi ár (árcsökkenésnél)"],
  ["megtekintes_ideje", "Megtekintés ideje"],
  ["ugynok_nev", "Saját név"],
  ["ugynok_email", "Saját e-mail"],
  ["iroda", "Iroda"],
] as const;

type Draft = Omit<EmailTemplate, "id" | "canEdit">;
const blank: Draft = { name: "", subject: "", body: "Kedves {keresztnev}!\n\n\n\nÜdvözlettel,\n{ugynok_nev}", trigger: "client_created", delayMinutes: 0, noContactDays: null, mode: "approve", active: true };

const input = "h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-ink focus:border-ink focus:outline-none";

function Editor({ id, initial, onDone }: { id: string | null; initial: Draft; onDone: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, start] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <div className="reveal flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Név
          <input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="pl. Üdvözlő levél" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Mikor menjen?
          <select value={d.trigger} onChange={(e) => set("trigger", e.target.value as EmailTrigger)} className={input}>
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {d.trigger === "no_contact" ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Hány nap csend után?
            <input type="number" min={1} max={365} value={d.noContactDays ?? 21} onChange={(e) => set("noContactDays", Number(e.target.value))} className={input} />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Késleltetés
            <select value={d.delayMinutes} onChange={(e) => set("delayMinutes", Number(e.target.value))} className={input}>
              {(DELAYS.some((x) => x.value === d.delayMinutes) ? DELAYS : [...DELAYS, { value: d.delayMinutes, label: delayLabel(d.delayMinutes) }]).map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset className="flex flex-col gap-1 text-xs text-muted">
          <legend className="mb-1">Küldés módja</legend>
          <div className="flex gap-1 rounded-xl border border-border bg-background p-1">
            {(
              [
                ["approve", "Előbb átnézem"],
                ["auto", "Magától megy"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" onClick={() => set("mode", v)} className={cn("flex-1 rounded-lg px-2 py-1 text-xs font-medium", d.mode === v ? "bg-ink text-background" : "text-muted hover:text-ink")}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Tárgy
        <input value={d.subject} onChange={(e) => set("subject", e.target.value)} className={input} />
      </label>
      <div className="flex flex-col gap-1 text-xs text-muted">
        Szöveg
        <RichTemplateEditor value={d.body} onChange={(v) => set("body", v)} fields={FIELDS.map(([key, label]) => ({ key, label }))} formatting={false} minHeight="14rem" ariaLabel="A levél szövege" className="rounded-2xl" />
      </div>
      <p className="text-xs text-muted">A kék címkék az ügyfél és az ingatlan adataival töltődnek ki. Az AI-bekezdést Flavio írja meg ügyfelenként; személyes azonosító adatot nem kap.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await saveEmailTemplateAction(id, d).catch(actionFailed);
              if (!r.ok) {
                toast({ message: r.error });
                return;
              }
              toast({ message: d.active ? "Mentve – a szabály él." : "Mentve." });
              onDone();
            })
          }
        >
          {busy && <Loader2 className="animate-spin" />} Mentés
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setD(initial);
            onDone();
          }}
        >
          Mégse
        </Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} /> Bekapcsolva
        </label>
      </div>
    </div>
  );
}

function Rule({ t }: { t: EmailTemplate }) {
  const { open: editing, setOpen: setEditing, ref } = useOneOpen<HTMLLIElement>(`rule-${t.id}`);
  // Kept once opened, so closing it by clicking away keeps what was typed.
  const [opened, setOpened] = useState(false);
  if (editing && !opened) setOpened(true);
  return (
    <li ref={ref}>
      {opened && (
        <div className={cn("px-5 py-4", !editing && "hidden")}>
          <Editor id={t.id} initial={t} onDone={() => setEditing(false)} />
        </div>
      )}
      {!editing && <RuleRow t={t} onEdit={() => setEditing(true)} />}
    </li>
  );
}

function RuleRow({ t, onEdit }: { t: EmailTemplate; onEdit: () => void }) {
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", t.active ? "bg-accent-soft text-accent" : "bg-surface text-muted")}>
        <Zap className="size-4" />
      </span>
      <button type="button" onClick={() => t.canEdit && onEdit()} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-ink">{t.name}</span>
        <span className="block text-xs text-muted">
          {triggerLabel(t.trigger)} · {t.trigger === "no_contact" ? `${t.noContactDays ?? 21} nap csend után` : delayLabel(t.delayMinutes)}
        </span>
      </button>
      <Badge tone={t.mode === "auto" ? "accent" : "neutral"}>{t.mode === "auto" ? "Magától megy" : "Előbb átnézed"}</Badge>
      {t.canEdit && (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={t.active}
            aria-label={t.active ? "Kikapcsolás" : "Bekapcsolás"}
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await toggleEmailTemplateAction(t.id, !t.active).catch(actionFailed);
                toast({ message: r.ok ? (t.active ? "Kikapcsolva." : "Bekapcsolva – innentől magától dolgozik.") : r.error });
              })
            }
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", t.active ? "bg-accent" : "bg-border-strong")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", t.active ? "translate-x-5.5" : "translate-x-0.5")} />
          </button>
          <button
            type="button"
            aria-label="Törlés"
            disabled={busy}
            onClick={() => {
              if (confirm(`Törlöd a(z) „${t.name}” szabályt?`)) start(() => deleteEmailTemplateAction(t.id).catch(actionFailed).then(() => undefined));
            }}
            className="rounded-full p-1.5 text-muted hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}

/** The automatic email rules: when a message goes, after how long, and whether it waits for an OK. */
export function EmailRules({ templates }: { templates: EmailTemplate[] }) {
  const { open: adding, setOpen: setAdding, ref } = useOneOpen<HTMLDivElement>("rule-new");
  const [opened, setOpened] = useState(false);
  if (adding && !opened) setOpened(true);
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {templates.length > 0 && (
        <ul className="divide-y divide-border rounded-3xl border border-border bg-background">
          {templates.map((t) => (
            <Rule key={t.id} t={t} />
          ))}
        </ul>
      )}
      {opened && (
        <div ref={ref} className={cn(!adding && "hidden")}>
          <Editor id={null} initial={blank} onDone={() => setAdding(false)} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus /> Új szabály
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const n = await addEmailStartersAction().catch(actionFailed);
              toast({ message: typeof n === "number" && n > 0 ? `${n} kész szabály hozzáadva, kikapcsolva – nézd át, és kapcsold be, amelyik tetszik.` : "A kész szabályok már megvannak." });
            })
          }
        >
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Kész szabályok hozzáadása
        </Button>
      </div>
    </div>
  );
}
