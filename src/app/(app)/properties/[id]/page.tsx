import { Archive, ArchiveRestore } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PropertyDetailView } from "@/components/crm/property-detail-view";
import { PropertyMedia } from "@/components/media/property-media";
import { ShareButton } from "@/components/shares/share-button";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { recordTitle } from "@/lib/db/titles";
import { matchesForProperty } from "@/lib/db/matches";
import { listMedia } from "@/lib/db/media";
import { getPropertyDetail } from "@/lib/db/properties";
import { defaultContact, getActiveShare } from "@/lib/shares/data";
import { ClientMatchesCard } from "@/components/crm/match-lists";
import { ViewingsCard } from "@/components/viewings/viewings-card";
import { listViewingsFor } from "@/lib/viewings/data";
import { DealsCard } from "@/components/deals/deals-card";
import { SellerReportCard } from "@/components/reports/seller-report-card";
import { listReports, reportTarget } from "@/lib/reports/data";
import { listDealsFor } from "@/lib/deals/data";
import { archivePropertyAction, restorePropertyAction } from "../actions";
import { FormSubmit } from "@/components/ui/form-submit";

export async function generateMetadata({ params }: PageProps<"/properties/[id]">): Promise<Metadata> {
  return { title: await recordTitle("properties", (await params).id, "Ingatlan") };
}

async function PropertyContent({ params, searchParams }: Pick<PageProps<"/properties/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // Just created or imported: the matching buyers are offered it straight away.
  const justAdded = query.new === "1";
  const user = await getCurrentUser();
  const [property, matches, media, share, contact, viewings, deals, target, reports] = await Promise.all([
    getPropertyDetail(user, id),
    matchesForProperty(user, id),
    listMedia(user, id),
    getActiveShare(user, id),
    defaultContact(user),
    listViewingsFor(user, { propertyId: id }),
    listDealsFor(user, { propertyId: id }),
    reportTarget(user, id),
    listReports(user, id),
  ]);
  if (!property) notFound();
  const draftMatches = property.status === "draft" ? (await matchesForProperty(user, id, { preview: true })).length : 0;

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
      matches={property.archived_at ? null : <ClientMatchesCard propertyId={property.id} matches={matches} active={property.status === "active"} justAdded={justAdded} draftMatches={draftMatches} />}
      viewings={
        <ViewingsCard viewings={viewings} now={new Date().toISOString()} showProperty={false} empty="Még nem volt foglalt megtekintés ehhez az ingatlanhoz." />
      }
      sellerReport={
        property.archived_at || !target ? null : (
          <SellerReportCard
            propertyId={property.id}
            owner={target.ownerId ? { id: target.ownerId, name: target.ownerName ?? "Tulajdonos", email: target.ownerEmail } : null}
            weekly={target.weekly}
            reports={reports}
          />
        )
      }
      deals={property.archived_at && !deals.length ? null : <DealsCard deals={deals} newHref={`/deals/new?property=${property.id}`} empty="Még nincs ügylet. Ha egy vevő ajánlatot tesz, indíts egyet." />}
      media={<PropertyMedia propertyId={property.id} organizationId={user.organization.id} items={media} sourceUrl={property.source_url} />}
    />
  );
}

export default function PropertyPage({ params, searchParams }: PageProps<"/properties/[id]">) {
  return (
    <PageSuspense>
      <PropertyContent params={params} searchParams={searchParams} />
    </PageSuspense>
  );
}
