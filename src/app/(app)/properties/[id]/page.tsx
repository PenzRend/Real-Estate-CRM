import { Archive, ArchiveRestore } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PropertyDetailView } from "@/components/crm/property-detail-view";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { matchesForProperty } from "@/lib/db/matches";
import { getPropertyDetail } from "@/lib/db/properties";
import { ClientMatchesCard } from "@/components/crm/match-lists";
import { archivePropertyAction, restorePropertyAction } from "../actions";

export const metadata: Metadata = { title: "Ingatlan" };

async function PropertyContent({ params }: Pick<PageProps<"/properties/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const [property, matches] = await Promise.all([getPropertyDetail(user, id), matchesForProperty(user, id)]);
  if (!property) notFound();

  const actions = property.archived_at ? (
    <form action={restorePropertyAction.bind(null, property.id)}>
      <Button type="submit" variant="secondary">
        <ArchiveRestore /> Visszaállítás
      </Button>
    </form>
  ) : (
    <ConfirmAction
      action={archivePropertyAction.bind(null, property.id)}
      trigger={
        <>
          <Archive /> Archiválás
        </>
      }
      title={`${property.title} archiválása`}
      description="Az ingatlan kikerül a listákból, de minden adata megmarad. Bármikor visszaállíthatod."
      confirmLabel="Archiválás"
    />
  );

  return (
    <PropertyDetailView
      property={property}
      actions={actions}
      matches={property.archived_at ? null : <ClientMatchesCard propertyId={property.id} matches={matches} active={property.status === "active"} />}
    />
  );
}

export default function PropertyPage({ params }: PageProps<"/properties/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PropertyContent params={params} />
    </Suspense>
  );
}
