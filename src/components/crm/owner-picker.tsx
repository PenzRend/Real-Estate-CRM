"use client";

import { Loader2, Sparkles, UserPlus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { createOwnerAction, readOwnerAction, type OwnerFields } from "@/app/(app)/clients/quick-actions";
import { VoiceRecorder } from "@/components/capture/voice-recorder";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { clientTypeLabels } from "@/lib/i18n/labels";
import type { OwnerOption } from "./property-form";

const EMPTY: OwnerFields = { full_name: "", phone: "", email: "", client_type: "owner", notes: "" };

/**
 * The property's owner: pick an existing client, or add a new one right here,
 * typed or dictated. The panel's inputs have no form names, so they never
 * submit with the property; only the chosen owner's id does.
 */
export function OwnerPicker({
  owners,
  defaultValue,
  error,
  canDictate,
}: {
  owners: OwnerOption[];
  defaultValue: string;
  error?: string;
  canDictate: boolean;
}) {
  const [options, setOptions] = useState(owners);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<OwnerFields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof OwnerFields, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);

  const set = (k: keyof OwnerFields, v: string) => setFields((f) => ({ ...f, [k]: v }));
  // Enter in the panel must not submit the property form around it.
  const noSubmit = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) e.preventDefault();
  };

  async function fromText(text: string) {
    setReading(true);
    setMessage(null);
    const r = await readOwnerAction(text).catch(() => ({ ok: false as const, error: "Nem sikerült kiolvasni az adatokat. Írd be őket kézzel." }));
    setReading(false);
    if (!r.ok) return setMessage(r.error);
    // Only fill what was said; keep anything already typed.
    setFields((f) => ({
      full_name: r.fields.full_name || f.full_name,
      phone: r.fields.phone || f.phone,
      email: r.fields.email || f.email,
      client_type: r.fields.client_type,
      notes: [f.notes, r.fields.notes].filter(Boolean).join("\n"),
    }));
    setMessage("Kitöltöttem a diktálásból – ellenőrizd, és mentsd el.");
  }

  async function save() {
    setSaving(true);
    setErrors({});
    setMessage(null);
    const r = await createOwnerAction(fields).catch(() => ({ ok: false as const, errors: {}, formError: "Az ügyfél mentése nem sikerült. Próbáld újra." }));
    setSaving(false);
    if (!r.ok) {
      setErrors(r.errors);
      if (r.formError) setMessage(r.formError);
      return;
    }
    setOptions((o) => [...o, r.owner]);
    setValue(r.owner.id);
    setFields(EMPTY);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Tulajdonos / eladó" htmlFor="owner_client_id" error={error}>
          <Select id="owner_client_id" name="owner_client_id" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={error ? true : undefined}>
            <option value="">Nincs megadva</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({clientTypeLabels[o.clientType].toLowerCase()})
              </option>
            ))}
          </Select>
        </Field>
        {!open && (
          <Button variant="secondary" onClick={() => setOpen(true)} className="h-11">
            <UserPlus /> Új ügyfél
          </Button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4" onKeyDown={noSubmit}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Új tulajdonos felvétele</p>
              <p className="text-xs text-muted">Írd be az adatait, vagy mondd el – például: „Kovács Anna, ő a tulajdonos, 30 123 4567, anna kukac gmail pont com”.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Bezárás" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-strong hover:text-ink">
              <X className="size-4" />
            </button>
          </div>

          {canDictate && (
            <div className="flex flex-wrap items-center gap-3">
              <VoiceRecorder disabled={reading || saving} onTranscript={(t) => void fromText(t)} />
              {reading && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <Loader2 className="size-3.5 animate-spin" /> Az adatok kiolvasása…
                </span>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Név" htmlFor="owner-name" error={errors.full_name}>
              <Input id="owner-name" value={fields.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Szerepe" htmlFor="owner-type">
              <Select id="owner-type" value={fields.client_type} onChange={(e) => set("client_type", e.target.value)}>
                <option value="owner">{clientTypeLabels.owner}</option>
                <option value="seller">{clientTypeLabels.seller}</option>
              </Select>
            </Field>
            <Field label="Telefon" htmlFor="owner-phone" error={errors.phone}>
              <Input id="owner-phone" type="tel" value={fields.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="off" />
            </Field>
            <Field label="E-mail" htmlFor="owner-email" error={errors.email}>
              <Input id="owner-email" type="email" value={fields.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Megjegyzés" htmlFor="owner-notes">
                <Textarea id="owner-notes" value={fields.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-20" />
              </Field>
            </div>
          </div>

          {message && <p className="flex items-center gap-1.5 text-xs text-text"><Sparkles className="size-3.5 text-accent" /> {message}</p>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving || reading || !fields.full_name.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : <UserPlus />} {saving ? "Mentés…" : "Ügyfél mentése és kiválasztása"}
            </Button>
            {!canDictate && <p className="self-center text-xs text-muted">Diktáláshoz használd a telefon billentyűzetének mikrofon gombját.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
