"use client";

import { Handshake, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { createDealAction, type FormState } from "@/app/(app)/deals/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { formatPrice } from "@/lib/i18n/format";

export type DealPropertyOption = { id: string; name: string; reference: string | null; ownerId: string | null; price: number | null; currency: "HUF" | "EUR" };
export type DealClientOption = { id: string; name: string; detail: string | null };

/**
 * A new deal: the listing, the buyer (the seller is the listing's owner unless
 * changed), the first offer and the commission. Everything else is filled in
 * on the deal's page as it happens.
 */
export function DealForm({
  properties,
  clients,
  propertyId,
  buyerId,
  defaultPercent,
}: {
  properties: DealPropertyOption[];
  clients: DealClientOption[];
  propertyId: string | null;
  buyerId: string | null;
  defaultPercent: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createDealAction, {});
  const [property, setProperty] = useState(propertyId ?? "");
  const chosen = properties.find((p) => p.id === property);
  const [seller, setSeller] = useState(chosen?.ownerId ?? "");

  return (
    <Card className="p-5 sm:p-6">
      <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Ingatlan" htmlFor="deal-property">
            <Select
              id="deal-property"
              name="propertyId"
              required
              value={property}
              onChange={(e) => {
                setProperty(e.target.value);
                setSeller(properties.find((p) => p.id === e.target.value)?.ownerId ?? "");
              }}
            >
              <option value="">Válassz ingatlant…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.reference ? ` (#${p.reference})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Vevő" htmlFor="deal-buyer">
          <Select id="deal-buyer" name="buyerClientId" defaultValue={buyerId ?? ""}>
            <option value="">Még nincs megadva</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.detail ? ` · ${c.detail}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Eladó" htmlFor="deal-seller" hint={chosen?.ownerId ? "Az ingatlan tulajdonosa." : undefined}>
          <Select id="deal-seller" name="sellerClientId" value={seller} onChange={(e) => setSeller(e.target.value)}>
            <option value="">Még nincs megadva</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vevő ajánlata" htmlFor="deal-offer" hint={chosen?.price != null ? `Irányár: ${formatPrice(chosen.price, chosen.currency)}` : "Pl. 79 000 000 vagy 79M"}>
          <Input id="deal-offer" name="offer" inputMode="decimal" placeholder="79M" />
        </Field>
        <Field label="Megállapodott vételár" htmlFor="deal-price" hint="Ha már megegyeztek; később is megadhatod.">
          <Input id="deal-price" name="agreedPrice" inputMode="decimal" />
        </Field>
        <Field label="Jutalék (%)" htmlFor="deal-percent" hint="A megállapodott vételárból számoljuk.">
          <Input id="deal-percent" name="commissionPercent" inputMode="decimal" defaultValue={defaultPercent} />
        </Field>
        <Field label="Vagy fix jutalék" htmlFor="deal-fixed" hint="Ha meg van adva, ezt használjuk.">
          <Input id="deal-fixed" name="commissionAmount" inputMode="decimal" />
        </Field>
        <input type="hidden" name="currency" value={chosen?.currency ?? "HUF"} />
        <input type="hidden" name="offerBy" value="buyer" />
        <div className="sm:col-span-2">
          <Field label="Megjegyzés" htmlFor="deal-notes">
            <Textarea id="deal-notes" name="notes" placeholder="Pl. hitelből vásárol, a foglaló 2 M Ft." className="min-h-20" />
          </Field>
        </div>
        {state.error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">
            {state.error}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Handshake />} Ügylet indítása
          </Button>
        </div>
      </form>
    </Card>
  );
}
