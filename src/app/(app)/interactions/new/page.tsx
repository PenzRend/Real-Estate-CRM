import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page";
import { notConnected } from "@/lib/actions/not-connected";
import { interactionTypeLabels } from "@/lib/i18n/labels";

export const metadata: Metadata = { title: "Hívás rögzítése" };

export default function NewInteractionPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Eyebrow>Kapcsolattartás</Eyebrow>}
        title="Hívás vagy találkozó rögzítése"
        description="Írd vagy másold be a jegyzetet. Az AI kiemeli az igényeket, határidőket és teendőket — mentés előtt mindent átnézhetsz."
      />

      <form action={notConnected} className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-5">
          <Field label="Jegyzet" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              required
              className="min-h-72"
              placeholder="Pl.: Beszéltem Péterrel. 2 hálós lakást keres a XI. kerületben, kb. 80 millióig. 3 hónapon belül költözne. Küldjek megfelelő ingatlanokat, pénteken hívjam vissza."
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary">
              <Sparkles className="text-accent" /> Feldolgozás AI-val
            </Button>
            <Button type="submit">Mentés AI nélkül</Button>
            <ButtonLink href="/dashboard" variant="ghost">Mégse</ButtonLink>
          </div>
        </div>

        <Panel className="flex h-fit flex-col gap-5 p-5">
          <Field label="Ügyfél" htmlFor="client_id">
            <Input id="client_id" name="client_search" placeholder="Kezdd el gépelni a nevet…" />
          </Field>
          <Field label="Típus" htmlFor="interaction_type">
            <Select id="interaction_type" name="interaction_type" defaultValue="call">
              {Object.entries(interactionTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Időpont" htmlFor="occurred_at">
            <Input id="occurred_at" name="occurred_at" type="datetime-local" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="follow_up_required" className="size-4 accent-[var(--primary)]" />
            Utánkövetés szükséges
          </label>
        </Panel>
      </form>
    </div>
  );
}
