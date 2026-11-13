"use client";

import { Building2, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { useActionState, useState } from "react";
import { saveIdentificationAction, type IdentificationState } from "@/app/(app)/clients/aml-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ID_DOCUMENTS } from "@/lib/aml/identification";
import { IdScan } from "./id-scan";
import { cn } from "@/lib/cn";

type Values = Record<string, string>;

/**
 * Customer due diligence form: a private person (identity data checked
 * against an ID document) or a company (registration data, representative,
 * beneficial owners), plus the PEP declaration, the source of funds and the
 * purpose. Saved encrypted.
 */
export function IdentificationForm({
  clientId,
  kind: initialKind,
  values: initial,
  canScan = false,
}: {
  clientId: string;
  kind: "person" | "company";
  values: Values;
  /** A vision model is configured: offer filling the form from photos. */
  canScan?: boolean;
}) {
  const [state, action, pending] = useActionState<IdentificationState, FormData>(saveIdentificationAction.bind(null, clientId), {});
  const [kind, setKind] = useState(initialKind);
  const v = { ...initial, ...(state.values ?? {}) };
  const [pep, setPep] = useState(v.pep === "yes" ? "yes" : "no");
  const e = state.errors ?? {};
  const field = (name: string, label: string, props: React.ComponentProps<typeof Input> & { hint?: string } = {}) => {
    const { hint, ...rest } = props;
    return (
      <Field label={label} htmlFor={`aml-${name}`} error={e[name]} hint={hint}>
        <Input id={`aml-${name}`} name={name} defaultValue={v[name] ?? ""} aria-invalid={Boolean(e[name])} {...rest} />
      </Field>
    );
  };

  return (
    <Card className="p-5 sm:p-6">
      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="kind" value={kind} />
        <div className="flex w-fit gap-1 rounded-full border border-border p-1">
          {[
            { value: "person" as const, label: "Magánszemély", icon: UserRound },
            { value: "company" as const, label: "Cég", icon: Building2 },
          ].map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              aria-pressed={kind === k.value}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors", kind === k.value ? "bg-primary font-medium text-white" : "text-muted hover:text-ink")}
            >
              <k.icon className="size-4" /> {k.label}
            </button>
          ))}
        </div>

        {kind === "person" ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {canScan && <IdScan clientId={clientId} />}
            {field("full_name", "Családi és utónév")}
            {field("birth_name", "Születési név", { hint: "Ha eltér." })}
            {field("mother_name", "Anyja születési neve")}
            {field("nationality", "Állampolgárság", { placeholder: "magyar" })}
            {field("birth_place", "Születési hely")}
            {field("birth_date", "Születési idő", { type: "date" })}
            <div className="sm:col-span-2">{field("address", "Lakcím (vagy tartózkodási hely)")}</div>
            <Field label="Azonosító okmány" htmlFor="aml-document_type">
              <Select id="aml-document_type" name="document_type" defaultValue={v.document_type || "id_card"}>
                {Object.entries(ID_DOCUMENTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            {field("document_number", "Okmány száma", { autoComplete: "off" })}
            {field("document_expires_on", "Okmány érvényessége", { type: "date" })}
            {field("address_card_number", "Lakcímkártya száma", { autoComplete: "off" })}
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("company_name", "Cégnév")}</div>
            {field("registration_number", "Cégjegyzékszám", { placeholder: "01-09-123456" })}
            {field("tax_number", "Adószám")}
            <div className="sm:col-span-2">{field("seat", "Székhely")}</div>
            {field("representative_name", "Képviselő neve")}
            {field("representative_document", "Képviselő okmányának típusa és száma", { autoComplete: "off" })}
            <div className="sm:col-span-2">
              <Field label="Tényleges tulajdonos(ok)" htmlFor="aml-beneficial_owners" error={e.beneficial_owners} hint="Név, születési idő, lakcím, állampolgárság, tulajdoni hányad – soronként egy személy.">
                <Textarea id="aml-beneficial_owners" name="beneficial_owners" defaultValue={v.beneficial_owners ?? ""} className="min-h-24" aria-invalid={Boolean(e.beneficial_owners)} />
              </Field>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">Kiemelt közszereplő (PEP)?</legend>
            <p className="text-xs text-muted">Az ügyfél (vagy közeli hozzátartozója, közeli kapcsolata) fontos közfeladatot lát-e el, vagy látott el az elmúlt egy évben.</p>
            <div className="flex gap-4 text-sm">
              {[
                { value: "no", label: "Nem" },
                { value: "yes", label: "Igen" },
              ].map((o) => (
                <label key={o.value} className="flex items-center gap-2">
                  <input type="radio" name="pep" value={o.value} checked={pep === o.value} onChange={() => setPep(o.value)} className="size-4 accent-[var(--primary)]" />
                  {o.label}
                </label>
              ))}
            </div>
            {pep === "yes" && field("pep_role", "Milyen tisztség?", { placeholder: "Pl. országgyűlési képviselő" })}
          </fieldset>
          <Field label="Az üzleti kapcsolat célja" htmlFor="aml-purpose" error={e.purpose}>
            <Input id="aml-purpose" name="purpose" defaultValue={v.purpose ?? "Ingatlan adásvétel közvetítése"} aria-invalid={Boolean(e.purpose)} />
          </Field>
          <Field label="A pénzeszközök forrása" htmlFor="aml-source_of_funds" hint="Pl. megtakarítás, lakáshitel, korábbi ingatlan eladása. Kiemelt közszereplőnél kötelező.">
            <Input id="aml-source_of_funds" name="source_of_funds" defaultValue={v.source_of_funds ?? ""} />
          </Field>
          <Field label="Megjegyzés" htmlFor="aml-notes">
            <Textarea id="aml-notes" name="notes" defaultValue={v.notes ?? ""} className="min-h-16" />
          </Field>
        </section>

        {e.form && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{e.form}</p>}
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" className="w-fit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Azonosítás mentése
          </Button>
          <p className="text-xs text-muted">
            Az adatokat titkosítva tároljuk, és csak az iroda munkatársai látják. Az okmányt személyesen ellenőrizd. Kövesd az iroda pénzmosás elleni belső szabályzatát.
          </p>
        </div>
      </form>
    </Card>
  );
}
