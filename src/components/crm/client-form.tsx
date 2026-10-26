"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";
import type { ClientFormState } from "@/app/(app)/clients/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormSection } from "@/components/ui/form-section";
import { clientStatusLabels, clientTypeLabels, propertyTypeLabels } from "@/lib/i18n/labels";

export type ClientFormValues = Record<string, string | string[]>;

type Props = {
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  initialValues?: ClientFormValues;
  submitLabel: string;
  cancelHref: string;
};

export function ClientForm({ action, initialValues = {}, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initialValues;
  const errors = state.errors ?? {};
  const text = (name: string) => (typeof values[name] === "string" ? (values[name] as string) : "");
  const types = Array.isArray(values.preferred_property_types) ? values.preferred_property_types : [];
  const err = (name: keyof typeof errors) => errors[name];
  const invalid = (name: keyof typeof errors) => (errors[name] ? true : undefined);

  return (
    // Remount after each failed submit so the fields show what was typed.
    <form action={formAction} key={JSON.stringify(state.values ?? null)} noValidate>
      {(state.formError || Object.keys(errors).length > 0) && (
        <p role="alert" className="mb-8 flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {state.formError ?? "Néhány mezőt javítani kell. A hibákat a mezők alatt látod."}
        </p>
      )}

      <FormSection number="01" title="Alapadatok">
        <div className="sm:col-span-2">
          <Field label="Teljes név" htmlFor="full_name" error={err("full_name")}>
            <Input id="full_name" name="full_name" required autoComplete="off" defaultValue={text("full_name")} aria-invalid={invalid("full_name")} />
          </Field>
        </div>
        <Field label="Telefonszám" htmlFor="phone" error={err("phone")}>
          <Input id="phone" name="phone" type="tel" placeholder="+36 30 123 4567" defaultValue={text("phone")} aria-invalid={invalid("phone")} />
        </Field>
        <Field label="E-mail-cím" htmlFor="email" error={err("email")}>
          <Input id="email" name="email" type="email" defaultValue={text("email")} aria-invalid={invalid("email")} />
        </Field>
        <Field label="Ügyféltípus" htmlFor="client_type" error={err("client_type")}>
          <Select id="client_type" name="client_type" defaultValue={text("client_type") || "buyer"}>
            {Object.entries(clientTypeLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Státusz" htmlFor="status" error={err("status")}>
          <Select id="status" name="status" defaultValue={text("status") || "new_lead"}>
            {Object.entries(clientStatusLabels)
              .filter(([v]) => v !== "archived")
              .map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection number="02" title="Mit keres?" description="Ezek alapján ajánlja a rendszer a megfelelő ingatlanokat.">
        <Field label="Minimum költségkeret (Ft)" htmlFor="budget_min" hint="Pl. 70 000 000 vagy 70M" error={err("budget_min")}>
          <Input id="budget_min" name="budget_min" inputMode="decimal" defaultValue={text("budget_min")} aria-invalid={invalid("budget_min")} />
        </Field>
        <Field label="Maximum költségkeret (Ft)" htmlFor="budget_max" error={err("budget_max")}>
          <Input id="budget_max" name="budget_max" inputMode="decimal" defaultValue={text("budget_max")} aria-invalid={invalid("budget_max")} />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Preferált helyszínek"
            htmlFor="preferred_locations"
            hint="Vesszővel elválasztva, pl. Budapest XI., Budaörs"
            error={err("preferred_locations")}
          >
            <Input id="preferred_locations" name="preferred_locations" defaultValue={text("preferred_locations")} aria-invalid={invalid("preferred_locations")} />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">Ingatlantípus</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(propertyTypeLabels).map(([v, l]) => (
              <label
                key={v}
                className="flex cursor-pointer items-center gap-2 rounded-full border border-border-strong px-3.5 py-2 text-sm text-ink has-[:checked]:border-ink has-[:checked]:bg-surface"
              >
                <input type="checkbox" name="preferred_property_types" value={v} defaultChecked={types.includes(v)} className="size-4 accent-[var(--primary)]" />
                {l}
              </label>
            ))}
          </div>
          {err("preferred_property_types") && <p className="text-xs text-danger">{err("preferred_property_types")}</p>}
        </fieldset>
        <Field label="Minimum szobaszám" htmlFor="min_rooms" error={err("min_rooms")}>
          <Input id="min_rooms" name="min_rooms" inputMode="decimal" defaultValue={text("min_rooms")} aria-invalid={invalid("min_rooms")} />
        </Field>
        <Field label="Minimum hálószoba" htmlFor="min_bedrooms" error={err("min_bedrooms")}>
          <Input id="min_bedrooms" name="min_bedrooms" inputMode="numeric" defaultValue={text("min_bedrooms")} aria-invalid={invalid("min_bedrooms")} />
        </Field>
        <Field label="Minimum alapterület (m²)" htmlFor="min_area_sqm" error={err("min_area_sqm")}>
          <Input id="min_area_sqm" name="min_area_sqm" inputMode="decimal" defaultValue={text("min_area_sqm")} aria-invalid={invalid("min_area_sqm")} />
        </Field>
        <Field label="Maximum alapterület (m²)" htmlFor="max_area_sqm" error={err("max_area_sqm")}>
          <Input id="max_area_sqm" name="max_area_sqm" inputMode="decimal" defaultValue={text("max_area_sqm")} aria-invalid={invalid("max_area_sqm")} />
        </Field>
        <Field label="Állapot" htmlFor="preferred_condition" hint="Pl. felújított, beköltözhető" error={err("preferred_condition")}>
          <Input id="preferred_condition" name="preferred_condition" defaultValue={text("preferred_condition")} />
        </Field>
        <Field label="Költözés tervezett ideje" htmlFor="desired_move_date" error={err("desired_move_date")}>
          <Input id="desired_move_date" name="desired_move_date" type="date" defaultValue={text("desired_move_date")} aria-invalid={invalid("desired_move_date")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Egyéb igények" htmlFor="other_requirements" error={err("other_requirements")}>
            <Textarea id="other_requirements" name="other_requirements" placeholder="Pl. erkély fontos, földszint nem jó" defaultValue={text("other_requirements")} />
          </Field>
        </div>
      </FormSection>

      <FormSection number="03" title="Kezelés">
        <Field label="Következő utánkövetés" htmlFor="next_follow_up_at" error={err("next_follow_up_at")}>
          <Input id="next_follow_up_at" name="next_follow_up_at" type="datetime-local" defaultValue={text("next_follow_up_at")} aria-invalid={invalid("next_follow_up_at")} />
        </Field>
        <Field label="Honnan jött?" htmlFor="lead_source" error={err("lead_source")}>
          <Input id="lead_source" name="lead_source" placeholder="Pl. ingatlan.com, ajánlás" defaultValue={text("lead_source")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Megjegyzés" htmlFor="notes" error={err("notes")}>
            <Textarea id="notes" name="notes" defaultValue={text("notes")} />
          </Field>
        </div>
      </FormSection>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/90 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        <ButtonLink href={cancelHref} variant="ghost">Mégse</ButtonLink>
        <Button type="submit" disabled={pending}>{pending ? "Mentés…" : submitLabel}</Button>
      </div>
    </form>
  );
}
