import { Building2, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
import type { ClientMatch, PropertyMatch } from "@/lib/db/matches";
import { formatArea, formatPriceShort } from "@/lib/i18n/format";
import { clientTypeLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import { MatchActions, MatchCategoryBadge, MatchChecks } from "./match-parts";

const LIMIT = 8;

function Explainer() {
  return (
    <p className="border-t border-border px-5 py-3 text-xs text-muted">
      Szabályalapú egyezés: ár, helyszín és típus kötelező, a többi feltételt jelöljük. Zöld: teljesül · sárga: majdnem · piros:
      nem teljesül · szürke: hiányzó adat.
    </p>
  );
}

/** Listings that fit this client, for the client page. */
export function PropertyMatchesCard({ clientId, matches, hasRequirements }: { clientId: string; matches: PropertyMatch[]; hasRequirements: boolean }) {
  return (
    <Card>
      <CardHeader title="Illő ingatlanok" count={matches.length} />
      {matches.length ? (
        <ul className="divide-y divide-border">
          {matches.slice(0, LIMIT).map(({ property: p, match, decision }) => (
            <li key={p.id} className="flex flex-col gap-2.5 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/properties/${p.id}`} className="flex items-center gap-2 font-medium text-ink hover:underline">
                    <Building2 className="size-4 shrink-0 text-muted" />
                    <span className="truncate">{p.title}</span>
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {[p.city, p.district].filter(Boolean).join(", ")}
                    {p.area_sqm != null && ` · ${formatArea(p.area_sqm)}`}
                    {p.price != null && ` · ${formatPriceShort(p.price)}`}
                  </p>
                </div>
                <MatchCategoryBadge category={match.category} />
              </div>
              <MatchChecks checks={match.checks} />
              <MatchActions propertyId={p.id} clientId={clientId} decided={decision === "task_created" ? decision : null} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Search}
          title={hasRequirements ? "Most nincs illő aktív ingatlan" : "Adj meg keresési igényeket"}
          description={
            hasRequirements
              ? "Amint felveszel egy illő ingatlant, itt és az áttekintőn is megjelenik."
              : "Költségkeret, helyszín vagy típus alapján mutatjuk az illő ingatlanokat."
          }
        />
      )}
      {matches.length > 0 && <Explainer />}
    </Card>
  );
}

/** Clients this listing fits, for the property page. */
export function ClientMatchesCard({ propertyId, matches, active }: { propertyId: string; matches: ClientMatch[]; active: boolean }) {
  return (
    <Card>
      <CardHeader title="Illő ügyfelek" count={matches.length} />
      {matches.length ? (
        <ul className="divide-y divide-border">
          {matches.slice(0, LIMIT).map(({ client: c, match, decision }) => (
            <li key={c.id} className="flex flex-col gap-2.5 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-2 font-medium text-ink hover:underline">
                    <UserRound className="size-4 text-muted" />
                    {c.full_name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {clientTypeLabels[c.client_type as keyof typeof clientTypeLabels] ?? c.client_type}
                    {c.preferred_property_types.length > 0 &&
                      ` · ${c.preferred_property_types.map((t) => propertyTypeLabels[t as keyof typeof propertyTypeLabels] ?? t).join(", ")}`}
                  </p>
                </div>
                <MatchCategoryBadge category={match.category} />
              </div>
              <MatchChecks checks={match.checks} />
              <MatchActions propertyId={propertyId} clientId={c.id} decided={decision === "task_created" ? decision : null} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Search}
          title={active ? "Nincs illő aktív ügyfél" : "Csak aktív ingatlanhoz keresünk ügyfelet"}
          description={active ? "Az ügyfelek keresési igényei alapján nézzük: ár, helyszín, típus." : "Állítsd a státuszt Aktívra, és megmutatjuk, kinek ajánlhatod."}
        />
      )}
      {matches.length > 0 && <Explainer />}
    </Card>
  );
}
