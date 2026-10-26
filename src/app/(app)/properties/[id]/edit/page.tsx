import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PropertyForm, type PropertyFormValues } from "@/components/crm/property-form";
import { Eyebrow } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getPropertyRow, listOwnerOptions, type PropertyRow } from "@/lib/db/properties";
import { updatePropertyAction } from "../../actions";

export const metadata: Metadata = { title: "Ingatlan szerkesztése" };

const plain = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 });
const n = (v: number | null) => (v == null ? "" : plain.format(Number(v)));
const flag = (b: boolean | null) => (b == null ? "" : String(b));

function toFormValues(r: PropertyRow): PropertyFormValues {
  return {
    title: r.title,
    reference_number: r.reference_number ?? "",
    property_type: r.property_type,
    status: r.status,
    listing_type: r.listing_type,
    listing_source: r.listing_source ?? "",
    owner_client_id: r.owner_client_id ?? "",
    city: r.city ?? "",
    district: r.district ?? "",
    address: r.address ?? "",
    postal_code: r.postal_code ?? "",
    price: n(r.price),
    currency: r.currency,
    area_sqm: n(r.area_sqm),
    room_count: n(r.room_count),
    bedroom_count: n(r.bedroom_count),
    bathroom_count: n(r.bathroom_count),
    floor: r.floor ?? "",
    building_type: r.building_type ?? "",
    condition: r.condition ?? "",
    energy_rating: r.energy_rating ?? "",
    has_balcony: flag(r.has_balcony),
    has_garden: flag(r.has_garden),
    has_parking: flag(r.has_parking),
    description: r.description ?? "",
    internal_notes: r.internal_notes ?? "",
  };
}

async function EditPropertyContent({ params }: Pick<PageProps<"/properties/[id]/edit">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const [row, owners] = await Promise.all([getPropertyRow(user, id), listOwnerOptions(user)]);
  if (!row) notFound();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={<Eyebrow>Ingatlanok</Eyebrow>} title={`${row.title} szerkesztése`} />
      <PropertyForm
        action={updatePropertyAction.bind(null, row.id)}
        owners={owners}
        initialValues={toFormValues(row)}
        submitLabel="Változások mentése"
        cancelHref={`/properties/${row.id}`}
      />
    </div>
  );
}

export default function EditPropertyPage({ params }: PageProps<"/properties/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditPropertyContent params={params} />
    </Suspense>
  );
}
