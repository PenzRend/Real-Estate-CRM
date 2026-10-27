import { Archive, Check, ChevronLeft, ExternalLink, Eye, MapPin, Minus, Pencil, PlayCircle, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, PropertyStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
import type { PropertyDetail } from "@/lib/db/properties";
import { extrasForDisplay } from "@/lib/properties/extras";
import { BookViewingButton } from "@/components/viewings/viewings-card";
import { PropertyStatusPicker } from "./property-status-picker";
import { formatArea, formatDate, formatDateTime, formatNumber, formatPrice } from "@/lib/i18n/format";
import { interactionTypeLabels, listingTypeLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import { interactionIcons, TaskRow } from "./items";

const relationLabels: Record<string, string> = {
  interested: "Érdeklődik",
  viewed: "Megnézte",
  offered: "Ajánlatot tett",
  rejected: "Elutasította",
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{children ?? "—"}</dd>
    </div>
  );
}

function Feature({ label, value }: { label: string; value: boolean | null }) {
  const Icon = value ? Check : Minus;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${value ? "text-ink" : "text-subtle"}`}>
      <Icon className="size-4" />
      {label}
      {value == null && <span className="sr-only"> (nincs megadva)</span>}
    </span>
  );
}

export function PropertyDetailView({
  property: p,
  actions,
  matches,
  media,
  viewings,
}: {
  property: PropertyDetail;
  actions?: ReactNode;
  /** Matching clients card. */
  matches?: ReactNode;
  /** Photo and video gallery. */
  media?: ReactNode;
  /** Booked and past viewings card. */
  viewings?: ReactNode;
}) {
  const location = [p.postal_code, p.city, p.district].filter(Boolean).join(" ");
  const videoLinks = Array.isArray(p.features?.video_links) ? p.features.video_links.filter((v) => typeof v === "string" && v.startsWith("https://")) : [];
  const pricePerSqm =
    p.price != null && p.area_sqm ? formatPrice(Math.round(p.price / p.area_sqm), p.currency) + " / m²" : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        {p.archived_at && (
          <p className="flex items-center gap-2 rounded-2xl bg-surface-strong px-4 py-3 text-sm text-text">
            <Archive className="size-4 text-muted" />
            Archivált ingatlan ({formatDate(p.archived_at)}). Nem jelenik meg a listákban.
          </p>
        )}
        <Link href="/properties" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Ingatlanok
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {p.archived_at ? <PropertyStatusBadge status={p.status} /> : <PropertyStatusPicker id={p.id} status={p.status} />}
              <Badge>{propertyTypeLabels[p.property_type]}</Badge>
              <Badge>{listingTypeLabels[p.listing_type]}</Badge>
              {p.reference_number && <span className="text-xs text-muted">#{p.reference_number}</span>}
            </div>
            <h1 className="mt-3 text-[30px] leading-tight sm:text-[34px]">{p.title}</h1>
            {location && (
              <p className="mt-1 flex items-center gap-1.5 text-muted">
                <MapPin className="size-4" /> {location}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions}
            <ButtonLink href={`/properties/${p.id}/edit`} variant="secondary">
              <Pencil /> Szerkesztés
            </ButtonLink>
            {!p.archived_at && <BookViewingButton propertyId={p.id} />}
          </div>
        </div>

        <Panel className="grid grid-cols-2 lg:grid-cols-4">
          {[
            { label: p.listing_type === "rent" ? "Bérleti díj / hó" : "Irányár", value: formatPrice(p.price, p.currency) },
            { label: "Alapterület", value: formatArea(p.area_sqm) },
            { label: "Szobák", value: p.room_count != null ? formatNumber(p.room_count) : "—" },
            { label: "Négyzetméterár", value: pricePerSqm ?? "—" },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`p-5 ${i % 2 === 1 ? "border-l border-border" : ""} ${i >= 2 ? "border-t border-border lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
            >
              <div className="text-[22px] leading-tight font-medium tracking-[-0.03em] text-ink tabular-nums sm:text-[26px]">{s.value}</div>
              <div className="mt-2 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </Panel>
      </header>

      {media}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {viewings}

          {matches}

          <Card>
            <CardHeader title="Leírás" />
            {p.description ? (
              <p className="px-5 py-4 text-[15px] leading-relaxed whitespace-pre-line text-text">{p.description}</p>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Még nincs leírás.</p>
            )}
            {(p.source_url || videoLinks.length > 0) && (
              <div className="flex flex-col gap-1.5 border-t border-border px-5 py-3 text-sm">
                {videoLinks.map((v) => (
                  <a key={v} href={v} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 font-medium text-ink hover:text-accent">
                    <PlayCircle className="size-4 text-muted" /> {new URL(v).hostname.includes("matterport") || new URL(v).hostname.includes("kuula") ? "Virtuális séta" : "Videó"}: {new URL(v).hostname.replace(/^www\./, "")}
                    <ExternalLink className="size-3.5 text-muted" />
                  </a>
                ))}
                {p.source_url && (
                  <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-muted hover:text-ink">
                    Importálva innen: {p.source_url.replace(/^https:\/\//, "")} <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Előzmények" count={p.interactions.length} />
            {p.interactions.length ? (
              <ul className="divide-y divide-border">
                {p.interactions.map((i) => {
                  const Icon = interactionIcons[i.type];
                  return (
                    <li key={i.id} className="flex gap-3 px-5 py-4">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted">
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="font-medium text-ink">{interactionTypeLabels[i.type]}</span>
                          {i.client && (
                            <Link href={`/clients/${i.client.id}`} className="text-accent hover:underline">{i.client.name}</Link>
                          )}
                          <span className="text-xs text-muted">{formatDateTime(i.occurredAt)}</span>
                        </p>
                        {i.summary && <p className="mt-1 text-sm text-text">{i.summary}</p>}
                        {i.outcome && <p className="mt-1 text-xs text-muted">Eredmény: {i.outcome}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={Eye} title="Még nincs rögzített előzmény" />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Tulajdonos" />
            {p.owner ? (
              <Link href={`/clients/${p.owner.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-surface">
                <span className="grid size-9 place-items-center rounded-full bg-surface-strong text-muted">
                  <UserRound className="size-4" />
                </span>
                <span className="text-sm font-medium text-ink">{p.owner.name}</span>
              </Link>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Nincs megadva. A szerkesztésnél választhatsz az ügyfeleid közül.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Részletek" />
            <dl className="divide-y divide-border px-5 py-1">
              <Detail label="Cím">{p.address}</Detail>
              <Detail label="Emelet">{p.floor}</Detail>
              <Detail label="Hálószobák">{p.bedroom_count != null ? formatNumber(p.bedroom_count) : null}</Detail>
              <Detail label="Fürdőszobák">{p.bathroom_count != null ? formatNumber(p.bathroom_count) : null}</Detail>
              <Detail label="Épület">{p.building_type}</Detail>
              <Detail label="Állapot">{p.condition}</Detail>
              <Detail label="Energetika">{p.energy_rating}</Detail>
              <Detail label="Forrás">{p.listing_source}</Detail>
              {extrasForDisplay(p.features).map((x) => (
                <Detail key={x.label} label={x.label}>
                  {x.value}
                </Detail>
              ))}
            </dl>
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-5 py-4">
              <Feature label="Erkély / terasz" value={p.has_balcony} />
              <Feature label="Kert" value={p.has_garden} />
              <Feature label="Parkolás" value={p.has_parking} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Érdeklődő ügyfelek" count={p.relatedClients.length} />
            {p.relatedClients.length ? (
              <ul className="divide-y divide-border">
                {p.relatedClients.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface">
                      <span className="font-medium text-ink">{c.name}</span>
                      <Badge>{relationLabels[c.relation] ?? c.relation}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Még nincs érdeklődő ügyfél.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Feladatok" count={p.tasks.length} />
            {p.tasks.length ? (
              <ul className="divide-y divide-border">
                {p.tasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Nincs nyitott feladat.</p>
            )}
          </Card>

          {p.internal_notes && (
            <Card>
              <CardHeader title="Belső megjegyzés" />
              <p className="px-5 py-4 text-sm whitespace-pre-line text-text">{p.internal_notes}</p>
            </Card>
          )}

          <p className="px-1 text-xs text-subtle">
            Felvéve: {formatDate(p.created_at)} · Módosítva: {formatDate(p.updated_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
