import { Archive, CalendarClock, ChevronLeft, Mail, Mic, Pencil, Phone, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ClientStatusBadge } from "@/components/ui/badge";
import { ArrowLink, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
import { formatArea, formatDate, formatDateTime, formatNumber, formatPrice } from "@/lib/i18n/format";
import { clientTypeLabels, interactionTypeLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import type { ClientDetail } from "@/lib/types/view-models";
import { interactionIcons, PropertyRow, TaskRow } from "./items";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{children ?? "—"}</dd>
    </div>
  );
}

export function ClientDetailView({
  client,
  actions,
  archivedAt,
  notice,
  matches,
  viewings,
}: {
  client: ClientDetail;
  /** Extra header actions, e.g. archive / restore. */
  actions?: ReactNode;
  archivedAt?: string | null;
  /** One-off confirmation shown after a save, e.g. from quick capture. */
  notice?: string | null;
  /** Matching listings card. */
  matches?: ReactNode;
  /** Booked and past viewings card. */
  viewings?: ReactNode;
}) {
  const r = client.requirements;
  const budget =
    client.budgetMin != null || client.budgetMax != null
      ? [client.budgetMin, client.budgetMax].map((v) => (v == null ? "…" : formatPrice(v))).join(" – ")
      : null;
  const requirements = (
    [
      ["Költségkeret", budget],
      ["Helyszín", client.preferredLocations.join(", ")],
      ["Típus", r.propertyTypes.map((t) => propertyTypeLabels[t as keyof typeof propertyTypeLabels] ?? t).join(", ")],
      ["Szobák", r.minRooms != null ? `min. ${formatNumber(r.minRooms)}` : null],
      ["Hálószobák", r.minBedrooms != null ? `min. ${formatNumber(r.minBedrooms)}` : null],
      [
        "Alapterület",
        r.minAreaSqm != null || r.maxAreaSqm != null ? [r.minAreaSqm, r.maxAreaSqm].map((v) => (v == null ? "…" : formatArea(v))).join(" – ") : null,
      ],
      ["Költözés", r.desiredMoveDate ? formatDate(r.desiredMoveDate) : null],
    ] satisfies [string, string | null][]
  ).filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
        {notice && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
            <Sparkles className="size-4" /> {notice}
          </p>
        )}
        {archivedAt && (
          <p className="flex items-center gap-2 rounded-2xl bg-surface-strong px-4 py-3 text-sm text-text">
            <Archive className="size-4 text-muted" />
            Archivált ügyfél ({formatDate(archivedAt)}). Nem jelenik meg a listákban és az utánkövetésekben.
          </p>
        )}
        <Link href="/clients" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Ügyfelek
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ClientStatusBadge status={client.status} />
              <Badge>{clientTypeLabels[client.clientType]}</Badge>
            </div>
            <h1 className="mt-3 text-[28px] leading-tight sm:text-[34px]">{client.fullName}</h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions}
            <ButtonLink href={`/clients/${client.id}/edit`} variant="secondary">
              <Pencil /> Szerkesztés
            </ButtonLink>
            <ButtonLink href={`/interactions/new?client=${client.id}`}>
              <Mic /> Rögzítés
            </ButtonLink>
          </div>
        </div>

        <Panel className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {[
            { icon: Phone, label: "Telefon", value: client.phone, href: client.phone ? `tel:${client.phone}` : null },
            { icon: Mail, label: "E-mail", value: client.email, href: client.email ? `mailto:${client.email}` : null },
            { icon: CalendarClock, label: "Következő utánkövetés", value: client.nextFollowUpAt ? formatDateTime(client.nextFollowUpAt) : null },
            { icon: RefreshCw, label: "Utolsó kapcsolat", value: client.lastContactedAt ? formatDate(client.lastContactedAt) : null },
          ].map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-4">
              <Icon className="size-4 shrink-0 text-subtle" />
              <div className="min-w-0">
                <p className="text-xs text-muted">{label}</p>
                {href && value ? (
                  <a href={href} className="block truncate text-sm font-medium text-ink hover:underline">{value}</a>
                ) : (
                  <p className="truncate text-sm font-medium text-ink">{value ?? "—"}</p>
                )}
              </div>
            </div>
          ))}
        </Panel>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {viewings}

          {matches}

          <Card>
            <CardHeader title="Előzmények" count={client.interactions.length} />
            {client.interactions.length ? (
              <ol className="relative px-5 py-2">
                <span aria-hidden className="absolute top-6 bottom-6 left-[35px] w-px bg-border" />
                {client.interactions.map((i) => {
                  const Icon = interactionIcons[i.type];
                  return (
                    <li key={i.id} className="relative flex gap-4 py-4">
                      <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-muted">
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="font-medium text-ink">{interactionTypeLabels[i.type]}</span>
                          {i.source === "ai_assisted" && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent">
                              <Sparkles className="size-2.5" /> AI
                            </span>
                          )}
                          <span className="text-xs text-muted">{formatDateTime(i.occurredAt)}</span>
                          {i.property && (
                            <Link href={`/properties/${i.property.id}`} className="text-xs text-accent hover:underline">
                              {i.property.name}
                            </Link>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-text">{i.summary}</p>
                        {i.outcome && (
                          <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs whitespace-pre-line text-muted">
                            {i.outcome}
                          </p>
                        )}
                        {i.notes && i.notes !== i.summary && (
                          <details className="mt-2 text-xs text-muted">
                            <summary className="cursor-pointer hover:text-ink">Teljes jegyzet</summary>
                            <p className="mt-1.5 whitespace-pre-line">{i.notes}</p>
                          </details>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState icon={Phone} title="Még nincs rögzített előzmény" />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Keresési igények" action={<ArrowLink href={`/clients/${client.id}/edit`}>Szerkesztés</ArrowLink>} />
            {/* Only what is known: a new client would otherwise show a column of dashes. */}
            {requirements.length ? (
              <dl className="divide-y divide-border px-5 py-1">
                {requirements.map(([label, value]) => (
                  <Detail key={label} label={label}>
                    {value}
                  </Detail>
                ))}
              </dl>
            ) : (
              !r.other && <p className="px-5 py-4 text-sm text-muted">Még nincs megadva. Egy rögzített hívásból Flavio kitölti, vagy add meg a szerkesztésnél.</p>
            )}
            {r.other && <p className="border-t border-border px-5 py-3 text-sm text-muted">{r.other}</p>}
          </Card>

          {client.notes && (
            <Card>
              <CardHeader title="Megjegyzés" />
              <p className="px-5 py-4 text-sm whitespace-pre-line text-text">{client.notes}</p>
            </Card>
          )}

          <Card>
            <CardHeader title="Feladatok" count={client.tasks.length} />
            {client.tasks.length ? (
              <ul className="divide-y divide-border">
                {client.tasks.map((t) => (
                  <TaskRow key={t.id} task={{ ...t, client: null }} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Nincs nyitott feladat.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Kapcsolódó ingatlanok" count={client.relatedProperties.length} />
            {client.relatedProperties.length ? (
              <ul className="divide-y divide-border">
                {client.relatedProperties.map((p) => (
                  <PropertyRow key={p.id} property={p} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Még nincs kapcsolódó ingatlan.</p>
            )}
          </Card>

          <p className="px-1 text-xs text-subtle">
            Létrehozva: {formatDate(client.createdAt)} · Módosítva: {formatDate(client.updatedAt)}
            {client.leadSource && ` · Forrás: ${client.leadSource}`}
          </p>
        </div>
      </div>
    </div>
  );
}
