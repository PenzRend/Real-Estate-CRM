import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormSection } from "@/components/ui/form-section";
import { PageHeader } from "@/components/ui/page";
import { notConnected } from "@/lib/actions/not-connected";
import { clientStatusLabels, clientTypeLabels, propertyTypeLabels } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: "Új ügyfél" };

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Eyebrow>Ügyfelek</Eyebrow>}
        title="Új ügyfél"
        description="Elég a név és egy elérhetőség. A többit később, akár egy hívásjegyzetből is kitöltheted."
      />

      <form action={notConnected}>
        <FormSection number="01" title="Alapadatok">
          <div className="sm:col-span-2">
            <Field label="Teljes név" htmlFor="full_name">
              <Input id="full_name" name="full_name" required autoComplete="off" />
            </Field>
          </div>
          <Field label="Telefonszám" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" placeholder="+36 30 123 4567" />
          </Field>
          <Field label="E-mail-cím" htmlFor="email">
            <Input id="email" name="email" type="email" />
          </Field>
          <Field label="Ügyféltípus" htmlFor="client_type">
            <Select id="client_type" name="client_type" defaultValue="buyer">
              {Object.entries(clientTypeLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Státusz" htmlFor="status">
            <Select id="status" name="status" defaultValue="new_lead">
              {Object.entries(clientStatusLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
        </FormSection>

        <FormSection number="02" title="Mit keres?" description="Ezek alapján ajánlja a rendszer a megfelelő ingatlanokat.">
          <Field label="Minimum költségkeret (Ft)" htmlFor="budget_min">
            <Input id="budget_min" name="budget_min" inputMode="numeric" placeholder="70 000 000" />
          </Field>
          <Field label="Maximum költségkeret (Ft)" htmlFor="budget_max">
            <Input id="budget_max" name="budget_max" inputMode="numeric" placeholder="85 000 000" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Preferált helyszínek" htmlFor="preferred_locations" hint="Vesszővel elválasztva, pl. Budapest XI., Budaörs">
              <Input id="preferred_locations" name="preferred_locations" />
            </Field>
          </div>
          <Field label="Ingatlantípus" htmlFor="preferred_property_types">
            <Select id="preferred_property_types" name="preferred_property_types" defaultValue="">
              <option value="">Bármilyen</option>
              {Object.entries(propertyTypeLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Minimum szobaszám" htmlFor="min_rooms">
            <Input id="min_rooms" name="min_rooms" inputMode="decimal" />
          </Field>
          <Field label="Minimum alapterület (m²)" htmlFor="min_area_sqm">
            <Input id="min_area_sqm" name="min_area_sqm" inputMode="decimal" />
          </Field>
          <Field label="Költözés tervezett ideje" htmlFor="desired_move_date">
            <Input id="desired_move_date" name="desired_move_date" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Egyéb igények" htmlFor="other_requirements">
              <Textarea id="other_requirements" name="other_requirements" placeholder="Pl. erkély fontos, földszint nem jó" />
            </Field>
          </div>
        </FormSection>

        <FormSection number="03" title="Kezelés">
          <Field label="Következő utánkövetés" htmlFor="next_follow_up_at">
            <Input id="next_follow_up_at" name="next_follow_up_at" type="datetime-local" />
          </Field>
          <Field label="Honnan jött?" htmlFor="lead_source">
            <Input id="lead_source" name="lead_source" placeholder="Pl. ingatlan.com, ajánlás" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Megjegyzés" htmlFor="notes">
              <Textarea id="notes" name="notes" />
            </Field>
          </div>
        </FormSection>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/90 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
          <ButtonLink href="/clients" variant="ghost">Mégse</ButtonLink>
          <Button type="submit">Ügyfél mentése</Button>
        </div>
      </form>
    </div>
  );
}
