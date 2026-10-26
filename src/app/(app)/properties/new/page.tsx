import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertyForm } from "@/components/crm/property-form";
import { Eyebrow } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listOwnerOptions } from "@/lib/db/properties";
import { createPropertyAction } from "../actions";

export const metadata: Metadata = { title: "Új ingatlan" };

async function NewPropertyContent({ searchParams }: Pick<PageProps<"/properties/new">, "searchParams">) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const owners = await listOwnerOptions(user);
  // Arriving from a client page preselects that client as owner.
  const owner = typeof params.owner === "string" && owners.some((o) => o.id === params.owner) ? params.owner : "";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Eyebrow>Ingatlanok</Eyebrow>}
        title="Új ingatlan"
        description="A párosításhoz a helyszín, az ár, az alapterület és a szobaszám a legfontosabb."
        actions={
          <ButtonLink href="/properties/import" variant="secondary">
            <Download /> Importálás hirdetésből
          </ButtonLink>
        }
      />
      <PropertyForm
        action={createPropertyAction}
        owners={owners}
        initialValues={owner ? { owner_client_id: owner } : undefined}
        submitLabel="Ingatlan mentése"
        cancelHref="/properties"
      />
    </div>
  );
}

export default function NewPropertyPage({ searchParams }: PageProps<"/properties/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewPropertyContent searchParams={searchParams} />
    </Suspense>
  );
}
