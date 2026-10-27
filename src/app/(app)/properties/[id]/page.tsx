import { Archive, ArchiveRestore } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PropertyDetailView } from "@/components/crm/property-detail-view";
import { PropertyMedia } from "@/components/media/property-media";
import { ShareButton } from "@/components/shares/share-button";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { recordTitle } from "@/lib/db/titles";
import { matchesForProperty } from "@/lib/db/matches";
import { listMedia } from "@/lib/db/media";
import { getPropertyDetail } from "@/lib/db/properties";
import { defaultContact, getActiveShare } from "@/lib/shares/data";
import { ClientMatchesCard } from "@/components/crm/match-lists";
import { ViewingsCard } from "@/components/viewings/viewings-card";
import { listViewingsFor } from "@/lib/viewings/data";
import { archivePropertyAction, restorePropertyAction } from "../actions";
import { FormSubmit } from "@/components/ui/form-submit";

export async function generateMetadata({ params }: PageProps<"/properties/[id]">): Promise<Metadata> {
  return { title: await recordTitle("properties", (await params).id, "Ingatlan") };
}

async function PropertyContent({ params }: Pick<PageProps<"/properties/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const [property, matches, media, share, contact, viewings] = await Promise.all([
    getPropertyDetail(user, id),
    matchesForProperty(user, id),
    listMedia(user, id),
    getActiveShare(user, id),
    defaultContact(user),
    listViewingsFor(user, { propertyId: id }),
  ]);
  if (!property) notFound();

  const actions = property.archived_at ? (
    <form action={restorePropertyAction.bind(null, property.id)}>
      <FormSubmit className={buttonClasses("secondary")}>
        <ArchiveRestore /> Visszaállítás
      </FormSubmit>
    </form>
  ) : (
    <>
      <ShareButton propertyId={property.id} share={share} defaults={contact} />
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
    </>
  );

  return (
    <PropertyDetailView
      property={property}
      actions={actions}
      matches={property.archived_at ? null : <ClientMatchesCard propertyId={property.id} matches={matches} active={property.status === "active"} />}
      viewings={
        <ViewingsCard viewings={viewings} now={new Date().toISOString()} showProperty={false} empty="Még nem volt foglalt megtekintés ehhez az ingatlanhoz." />
      }
      media={<PropertyMedia propertyId={property.id} organizationId={user.organization.id} items={media} sourceUrl={property.source_url} />}
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
