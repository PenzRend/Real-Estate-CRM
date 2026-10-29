"use client";

import { CircleAlert, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { addSubscriptionAction, removeSubscriptionAction, type SubscriptionState } from "@/app/(app)/calendar/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { Subscription } from "@/lib/calendar/data";
import { colorNames, eventColors } from "./colors";

const howTo: { name: string; steps: string }[] = [
  { name: "iCloud (iPhone, Mac)", steps: "icloud.com/calendar → a naptár neve melletti megosztás ikon → Nyilvános naptár → link másolása." },
  { name: "Google Naptár", steps: "Beállítások → a naptár neve → Naptár integrálása → „Titkos cím iCal formátumban”." },
  { name: "Outlook / Microsoft 365", steps: "Outlook a weben → Beállítások → Naptár → Megosztott naptárak → Naptár közzététele → ICS-link." },
];

/** Outside calendars shown in Flavio by their iCal link, and the form to add one. */
export function Subscriptions({ subscriptions }: { subscriptions: Subscription[] }) {
  const [state, action, pending] = useActionState<SubscriptionState, FormData>(addSubscriptionAction, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      {subscriptions.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {subscriptions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("size-2.5 shrink-0 rounded-full", eventColors[s.color]?.dot)} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-ink">{s.name}</p>
                {s.lastError && (
                  <p className="flex items-center gap-1 text-xs text-danger">
                    <CircleAlert className="size-3" /> {s.lastError}
                  </p>
                )}
              </div>
              <form action={removeSubscriptionAction.bind(null, s.id)}>
                <Button type="submit" variant="ghost" size="sm" aria-label={`${s.name} eltávolítása`} title="Eltávolítás">
                  <Trash2 />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={form} action={action} className="grid grid-cols-1 gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[1fr_10rem]">
        <p className="flex items-center gap-2 text-sm font-medium text-ink sm:col-span-2">
          <Link2 className="size-4 text-muted" /> Naptár hozzáadása linkkel
        </p>
        <div className="sm:col-span-2">
          <Field label="Naptár linkje (iCal / webcal)" htmlFor="sub-url" error={state.error}>
            <Input id="sub-url" name="url" required placeholder="webcal://p01-caldav.icloud.com/…" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(state.error)} />
          </Field>
        </div>
        <Field label="Név" htmlFor="sub-name">
          <Input id="sub-name" name="name" placeholder="pl. Családi naptár" maxLength={80} />
        </Field>
        <Field label="Szín" htmlFor="sub-color">
          <Select id="sub-color" name="color" defaultValue="sky">
            {Object.entries(colorNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />} {pending ? "Ellenőrzés…" : "Hozzáadás"}
          </Button>
          <p className="text-xs text-muted">Csak te látod. A linket titkosítva tároljuk; néhány percenként frissül.</p>
        </div>
        <details className="text-xs text-muted sm:col-span-2">
          <summary className="cursor-pointer font-medium text-ink">Hol találom a linket?</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {howTo.map((h) => (
              <li key={h.name}>
                <span className="font-medium text-text">{h.name}:</span> {h.steps}
              </li>
            ))}
          </ul>
        </details>
      </form>
    </div>
  );
}
