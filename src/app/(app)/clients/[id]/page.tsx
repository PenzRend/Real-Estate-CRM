import { ShareToChat } from "@/components/chat/share-to-chat";
import { Archive, ArchiveRestore } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientDetailView } from "@/components/crm/client-detail-view";
import { EraseClientButton } from "@/components/crm/erase-client";
import { buttonClasses } from "@/components/ui/button";
import { MoreActions } from "@/components/ui/more-actions";
import { UndoableButton } from "@/components/ui/undoable-button";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { recordTitle } from "@/lib/db/titles";
import { getClientDetail } from "@/lib/db/clients";
import { matchesForClient } from "@/lib/db/matches";
import { listOwnedProperties } from "@/lib/db/properties";
import { PropertyMatchesCard } from "@/components/crm/match-lists";
import { BookViewingButton, ViewingsCard } from "@/components/viewings/viewings-card";
import { listViewingsFor } from "@/lib/viewings/data";
import { DealsCard } from "@/components/deals/deals-card";
import { IdentificationCard } from "@/components/aml/identification-card";
import { identificationSummaries } from "@/lib/aml/data";
import { listDealsFor } from "@/lib/deals/data";
import { archiveClientAction, restoreClientAction } from "../actions";
import { FormSubmit } from "@/components/ui/form-submit";

export async function generateMetadata({ params }: PageProps<"/clients/[id]">): Promise<Metadata> {
  return { title: await recordTitle("clients", (await params).id, "Ügyfél") };
}

async function ClientContent({ params, searchParams }: PageProps<"/clients/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const [detail, owned, matches, viewings, deals, identifications] = await Promise.all([
    getClientDetail(user, id),
    listOwnedProperties(user, id),
    matchesForClient(user, id),
    listViewingsFor(user, { clientId: id }),
    listDealsFor(user, { clientId: id }),
    identificationSummaries(user, [id]),
  ]);
  if (!detail) notFound();
  // Owned listings first, then properties linked through interest/viewings.
  const linkedIds = new Set(detail.relatedProperties.map((p) => p.id));
  const client = {
    ...detail,
    relatedProperties: [...owned.filter((p) => !linkedIds.has(p.id)).map((p) => ({ ...p, relation: "owner" })), ...detail.relatedProperties],
  };

  const archiveAction = client.archivedAt ? (
    <>
      {user.organization.role !== "member" && <EraseClientButton clientId={client.id} name={client.fullName} />}
      <form action={restoreClientAction.bind(null, client.id)}>
        <FormSubmit className={buttonClasses("secondary")}>
          <ArchiveRestore /> Visszaállítás
        </FormSubmit>
      </form>
    </>
  ) : (
    <UndoableButton action={archiveClientAction.bind(null, client.id)} undo={restoreClientAction.bind(null, client.id)} done={`${client.fullName} archiválva – kikerült a listákból, minden adata megmaradt.`}>
      <Archive /> Archiválás
    </UndoableButton>
  );
  const actions = (
    <>
      {!client.archivedAt && <BookViewingButton clientId={client.id} variant="secondary" />}
      {!client.archivedAt && <ShareToChat kind="client" id={client.id} title={client.fullName} />}
      {client.archivedAt ? archiveAction : <MoreActions>{archiveAction}</MoreActions>}
    </>
  );

  const notice =
    query.saved === "1"
      ? "Elmentve. Az ügyfél adatai, az előzmények és a feladatok frissültek."
      : query.identified === "1"
        ? "Az azonosítás elmentve (titkosítva). Az adatlapot az azonosítás oldalán nyomtathatod ki aláírásra."
        : null;
  const hasRequirements = Boolean(
    client.budgetMin != null || client.budgetMax != null || client.preferredLocations.length || client.requirements.propertyTypes.length,
  );
  const wantsListings = ["buyer", "investor", "tenant"].includes(client.clientType);
  return (
    <ClientDetailView
      client={client}
      actions={actions}
      archivedAt={client.archivedAt}
      notice={notice}
      viewings={
        viewings.length || wantsListings ? (
          <ViewingsCard viewings={viewings} now={new Date().toISOString()} showClient={false} empty="Még nincs foglalt megtekintés." />
        ) : null
      }
      identification={
        client.archivedAt ? null : <IdentificationCard clientId={client.id} summary={identifications.get(client.id) ?? null} today={new Date().toISOString().slice(0, 10)} />
      }
      deals={
        deals.length || (!client.archivedAt && wantsListings) ? (
          <DealsCard deals={deals} newHref={`/deals/new?buyer=${client.id}`} empty="Még nincs ügylet. Ha ajánlatot tesz egy ingatlanra, indíts egyet." />
        ) : null
      }
      matches={wantsListings && !client.archivedAt ? <PropertyMatchesCard clientId={client.id} matches={matches} hasRequirements={hasRequirements} /> : null}
    />
  );
}

export default function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  return (
    <PageSuspense>
      <ClientContent params={params} searchParams={searchParams} />
    </PageSuspense>
  );
}
