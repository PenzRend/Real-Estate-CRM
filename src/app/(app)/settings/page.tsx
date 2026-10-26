import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { FormSection } from "@/components/ui/form-section";
import { PageHeader } from "@/components/ui/page";
import { notConnected } from "@/lib/actions/not-connected";

export const metadata: Metadata = { title: "Beállítások" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Beállítások" description="Profil, munkaterület és fiók." />

      <form action={notConnected}>
        <FormSection number="01" title="Profil">
          <Field label="Teljes név" htmlFor="full_name">
            <Input id="full_name" name="full_name" autoComplete="name" />
          </Field>
          <Field label="E-mail-cím" htmlFor="email" hint="Bejelentkezéshez használt cím.">
            <Input id="email" name="email" type="email" disabled />
          </Field>
          <Field label="Időzóna" htmlFor="timezone">
            <Select id="timezone" name="timezone" defaultValue="Europe/Budapest">
              <option value="Europe/Budapest">Budapest (CET/CEST)</option>
            </Select>
          </Field>
        </FormSection>

        <FormSection number="02" title="Munkaterület" description="Később meghívhatod ide az irodád kollégáit.">
          <div className="sm:col-span-2">
            <Field label="Munkaterület neve" htmlFor="workspace_name">
              <Input id="workspace_name" name="workspace_name" />
            </Field>
          </div>
        </FormSection>

        <div className="flex justify-end border-t border-border pt-6">
          <Button type="submit">Mentés</Button>
        </div>
      </form>
    </div>
  );
}
