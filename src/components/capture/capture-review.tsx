"use client";

import { AlertTriangle, ArrowLeft, CalendarClock, CircleAlert, ListChecks, Sparkles, UserPlus, UserRound } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { saveCaptureAction } from "@/app/(app)/interactions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { CaptureExtraction } from "@/lib/ai/capture-schema";
import { cn } from "@/lib/cn";
import type { ClientSnapshot, Option } from "@/lib/db/activity";
import { formatDateTime } from "@/lib/i18n/format";
import { clientTypeLabels, interactionTypeLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import type { CaptureSave, ClientUpdates } from "@/lib/validation/activity";
import { localFrom, outcomeText, proposedFields, toUpdateValue, type ProposedField, type UpdateKey } from "@/lib/capture/review";

type FieldState = { checked: boolean; value: string };

export function CaptureReview({
  transcript,
  extraction: x,
  candidates,
  properties,
  initialPropertyId,
  pinnedClientId,
  onBack,
  emailId,
  occurredAt,
  doubtfulKeys = [],
}: {
  transcript: string;
  extraction: CaptureExtraction;
  candidates: ClientSnapshot[];
  properties: Option[];
  initialPropertyId?: string | null;
  pinnedClientId?: string | null;
  onBack: () => void;
  /** Set when processing an imported email: marks it processed on save. */
  emailId?: string | null;
  /** When the conversation happened (e.g. the email's date); defaults to now. */
  occurredAt?: string | null;
  /** Fields that may describe the listing rather than the client's wishes: shown, but not ticked by default. */
  doubtfulKeys?: UpdateKey[];
}) {
  const [clientChoice, setClientChoice] = useState<string>(
    candidates.find((c) => c.id === pinnedClientId)?.id ?? candidates[0]?.id ?? "new",
  );
  const [newName, setNewName] = useState(x.client.full_name ?? "");
  const [newType, setNewType] = useState<string>(x.client.client_type ?? "buyer");
  const [interactionType, setInteractionType] = useState<string>(x.interaction_type);
  const [occurredLocal, setOccurredLocal] = useState(() => utcToZonedLocal(occurredAt ?? new Date().toISOString()));
  const [summary, setSummary] = useState(x.summary);
  const [outcome, setOutcome] = useState(() => outcomeText(x));
  const [propertyId, setPropertyId] = useState(initialPropertyId ?? "");
  const [followUp, setFollowUp] = useState({ checked: Boolean(x.follow_up_date), value: localFrom(x.follow_up_date, x.follow_up_time) });
  const [tasks, setTasks] = useState(() =>
    x.tasks.map((t) => ({ checked: true, title: t.title, due: localFrom(t.due_date, t.due_time) })),
  );
  const [overrides, setOverrides] = useState<Record<string, Partial<Record<UpdateKey, FieldState>>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const selected = candidates.find((c) => c.id === clientChoice) ?? null;
  const fields = useMemo(() => proposedFields(x, selected), [x, selected]);
  const stateOf = (f: ProposedField): FieldState =>
    overrides[clientChoice]?.[f.key] ?? { checked: !f.conflict && !doubtfulKeys.includes(f.key), value: f.proposed };
  const setField = (key: UpdateKey, next: FieldState) =>
    setOverrides((o) => ({ ...o, [clientChoice]: { ...o[clientChoice], [key]: next } }));

  const conflicts = fields.filter((f) => f.conflict).length;
  const nothingFound = !fields.length && !x.tasks.length && !x.follow_up_date;

  function save() {
    setError(null);
    const updates: Record<string, unknown> = {};
    for (const f of fields) {
      const s = stateOf(f);
      if (!s.checked) continue;
      const v = toUpdateValue(f, s.value);
      if (!v.ok) return setError(v.error);
      updates[f.key] = v.value;
    }
    const occurredAt = zonedLocalToUtc(occurredLocal);
    if (!occurredAt) return setError("Add meg a beszélgetés időpontját.");
    let nextFollowUp: string | null = null;
    if (followUp.checked && followUp.value) {
      nextFollowUp = zonedLocalToUtc(followUp.value);
      if (!nextFollowUp) return setError("Az utánkövetés időpontja érvénytelen.");
    }
    const taskPayload = [];
    for (const t of tasks.filter((t) => t.checked && t.title.trim())) {
      const due = t.due ? zonedLocalToUtc(t.due) : null;
      if (t.due && !due) return setError(`Érvénytelen határidő: ${t.title}`);
      taskPayload.push({ title: t.title.trim(), due_at: due });
    }
    if (clientChoice === "new" && !newName.trim()) return setError("Add meg az új ügyfél nevét.");

    const payload: CaptureSave = {
      transcript,
      interaction_type: interactionType as CaptureSave["interaction_type"],
      occurred_at: occurredAt,
      summary: summary.trim(),
      outcome: outcome.trim() || null,
      property_id: propertyId || null,
      client:
        clientChoice === "new"
          ? { mode: "new", full_name: newName.trim(), client_type: newType as "buyer" }
          : { mode: "existing", id: clientChoice },
      updates: updates as ClientUpdates,
      next_follow_up_at: nextFollowUp,
      tasks: taskPayload,
      email_id: emailId ?? null,
    };
    startSaving(async () => {
      // Redirects to the client page on success.
      const result = await saveCaptureAction(payload);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Vissza a jegyzethez
        </button>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Sparkles className="size-4 text-accent" />
          Ellenőrizd, javítsd, majd mentsd. Semmi nem kerül mentésre a jóváhagyásod nélkül.
        </p>
      </div>

      {/* Client */}
      <Card>
        <CardHeader title="Melyik ügyfél?" />
        <div className="flex flex-col gap-2 p-4">
          {candidates.map((c) => (
            <label
              key={c.id}
              className={cn(
                "flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm transition-colors",
                clientChoice === c.id ? "border-ink bg-surface" : "border-border hover:border-border-strong",
              )}
            >
              <input type="radio" name="client" checked={clientChoice === c.id} onChange={() => setClientChoice(c.id)} className="accent-[var(--primary)]" />
              <UserRound className="size-4 text-muted" />
              <span className="font-medium text-ink">{c.full_name}</span>
              <span className="min-w-0 truncate text-muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
              {c.id === pinnedClientId && <Badge tone="accent">Erről az adatlapról</Badge>}
            </label>
          ))}
          <label
            className={cn(
              "flex cursor-pointer flex-col gap-3 rounded-xl border px-4 py-3 text-sm transition-colors sm:flex-row sm:items-center",
              clientChoice === "new" ? "border-ink bg-surface" : "border-border hover:border-border-strong",
            )}
          >
            <span className="flex items-center gap-3">
              <input type="radio" name="client" checked={clientChoice === "new"} onChange={() => setClientChoice("new")} className="accent-[var(--primary)]" />
              <UserPlus className="size-4 text-muted" />
              <span className="font-medium whitespace-nowrap text-ink">Új ügyfél</span>
            </span>
            {clientChoice === "new" && (
              <span className="flex flex-1 flex-col gap-2 sm:flex-row">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Teljes név" aria-label="Új ügyfél neve" className="h-10 flex-1" />
                <Select value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="Ügyféltípus" className="h-10 sm:w-40">
                  {Object.entries(clientTypeLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </span>
            )}
          </label>
          {!candidates.length && x.client.full_name && (
            <p className="px-1 text-xs text-muted">Nem találtunk „{x.client.full_name}” nevű ügyfelet, ezért újként vesszük fel.</p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Requirements */}
          <Card>
            <CardHeader
              title="Ügyféladatok frissítése"
              count={fields.length}
              action={conflicts ? <Badge tone="warning"><AlertTriangle className="size-3" /> {conflicts} eltérés</Badge> : undefined}
            />
            {fields.length ? (
              <ul className="divide-y divide-border">
                {fields.map((f) => {
                  const s = stateOf(f);
                  return (
                    <li key={f.key} className={cn("grid gap-2 px-5 py-3.5 sm:grid-cols-[auto_1fr_1.3fr] sm:items-center", f.conflict && "bg-warning-soft/40")}>
                      <input
                        type="checkbox"
                        checked={s.checked}
                        onChange={(e) => setField(f.key, { ...s, checked: e.target.checked })}
                        aria-label={`${f.label} frissítése`}
                        className="size-4 accent-[var(--primary)]"
                      />
                      <div className="text-sm">
                        <p className="font-medium text-ink">{f.label}</p>
                        <p className={cn("text-xs", f.conflict ? "text-warning" : "text-muted")}>
                          {f.current ? `Most: ${f.current}` : "Most: üres"}
                          {!f.conflict && doubtfulKeys.includes(f.key) && " · a hirdetésből? – ellenőrizd"}
                          {f.conflict && " · eltér, csak jelölve írjuk felül"}
                        </p>
                      </div>
                      {f.kind === "types" ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(propertyTypeLabels).map(([k, l]) => {
                            const list = s.value.split(",").filter(Boolean);
                            const on = list.includes(k);
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() =>
                                  setField(f.key, { checked: true, value: (on ? list.filter((t) => t !== k) : [...list, k]).join(",") })
                                }
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs",
                                  on ? "border-ink bg-primary text-white" : "border-border-strong text-muted hover:text-ink",
                                )}
                              >
                                {l}
                              </button>
                            );
                          })}
                        </div>
                      ) : f.kind === "text" ? (
                        <Textarea
                          value={s.value}
                          onChange={(e) => setField(f.key, { checked: true, value: e.target.value })}
                          aria-label={f.label}
                          className="min-h-20 text-sm"
                        />
                      ) : (
                        <Input
                          type={f.kind === "date" ? "date" : "text"}
                          inputMode={f.kind === "money" || f.kind === "number" || f.kind === "int" ? "decimal" : undefined}
                          value={s.value}
                          onChange={(e) => setField(f.key, { checked: true, value: e.target.value })}
                          aria-label={f.label}
                          className="h-10"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">
                {nothingFound ? "A jegyzetben nem találtunk új ügyféladatot." : "Nincs új adat az ügyfélhez; minden egyezik a mentettekkel."}
              </p>
            )}
          </Card>

          {/* Tasks + follow-up */}
          <Card>
            <CardHeader title="Feladatok" count={tasks.length} action={<ListChecks className="size-4 text-subtle" />} />
            <div className="flex flex-col gap-2 p-4">
              <label className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center">
                <span className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={followUp.checked}
                    onChange={(e) => setFollowUp({ ...followUp, checked: e.target.checked })}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <CalendarClock className="size-4 text-muted" />
                  <span className="font-medium text-ink">Következő utánkövetés</span>
                </span>
                <Input
                  type="datetime-local"
                  value={followUp.value}
                  onChange={(e) => setFollowUp({ checked: true, value: e.target.value })}
                  aria-label="Utánkövetés időpontja"
                  className="h-10 sm:ml-auto sm:w-56"
                />
              </label>
              {selected?.next_follow_up_at && followUp.checked && followUp.value && (
                <p className="px-1 text-xs text-warning">
                  Már van beállítva utánkövetés: {formatDateTime(selected.next_follow_up_at)}. Mentéskor erre cseréljük.
                </p>
              )}
              {tasks.map((t, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center">
                  <input
                    type="checkbox"
                    checked={t.checked}
                    onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                    aria-label={`${t.title} létrehozása`}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <Input
                    value={t.title}
                    onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    aria-label="Feladat"
                    className="h-10 flex-1"
                  />
                  <Input
                    type="datetime-local"
                    value={t.due}
                    onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))}
                    aria-label="Határidő"
                    className="h-10 sm:w-56"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTasks([...tasks, { checked: true, title: "", due: "" }])}
                className="w-fit px-1 text-sm font-medium text-muted hover:text-ink"
              >
                + Feladat hozzáadása
              </button>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* Conversation */}
          <Card>
            <CardHeader title="Beszélgetés" />
            <div className="flex flex-col gap-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Típus" htmlFor="cap_type">
                  <Select id="cap_type" value={interactionType} onChange={(e) => setInteractionType(e.target.value)} className="h-10">
                    {Object.entries(interactionTypeLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                </Field>
                <Field label="Időpont" htmlFor="cap_when">
                  <Input id="cap_when" type="datetime-local" value={occurredLocal} onChange={(e) => setOccurredLocal(e.target.value)} className="h-10" />
                </Field>
              </div>
              <Field label="Összefoglaló" htmlFor="cap_summary">
                <Textarea id="cap_summary" value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-20" />
              </Field>
              <Field label="Eredmény, vállalások, nyitott kérdések" htmlFor="cap_outcome">
                <Textarea id="cap_outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="min-h-28 text-sm" />
              </Field>
              <Field label="Kapcsolódó ingatlan" htmlFor="cap_property">
                <Select id="cap_property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="h-10">
                  <option value="">Nincs</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}{p.detail ? ` – ${p.detail}` : ""}</option>)}
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Eredeti jegyzet" />
            <p className="max-h-64 overflow-y-auto px-5 py-4 text-sm whitespace-pre-line text-muted">{transcript}</p>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-background/90 px-4 py-4 backdrop-blur sm:-mx-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="min-h-5 text-sm">
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-danger">
              <CircleAlert className="size-4" /> {error}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack} disabled={saving}>Vissza</Button>
          <Button onClick={save} disabled={saving} size="lg">
            {saving ? "Mentés…" : clientChoice === "new" ? "Ügyfél létrehozása és mentés" : "Jóváhagyás és mentés"}
          </Button>
        </div>
      </div>
    </div>
  );
}
