import { Archive, ArchiveRestore } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientDetailView } from "@/components/crm/client-detail-view";
import { EraseClientButton } from "@/components/crm/erase-client";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { recordTitle } from "@/lib/db/titles";
import { getClientDetail } from "@/lib/db/clients";
import { matchesForClient } from "@/lib/db/matches";
import { listOwnedProperties } from "@/lib/db/properties";
import { PropertyMatchesCard } from "@/components/crm/match-lists";
import { BookViewingButton, ViewingsCard } from "@/components/viewings/viewings-card";
import { listViewingsFor } from "@/lib/viewings/data";
import { archiveClientAction, restoreClientAction } from "../actions";
import { FormSubmit } from "@/components/ui/form-submit";

export async function generateMetadata({ params }: PageProps<"/clients/[id]">): Promise<Metadata> {
  return { title: await recordTitle("clients", (await params).id, "Ügyfél") };
}

async function ClientContent({ params, searchParams }: PageProps<"/clients/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const [detail, owned, matches, viewings] = await Promise.all([
    getClientDetail(user, id),
    listOwnedProperties(user, id),
    matchesForClient(user, id),
    listViewingsFor(user, { clientId: id }),
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
    <ConfirmAction
      action={archiveClientAction.bind(null, client.id)}
      trigger={
        <>
          <Archive /> Archiválás
        </>
      }
      title={`${client.fullName} archiválása`}
      description="Az ügyfél kikerül a listákból és az utánkövetésekből, de minden adata megmarad. Bármikor visszaállíthatod."
      confirmLabel="Archiválás"
    />
  );
  const actions = (
    <>
      {archiveAction}
      {!client.archivedAt && <BookViewingButton clientId={client.id} variant="secondary" />}
    </>
  );

  const notice = query.saved === "1" ? "Elmentve. Az ügyfél adatai, az előzmények és a feladatok frissültek." : null;
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
      matches={wantsListings && !client.archivedAt ? <PropertyMatchesCard clientId={client.id} matches={matches} hasRequirements={hasRequirements} /> : null}
    />
  );
}

export default function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
