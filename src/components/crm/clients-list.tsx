import { Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { ClientStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { formatDate, formatPriceShort } from "@/lib/i18n/format";
import { clientStatusLabels, clientTypeLabels } from "@/lib/i18n/labels";
import type { ClientListItem } from "@/lib/types/view-models";

export type ClientFilters = { q?: string; status?: string; type?: string };

function budget(c: ClientListItem) {
  if (c.budgetMin == null && c.budgetMax == null) return "—";
  if (c.budgetMin != null && c.budgetMax != null)
    return `${formatPriceShort(c.budgetMin).replace(" M Ft", "")}–${formatPriceShort(c.budgetMax)}`;
  return c.budgetMax != null ? `max. ${formatPriceShort(c.budgetMax)}` : `min. ${formatPriceShort(c.budgetMin)}`;
}

/** GET form so filters live in the URL and survive reloads and sharing. */
export function ClientFilterBar({ filters }: { filters: ClientFilters }) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row" role="search">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
        <Input
          name="q"
          defaultValue={filters.q}
          placeholder="Név, e-mail vagy telefonszám"
          aria-label="Keresés"
          className="pl-10"
        />
      </div>
      <Select name="status" defaultValue={filters.status ?? ""} aria-label="Státusz" className="sm:w-44">
        <option value="">Minden státusz</option>
        {Object.entries(clientStatusLabels).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <Select name="type" defaultValue={filters.type ?? ""} aria-label="Ügyféltípus" className="sm:w-40">
        <option value="">Minden típus</option>
        {Object.entries(clientTypeLabels).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <button
        type="submit"
        className="h-11 rounded-xl border border-border-strong px-4 text-sm font-medium text-ink hover:bg-surface"
      >
        Szűrés
      </button>
    </form>
  );
}

export function ClientsTable({
  clients,
  filtered,
  now,
}: {
  clients: ClientListItem[];
  filtered: boolean;
  now: Date;
}) {
  if (!clients.length) {
    return (
      <Card>
        {filtered ? (
          <EmptyState icon={Search} title="Nincs találat" description="Próbálj más keresőszót vagy kevesebb szűrőt." />
        ) : (
          <EmptyState
            icon={Users}
            title="Még nincs ügyfeled"
            description="Add hozzá az első ügyfelet, vagy rögzíts egy hívást, és az AI kitölti helyetted az adatokat."
            action={
              <ButtonLink href="/clients/new">
                <Plus /> Új ügyfél
              </ButtonLink>
            }
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
            <th className="px-5 py-3 font-medium">Név</th>
            <th className="px-3 py-3 font-medium">Státusz</th>
            <th className="px-3 py-3 font-medium">Keresés</th>
            <th className="px-3 py-3 font-medium">Költségkeret</th>
            <th className="px-5 py-3 text-right font-medium">Utánkövetés</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {clients.map((c) => {
            const overdue = c.nextFollowUpAt != null && new Date(c.nextFollowUpAt) < now;
            return (
              <tr key={c.id} className="group relative flex flex-col gap-1 px-5 py-4 hover:bg-surface md:table-row md:p-0">
                <td className="md:px-5 md:py-3.5">
                  <Link href={`/clients/${c.id}`} className="font-medium text-ink after:absolute after:inset-0">
                    {c.fullName}
                  </Link>
                  <div className="text-xs text-muted">
                    {clientTypeLabels[c.clientType]}
                    {c.phone && ` · ${c.phone}`}
                  </div>
                </td>
                <td className="md:px-3 md:py-3.5">
                  <ClientStatusBadge status={c.status} />
                </td>
                <td className="text-muted md:px-3 md:py-3.5">{c.preferredLocations.join(", ") || "—"}</td>
                <td className="text-ink tabular-nums md:px-3 md:py-3.5">{budget(c)}</td>
                <td className={cn("tabular-nums md:px-5 md:py-3.5 md:text-right", overdue ? "text-danger" : "text-muted")}>
                  {c.nextFollowUpAt ? formatDate(c.nextFollowUpAt) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
