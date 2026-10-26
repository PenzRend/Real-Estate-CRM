import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormSection } from "@/components/ui/form-section";
import { PageHeader } from "@/components/ui/page";
import { notConnected } from "@/lib/actions/not-connected";
import { propertyStatusLabels, propertyTypeLabels } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: "Új ingatlan" };

function Toggle({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-border-strong px-3.5 text-sm text-ink has-[:checked]:border-ink has-[:checked]:bg-surface">
      <input type="checkbox" name={name} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Eyebrow>Ingatlanok</Eyebrow>}
        title="Új ingatlan"
        description="A párosításhoz a helyszín, az ár, az alapterület és a szobaszám a legfontosabb."
      />

      <form action={notConnected}>
        <FormSection number="01" title="Azonosítás">
          <div className="sm:col-span-2">
            <Field label="Megnevezés" htmlFor="title">
              <Input id="title" name="title" required placeholder="Pl. Világos 2 hálós lakás erkéllyel" />
            </Field>
          </div>
          <Field label="Típus" htmlFor="property_type">
            <Select id="property_type" name="property_type" defaultValue="apartment">
              {Object.entries(propertyTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Státusz" htmlFor="status">
            <Select id="status" name="status" defaultValue="draft">
              {Object.entries(propertyStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Belső azonosító" htmlFor="reference_number">
            <Input id="reference_number" name="reference_number" placeholder="Pl. BP11-024" />
          </Field>
          <Field label="Hirdetés forrása" htmlFor="listing_source">
            <Input id="listing_source" name="listing_source" />
          </Field>
        </FormSection>

        <FormSection number="02" title="Helyszín">
          <Field label="Város" htmlFor="city">
            <Input id="city" name="city" placeholder="Budapest" />
          </Field>
          <Field label="Kerület / városrész" htmlFor="district">
            <Input id="district" name="district" placeholder="XI. kerület" />
          </Field>
          <Field label="Cím" htmlFor="address" hint="Nem jelenik meg az ügyfeleknek.">
            <Input id="address" name="address" />
          </Field>
          <Field label="Irányítószám" htmlFor="postal_code">
            <Input id="postal_code" name="postal_code" inputMode="numeric" maxLength={4} />
          </Field>
        </FormSection>

        <FormSection number="03" title="Paraméterek">
          <Field label="Irányár (Ft)" htmlFor="price">
            <Input id="price" name="price" inputMode="numeric" placeholder="79 000 000" />
          </Field>
          <Field label="Alapterület (m²)" htmlFor="area_sqm">
            <Input id="area_sqm" name="area_sqm" inputMode="decimal" />
          </Field>
          <Field label="Szobák száma" htmlFor="room_count" hint="Félszoba: 0,5">
            <Input id="room_count" name="room_count" inputMode="decimal" />
          </Field>
          <Field label="Hálószobák" htmlFor="bedroom_count">
            <Input id="bedroom_count" name="bedroom_count" inputMode="numeric" />
          </Field>
          <Field label="Emelet" htmlFor="floor">
            <Input id="floor" name="floor" placeholder="Pl. 3. emelet" />
          </Field>
          <Field label="Állapot" htmlFor="condition">
            <Input id="condition" name="condition" placeholder="Pl. felújított" />
          </Field>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
            <Toggle name="has_balcony" label="Erkély / terasz" />
            <Toggle name="has_garden" label="Kert" />
            <Toggle name="has_parking" label="Parkolás" />
          </div>
        </FormSection>

        <FormSection number="04" title="Leírás">
          <div className="sm:col-span-2">
            <Field label="Hirdetés szövege" htmlFor="description">
              <Textarea id="description" name="description" className="min-h-40" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Belső megjegyzés" htmlFor="internal_notes" hint="Csak a munkaterület tagjai látják.">
              <Textarea id="internal_notes" name="internal_notes" />
            </Field>
          </div>
        </FormSection>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/90 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
          <ButtonLink href="/properties" variant="ghost">Mégse</ButtonLink>
          <Button type="submit">Ingatlan mentése</Button>
        </div>
      </form>
    </div>
  );
}
