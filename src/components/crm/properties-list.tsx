import { Building2, Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { PropertyStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/page";
import { formatArea, formatNumber, formatPrice } from "@/lib/i18n/format";
import { listingTypeLabels, propertyStatusLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import type { PropertyListEntry } from "@/lib/db/properties";

/** Raw filter values from the URL, as typed. */
export type PropertyFilters = {
  q?: string;
  type?: string;
  status?: string;
  listing?: string;
  minPrice?: string;
  maxPrice?: string;
  minRooms?: string;
  minArea?: string;
  maxArea?: string;
  balcony?: string;
  garden?: string;
  parking?: string;
  archived?: string;
};

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-xl border border-border-strong px-3.5 text-sm text-ink has-[:checked]:border-ink has-[:checked]:bg-surface">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

/** GET form so filters live in the URL and survive reloads and sharing. */
export function PropertyFilterBar({ filters }: { filters: PropertyFilters }) {
  const advanced = Boolean(
    filters.minPrice || filters.maxPrice || filters.minRooms || filters.minArea || filters.maxArea ||
      filters.balcony || filters.garden || filters.parking || filters.archived,
  );
  const any = advanced || Boolean(filters.q || filters.type || filters.status || filters.listing);
  return (
    <form className="flex flex-col gap-2" role="search">
      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input name="q" defaultValue={filters.q} placeholder="Megnevezés, cím, kerület vagy azonosító" aria-label="Keresés" className="pl-10" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
          <Select name="type" defaultValue={filters.type ?? ""} aria-label="Típus" className="lg:w-36">
            <option value="">Minden típus</option>
            {Object.entries(propertyTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select name="listing" defaultValue={filters.listing ?? ""} aria-label="Eladó vagy kiadó" className="lg:w-44">
            <option value="">Eladó és kiadó</option>
            {Object.entries(listingTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select name="status" defaultValue={filters.status ?? ""} aria-label="Státusz" className="lg:w-40">
            <option value="">Minden státusz</option>
            {Object.entries(propertyStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <button type="submit" className="h-11 rounded-xl bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover">
            Szűrés
          </button>
        </div>
      </div>

      <details open={advanced}>
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 py-1 text-sm text-muted hover:text-ink">
          <SlidersHorizontal className="size-3.5" />
          További szűrők
          {any && (
            <Link href="/properties" className="ml-3 text-ink underline-offset-4 hover:underline">
              Szűrők törlése
            </Link>
          )}
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input name="minPrice" defaultValue={filters.minPrice} inputMode="decimal" placeholder="Ár-tól (M Ft)" aria-label="Minimum ár millió forintban" />
          <Input name="maxPrice" defaultValue={filters.maxPrice} inputMode="decimal" placeholder="Ár-ig (M Ft)" aria-label="Maximum ár millió forintban" />
          <Input name="minRooms" defaultValue={filters.minRooms} inputMode="decimal" placeholder="Min. szoba" aria-label="Minimum szobaszám" />
          <Input name="minArea" defaultValue={filters.minArea} inputMode="decimal" placeholder="Min. m²" aria-label="Minimum alapterület" />
          <Input name="maxArea" defaultValue={filters.maxArea} inputMode="decimal" placeholder="Max. m²" aria-label="Maximum alapterület" />
          <Check name="balcony" label="Erkély / terasz" checked={filters.balcony === "1"} />
          <Check name="garden" label="Kert" checked={filters.garden === "1"} />
          <Check name="parking" label="Parkolás" checked={filters.parking === "1"} />
          <Check name="archived" label="Csak archiváltak" checked={filters.archived === "1"} />
        </div>
        {(filters.minPrice || filters.maxPrice) && (
          <p className="mt-2 text-xs text-muted">Az árszűrő csak a forintban meghirdetett ingatlanokra vonatkozik.</p>
        )}
      </details>
    </form>
  );
}

export function PropertiesTable({
  properties,
  filtered,
  archivedCount = 0,
  covers = {},
}: {
  properties: PropertyListEntry[];
  filtered: boolean;
  /** Shown when the active list is empty but archived properties exist. */
  archivedCount?: number;
  /** Cover preview links by property id. */
  covers?: Record<string, string>;
}) {
  if (!properties.length) {
    return (
      <Card>
        {filtered ? (
          <EmptyState icon={Search} title="Nincs találat" description="Próbálj tágabb ár- vagy helyszínszűrést." />
        ) : archivedCount > 0 ? (
          <EmptyState
            icon={Building2}
            title="Nincs aktív ingatlan"
            description={`${archivedCount} archivált ingatlanod van. Bármikor visszaállíthatod őket.`}
            action={<ButtonLink href="/properties?archived=1" variant="secondary">Archiváltak megtekintése</ButtonLink>}
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="Még nincs ingatlanod"
            description="Vidd fel az első hirdetést, és a rendszer megmutatja, mely ügyfeleid keresnek hasonlót."
            action={<ButtonLink href="/properties/new"><Plus /> Új ingatlan</ButtonLink>}
          />
        )}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="hidden border-b border-border bg-surface text-left text-xs text-muted md:table-header-group">
          <tr>
            <th className="px-5 py-3 font-medium">Ingatlan</th>
            <th className="px-3 py-3 font-medium">Típus</th>
            <th className="px-3 py-3 font-medium">Méret</th>
            <th className="px-3 py-3 text-right font-medium">Ár</th>
            <th className="px-5 py-3 text-right font-medium">Státusz</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {properties.map((p) => (
            <tr key={p.id} className="relative flex flex-col gap-1 px-5 py-4 hover:bg-surface md:table-row md:p-0">
              <td className="md:px-5 md:py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-strong">
                    {covers[p.id] ? (
                      // Signed link to a small, already resized preview.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={covers[p.id]} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <Building2 className="size-4 text-subtle" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/properties/${p.id}`} className="font-medium text-ink after:absolute after:inset-0">
                      {p.title}
                    </Link>
                    <div className="text-xs text-muted">{[p.city, p.district].filter(Boolean).join(", ") || "Helyszín nincs megadva"}</div>
                  </div>
                </div>
              </td>
              <td className="text-muted md:px-3 md:py-3.5">
                {propertyTypeLabels[p.propertyType]} · {listingTypeLabels[p.listingType].toLowerCase()}
              </td>
              <td className="text-muted tabular-nums md:px-3 md:py-3.5">
                {[p.areaSqm != null ? formatArea(p.areaSqm) : null, p.roomCount != null ? `${formatNumber(p.roomCount)} szoba` : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
              <td className="font-medium text-ink tabular-nums md:px-3 md:py-3.5 md:text-right">
                {formatPrice(p.price, p.currency)}
                {p.listingType === "rent" && p.price != null && <span className="font-normal text-muted"> / hó</span>}
              </td>
              <td className="md:px-5 md:py-3.5 md:text-right">
                <PropertyStatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
