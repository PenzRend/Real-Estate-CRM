import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientForm, type ClientFormValues } from "@/components/crm/client-form";
import { Eyebrow } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getClientRow, type ClientRowData } from "@/lib/db/clients";
import { utcToZonedLocal } from "@/lib/i18n/timezone";
import { updateClientAction } from "../../actions";

export const metadata: Metadata = { title: "Ügyfél szerkesztése" };

const plain = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 });
const n = (v: number | null) => (v == null ? "" : plain.format(Number(v)));

function toFormValues(row: ClientRowData, timeZone: string): ClientFormValues {
  return {
    full_name: row.full_name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    client_type: row.client_type,
    status: row.status,
    budget_min: n(row.budget_min),
    budget_max: n(row.budget_max),
    preferred_locations: (row.preferred_locations ?? []).join(", "),
    preferred_property_types: row.preferred_property_types ?? [],
    min_rooms: n(row.min_rooms),
    min_bedrooms: n(row.min_bedrooms),
    min_area_sqm: n(row.min_area_sqm),
    max_area_sqm: n(row.max_area_sqm),
    preferred_condition: row.preferred_condition ?? "",
    desired_move_date: row.desired_move_date ?? "",
    other_requirements: row.other_requirements ?? "",
    next_follow_up_at: utcToZonedLocal(row.next_follow_up_at, timeZone),
    lead_source: row.lead_source ?? "",
    notes: row.notes ?? "",
  };
}

async function EditClientContent({ params }: Pick<PageProps<"/clients/[id]/edit">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const row = await getClientRow(user, id);
  if (!row) notFound();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={<Eyebrow>Ügyfelek</Eyebrow>} title={`${row.full_name} szerkesztése`} />
      <ClientForm
        action={updateClientAction.bind(null, row.id)}
        initialValues={toFormValues(row, user.timezone)}
        submitLabel="Változások mentése"
        cancelHref={`/clients/${row.id}`}
      />
    </div>
  );
}

export default function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditClientContent params={params} />
    </Suspense>
  );
}
