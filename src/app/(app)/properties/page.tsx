import { Building2, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { propertyStatusLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Ingatlanok" };

async function PropertiesContent({ searchParams }: Pick<PageProps<"/properties">, "searchParams">) {
  const params = await searchParams;
  const value = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const filtered = ["q", "status", "type", "min_price", "max_price"].some((k) => value(k));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ingatlanok"
        description="Aktív hirdetések, foglalt és lezárt ingatlanok."
        actions={
          <ButtonLink href="/properties/new">
            <Plus /> Új ingatlan
          </ButtonLink>
        }
      />

      <form role="search" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input name="q" defaultValue={value("q")} placeholder="Város, kerület vagy cím" aria-label="Keresés" className="pl-10" />
        </div>
        <Select name="type" defaultValue={value("type") ?? ""} aria-label="Típus">
          <option value="">Minden típus</option>
          {Object.entries(propertyTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select name="status" defaultValue={value("status") ?? ""} aria-label="Státusz">
          <option value="">Minden státusz</option>
          {Object.entries(propertyStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Input name="min_price" defaultValue={value("min_price")} inputMode="numeric" placeholder="Ár-tól (M Ft)" aria-label="Minimum ár millió forintban" />
        <Input name="max_price" defaultValue={value("max_price")} inputMode="numeric" placeholder="Ár-ig (M Ft)" aria-label="Maximum ár millió forintban" />
        <button type="submit" className="h-11 rounded-xl border border-border-strong px-4 text-sm font-medium text-ink hover:bg-surface">
          Szűrés
        </button>
      </form>

      <Card>
        {filtered ? (
          <EmptyState icon={Search} title="Nincs találat" description="Próbálj tágabb ár- vagy helyszínszűrést." />
        ) : (
          <EmptyState
            icon={Building2}
            title="Még nincs ingatlanod"
            description="Vidd fel az első hirdetést, és a rendszer megmutatja, mely ügyfeleid keresnek hasonlót."
            action={<ButtonLink href="/properties/new"><Plus /> Új ingatlan</ButtonLink>}
          />
        )}
      </Card>
    </div>
  );
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PropertiesContent searchParams={searchParams} />
    </Suspense>
  );
}
