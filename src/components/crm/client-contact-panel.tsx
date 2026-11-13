"use client";

import { CalendarClock, Check, Loader2, Mail, Pencil, Phone, RefreshCw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { quickEditClientAction } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { formatDate, formatDateTime } from "@/lib/i18n/format";
import { clientStatusLabels } from "@/lib/i18n/labels";
import { utcToZonedLocal } from "@/lib/i18n/timezone";

type Contact = {
  id: string;
  fullName: string;
  status: string;
  phone: string | null;
  email: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
};

/**
 * Phone, email, next follow-up and last contact, with a pencil to edit them
 * (and the name and status) right here, without opening the full form.
 */
export function ClientContactPanel({ client, editable = true }: { client: Contact; editable?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const initial = () => ({
    full_name: client.fullName,
    status: client.status === "archived" ? "active" : client.status,
    phone: client.phone ?? "",
    email: client.email ?? "",
    next_follow_up_at: client.nextFollowUpAt ? utcToZonedLocal(client.nextFollowUpAt).slice(0, 16) : "",
  });
  const [form, setForm] = useState(initial);
  const set = (k: keyof ReturnType<typeof initial>) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () =>
    start(async () => {
      const r = await quickEditClientAction(client.id, form).catch(actionFailed);
      if (!r.ok) return setError(r.error);
      setError(null);
      setEditing(false);
      toast({ message: "Mentve." });
    });

  if (editing) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Név" htmlFor="qe-name">
            <Input id="qe-name" value={form.full_name} onChange={set("full_name")} autoComplete="off" />
          </Field>
          <Field label="Telefon" htmlFor="qe-phone">
            <Input id="qe-phone" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="+36 30 123 4567" />
          </Field>
          <Field label="E-mail" htmlFor="qe-email">
            <Input id="qe-email" type="email" inputMode="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Státusz" htmlFor="qe-status">
            <Select id="qe-status" value={form.status} onChange={set("status")}>
              {Object.entries(clientStatusLabels)
                .filter(([v]) => v !== "archived")
                .map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Következő utánkövetés" htmlFor="qe-follow">
            <Input id="qe-follow" type="datetime-local" step={900} value={form.next_follow_up_at} onChange={set("next_follow_up_at")} />
          </Field>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setForm(initial());
              setError(null);
              setEditing(false);
            }}
            disabled={saving}
          >
            <X /> Mégse
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />} Mentés
          </Button>
        </div>
      </Card>
    );
  }

  const tiles = [
    { icon: Phone, label: "Telefon", value: client.phone, href: client.phone ? `tel:${client.phone}` : null },
    { icon: Mail, label: "E-mail", value: client.email, href: client.email ? `mailto:${client.email}` : null },
    { icon: CalendarClock, label: "Következő utánkövetés", value: client.nextFollowUpAt ? formatDateTime(client.nextFollowUpAt) : null },
    { icon: RefreshCw, label: "Utolsó kapcsolat", value: client.lastContactedAt ? formatDate(client.lastContactedAt) : null },
  ];

  return (
    <Panel className="relative grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
      {tiles.map(({ icon: Icon, label, value, href }) => (
        <div key={label} className="flex items-center gap-3 px-5 py-4">
          <Icon className="size-4 shrink-0 text-subtle" />
          <div className="min-w-0">
            <p className="text-xs text-muted">{label}</p>
            {href && value ? (
              <a href={href} className="block truncate text-sm font-medium text-ink hover:underline">
                {value}
              </a>
            ) : (
              <p className="truncate text-sm font-medium text-ink">{value ?? "—"}</p>
            )}
          </div>
        </div>
      ))}
      {editable && (
        <button
          type="button"
          onClick={() => {
            setForm(initial());
            setEditing(true);
          }}
          className="absolute top-2 right-2 grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
          aria-label="Adatok szerkesztése"
          title="Adatok szerkesztése"
        >
          <Pencil className="size-4" />
        </button>
      )}
    </Panel>
  );
}
