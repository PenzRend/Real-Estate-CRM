"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";
import type { PropertyFormState } from "@/app/(app)/properties/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormSection } from "@/components/ui/form-section";
import {
  clientTypeLabels,
  currencyLabels,
  listingTypeLabels,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/lib/i18n/labels";
import type { PropertyFieldErrors } from "@/lib/validation/property";

export type PropertyFormValues = Record<string, string>;
export type OwnerOption = { id: string; name: string; clientType: keyof typeof clientTypeLabels };

type Props = {
  action: (state: PropertyFormState, formData: FormData) => Promise<PropertyFormState>;
  owners: OwnerOption[];
  initialValues?: PropertyFormValues;
  submitLabel: string;
  cancelHref: string;
};

/** Yes / no / not stated: an unknown feature must not be saved as "no". */
function FeatureSelect({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <Field label={label} htmlFor={name}>
      <Select id={name} name={name} defaultValue={value === "on" ? "true" : value}>
        <option value="">Nincs adat</option>
        <option value="true">Van</option>
        <option value="false">Nincs</option>
      </Select>
    </Field>
  );
}

export function PropertyForm({ action, owners, initialValues = {}, submitLabel, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initialValues;
  const errors: PropertyFieldErrors = state.errors ?? {};
  const v = (name: string) => values[name] ?? "";
  const invalid = (name: keyof PropertyFieldErrors) => (errors[name] ? true : undefined);

  return (
    // Remount after each failed submit so the fields show what was typed.
    <form action={formAction} key={JSON.stringify(state.values ?? null)} noValidate>
      {(state.formError || Object.keys(errors).length > 0) && (
        <p role="alert" className="mb-8 flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {state.formError ?? errors.source_url ?? "Néhány mezőt javítani kell. A hibákat a mezők alatt látod."}
        </p>
      )}
      {v("source_url") && <input type="hidden" name="source_url" value={v("source_url")} />}
      {v("video_links") && <input type="hidden" name="video_links" value={v("video_links")} />}

      <FormSection number="01" title="Azonosítás">
        <div className="sm:col-span-2">
          <Field label="Megnevezés" htmlFor="title" error={errors.title}>
            <Input id="title" name="title" required placeholder="Pl. Világos 2 hálós lakás erkéllyel" defaultValue={v("title")} aria-invalid={invalid("title")} />
          </Field>
        </div>
        <Field label="Típus" htmlFor="property_type" error={errors.property_type}>
          <Select id="property_type" name="property_type" defaultValue={v("property_type") || "apartment"}>
            {Object.entries(propertyTypeLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Eladó vagy kiadó?" htmlFor="listing_type" error={errors.listing_type}>
          <Select id="listing_type" name="listing_type" defaultValue={v("listing_type") || "sale"}>
            {Object.entries(listingTypeLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Státusz" htmlFor="status" error={errors.status}>
          <Select id="status" name="status" defaultValue={v("status") || "draft"}>
            {Object.entries(propertyStatusLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Belső azonosító" htmlFor="reference_number" error={errors.reference_number}>
          <Input id="reference_number" name="reference_number" placeholder="Pl. BP11-024" defaultValue={v("reference_number")} aria-invalid={invalid("reference_number")} />
        </Field>
        <Field
          label="Tulajdonos / eladó"
          htmlFor="owner_client_id"
          hint={owners.length ? undefined : "Előbb vedd fel a tulajdonost ügyfélként."}
          error={errors.owner_client_id}
        >
          <Select id="owner_client_id" name="owner_client_id" defaultValue={v("owner_client_id")} aria-invalid={invalid("owner_client_id")}>
            <option value="">Nincs megadva</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({clientTypeLabels[o.clientType].toLowerCase()})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hirdetés forrása" htmlFor="listing_source" error={errors.listing_source}>
          <Input id="listing_source" name="listing_source" placeholder="Pl. saját megbízás, ingatlan.com" defaultValue={v("listing_source")} />
        </Field>
      </FormSection>

      <FormSection number="02" title="Helyszín">
        <Field label="Város" htmlFor="city" error={errors.city}>
          <Input id="city" name="city" placeholder="Budapest" defaultValue={v("city")} />
        </Field>
        <Field label="Kerület / városrész" htmlFor="district" error={errors.district}>
          <Input id="district" name="district" placeholder="XI. kerület" defaultValue={v("district")} />
        </Field>
        <Field label="Cím" htmlFor="address" hint="Belső adat, ügyfélnek nem jelenik meg." error={errors.address}>
          <Input id="address" name="address" defaultValue={v("address")} />
        </Field>
        <Field label="Irányítószám" htmlFor="postal_code" error={errors.postal_code}>
          <Input id="postal_code" name="postal_code" inputMode="numeric" maxLength={4} defaultValue={v("postal_code")} aria-invalid={invalid("postal_code")} />
        </Field>
      </FormSection>

      <FormSection number="03" title="Paraméterek">
        <Field label="Irányár" htmlFor="price" hint="Pl. 79 000 000 vagy 79M" error={errors.price}>
          <Input id="price" name="price" inputMode="decimal" defaultValue={v("price")} aria-invalid={invalid("price")} />
        </Field>
        <Field label="Pénznem" htmlFor="currency" error={errors.currency}>
          <Select id="currency" name="currency" defaultValue={v("currency") || "HUF"}>
            {Object.entries(currencyLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Alapterület (m²)" htmlFor="area_sqm" error={errors.area_sqm}>
          <Input id="area_sqm" name="area_sqm" inputMode="decimal" defaultValue={v("area_sqm")} aria-invalid={invalid("area_sqm")} />
        </Field>
        <Field label="Szobák száma" htmlFor="room_count" hint="Félszoba: 0,5" error={errors.room_count}>
          <Input id="room_count" name="room_count" inputMode="decimal" defaultValue={v("room_count")} aria-invalid={invalid("room_count")} />
        </Field>
        <Field label="Hálószobák" htmlFor="bedroom_count" error={errors.bedroom_count}>
          <Input id="bedroom_count" name="bedroom_count" inputMode="numeric" defaultValue={v("bedroom_count")} aria-invalid={invalid("bedroom_count")} />
        </Field>
        <Field label="Fürdőszobák" htmlFor="bathroom_count" error={errors.bathroom_count}>
          <Input id="bathroom_count" name="bathroom_count" inputMode="numeric" defaultValue={v("bathroom_count")} aria-invalid={invalid("bathroom_count")} />
        </Field>
        <Field label="Emelet" htmlFor="floor" error={errors.floor}>
          <Input id="floor" name="floor" placeholder="Pl. 3. emelet" defaultValue={v("floor")} />
        </Field>
        <Field label="Épület típusa" htmlFor="building_type" error={errors.building_type}>
          <Input id="building_type" name="building_type" placeholder="Pl. tégla, panel, új építésű" defaultValue={v("building_type")} />
        </Field>
        <Field label="Állapot" htmlFor="condition" error={errors.condition}>
          <Input id="condition" name="condition" placeholder="Pl. felújított" defaultValue={v("condition")} />
        </Field>
        <Field label="Energetikai besorolás" htmlFor="energy_rating" error={errors.energy_rating}>
          <Input id="energy_rating" name="energy_rating" placeholder="Pl. BB" defaultValue={v("energy_rating")} />
        </Field>
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
          <FeatureSelect name="has_balcony" label="Erkély / terasz" value={v("has_balcony")} />
          <FeatureSelect name="has_garden" label="Kert" value={v("has_garden")} />
          <FeatureSelect name="has_parking" label="Parkolás" value={v("has_parking")} />
        </div>
      </FormSection>

      <FormSection number="04" title="Leírás">
        <div className="sm:col-span-2">
          <Field label="Hirdetés szövege" htmlFor="description" error={errors.description}>
            <Textarea id="description" name="description" className="min-h-40" defaultValue={v("description")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Belső megjegyzés" htmlFor="internal_notes" hint="Csak a munkaterület tagjai látják." error={errors.internal_notes}>
            <Textarea id="internal_notes" name="internal_notes" defaultValue={v("internal_notes")} />
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
