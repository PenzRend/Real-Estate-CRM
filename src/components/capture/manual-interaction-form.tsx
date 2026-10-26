"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { createInteractionAction, type InteractionFormState } from "@/app/(app)/interactions/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { Option } from "@/lib/db/activity";
import { interactionTypeLabels } from "@/lib/i18n/labels";
import { utcToZonedLocal } from "@/lib/i18n/timezone";

export function ManualInteractionForm({
  clients,
  properties,
  defaults,
}: {
  clients: Option[];
  properties: Option[];
  defaults: { clientId?: string; propertyId?: string; type?: string };
}) {
  const [state, action, pending] = useActionState<InteractionFormState, FormData>(createInteractionAction, {});
  const [now] = useState(() => utcToZonedLocal(new Date().toISOString()));
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <form action={action} key={JSON.stringify(state.values ?? null)} className="flex flex-col gap-6" noValidate>
      {(state.formError || Object.keys(e).length > 0) && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {state.formError ?? "Néhány mezőt javítani kell."}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ügyfél" htmlFor="client_id" error={e.client_id}>
          <Select id="client_id" name="client_id" defaultValue={v.client_id ?? defaults.clientId ?? ""}>
            <option value="">Nincs</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.detail ? ` – ${c.detail}` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Ingatlan" htmlFor="property_id" error={e.property_id}>
          <Select id="property_id" name="property_id" defaultValue={v.property_id ?? defaults.propertyId ?? ""}>
            <option value="">Nincs</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}{p.detail ? ` – ${p.detail}` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Típus" htmlFor="interaction_type" error={e.interaction_type}>
          <Select id="interaction_type" name="interaction_type" defaultValue={v.interaction_type ?? defaults.type ?? "call"}>
            {Object.entries(interactionTypeLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Időpont" htmlFor="occurred_at" error={e.occurred_at}>
          <Input id="occurred_at" name="occurred_at" type="datetime-local" defaultValue={v.occurred_at ?? now} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Összefoglaló" htmlFor="summary" error={e.summary}>
            <Input id="summary" name="summary" placeholder="Pl. Megnézte a lakást, a parkolás kérdéses" defaultValue={v.summary} aria-invalid={e.summary ? true : undefined} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Részletes jegyzet" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={v.notes} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Eredmény" htmlFor="outcome" error={e.outcome}>
            <Input id="outcome" name="outcome" defaultValue={v.outcome} />
          </Field>
        </div>
        <Field label="Következő utánkövetés" htmlFor="next_follow_up_at" error={e.next_follow_up_at}>
          <Input id="next_follow_up_at" name="next_follow_up_at" type="datetime-local" defaultValue={v.next_follow_up_at} />
        </Field>
        <Field label="Feladat ehhez (opcionális)" htmlFor="task_title" error={e.task_title}>
          <Input id="task_title" name="task_title" placeholder="Pl. Alaprajz elküldése" defaultValue={v.task_title} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <ButtonLink href="/dashboard" variant="ghost">Mégse</ButtonLink>
        <Button type="submit" disabled={pending}>{pending ? "Mentés…" : "Mentés"}</Button>
      </div>
    </form>
  );
}
