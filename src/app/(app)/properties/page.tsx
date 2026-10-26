import { Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertiesTable, PropertyFilterBar, type PropertyFilters } from "@/components/crm/properties-list";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { coverThumbs } from "@/lib/db/media";
import { countArchivedProperties, LIST_LIMIT, listProperties, type PropertyListFilters } from "@/lib/db/properties";
import { parseHungarianNumber } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Ingatlanok" };

const KEYS = [
  "q", "type", "status", "listing", "minPrice", "maxPrice", "minRooms", "minArea", "maxArea",
  "balcony", "garden", "parking", "archived",
] as const;

function readFilters(params: Record<string, string | string[] | undefined>): PropertyFilters {
  const filters: PropertyFilters = {};
  for (const k of KEYS) {
    const v = params[k];
    if (typeof v === "string" && v) filters[k] = v.slice(0, 100);
  }
  return filters;
}

const number = (v?: string) => {
  const n = parseHungarianNumber(v ?? "");
  return typeof n === "number" && !Number.isNaN(n) ? n : undefined;
};

/** Turns raw URL values into a safe query; unknown values are ignored. */
function toQuery(f: PropertyFilters): PropertyListFilters {
  return {
    q: f.q,
    type: f.type,
    status: f.status,
    listing: f.listing === "sale" || f.listing === "rent" ? f.listing : undefined,
    minPriceM: number(f.minPrice),
    maxPriceM: number(f.maxPrice),
    minRooms: number(f.minRooms),
    minArea: number(f.minArea),
    maxArea: number(f.maxArea),
    balcony: f.balcony === "1",
    garden: f.garden === "1",
    parking: f.parking === "1",
    archived: f.archived === "1",
  };
}

async function PropertiesContent({ searchParams }: Pick<PageProps<"/properties">, "searchParams">) {
  const filters = readFilters(await searchParams);
  const user = await getCurrentUser();
  const { properties, total } = await listProperties(user, toQuery(filters));
  const filtered = Object.values(filters).some(Boolean);
  const [archivedCount, covers] = await Promise.all([
    total === 0 && !filtered ? countArchivedProperties(user) : 0,
    coverThumbs(user, properties.map((p) => p.id)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ingatlanok"
        description="Aktív hirdetések, foglalt és lezárt ingatlanok."
        actions={
          <>
            <ButtonLink href="/properties/import" variant="secondary">
              <Download /> Importálás hirdetésből
            </ButtonLink>
            <ButtonLink href="/properties/new">
              <Plus /> Új ingatlan
            </ButtonLink>
          </>
        }
      />
      <PropertyFilterBar filters={filters} />
      {total > 0 && (
        <p className="-mb-3 text-sm text-muted" aria-live="polite">
          {total > LIST_LIMIT ? `${total} ingatlanból az első ${LIST_LIMIT} látható. Szűkítsd a keresést.` : `${total} ingatlan`}
        </p>
      )}
      <PropertiesTable properties={properties} filtered={filtered} archivedCount={archivedCount} covers={covers} />
    </div>
  );
}

export default function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PropertiesContent searchParams={searchParams} />
    </Suspense>
  );
}
