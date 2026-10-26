import { Archive, CalendarClock, ChevronLeft, Mail, Pencil, Phone, Plus, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ClientStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
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
}: {
  client: ClientDetail;
  /** Extra header actions, e.g. archive / restore. */
  actions?: ReactNode;
  archivedAt?: string | null;
}) {
  const r = client.requirements;
  const budget =
    client.budgetMin != null || client.budgetMax != null
      ? [client.budgetMin, client.budgetMax].map((v) => (v == null ? "…" : formatPrice(v))).join(" – ")
      : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5">
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
            <h1 className="mt-3 text-[34px] leading-tight">{client.fullName}</h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions}
            <ButtonLink href={`/clients/${client.id}/edit`} variant="secondary">
              <Pencil /> Szerkesztés
            </ButtonLink>
            <ButtonLink href={`/interactions/new?client=${client.id}`}>Hívás rögzítése</ButtonLink>
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

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card className="border-accent/15 bg-gradient-to-b from-accent-soft/60 to-background">
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <h2 className="flex items-center gap-2 text-base tracking-tight">
                <Sparkles className="size-4 text-accent" /> AI-összefoglaló
              </h2>
              {client.aiSummary && (
                <button type="button" className="text-xs font-medium text-muted hover:text-ink">Újragenerálás</button>
              )}
            </div>
            <div className="px-5 pt-3 pb-5">
              {client.aiSummary ? (
                <>
                  <p className="text-[15px] leading-relaxed text-ink">{client.aiSummary.text}</p>
                  <p className="mt-3 text-xs text-muted">
                    A rögzített adatok és kapcsolattartások alapján · {formatDateTime(client.aiSummary.generatedAt)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">Még nincs összefoglaló. Néhány rögzített hívás után érdemes elkészíteni.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Kapcsolattartási előzmények"
              count={client.interactions.length}
              action={
                <ButtonLink href={`/interactions/new?client=${client.id}`} size="sm" variant="secondary">
                  <Plus /> Új bejegyzés
                </ButtonLink>
              }
            />
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
                          <span className="text-xs text-muted">{formatDateTime(i.occurredAt)}</span>
                          {i.property && (
                            <Link href={`/properties/${i.property.id}`} className="text-xs text-accent hover:underline">
                              {i.property.name}
                            </Link>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-text">{i.summary}</p>
                        {i.outcome && (
                          <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
                            <span className="font-medium text-text">Eredmény: </span>
                            {i.outcome}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState icon={Phone} title="Még nincs rögzített kapcsolattartás" />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Keresési igények" />
            <dl className="divide-y divide-border px-5 py-1">
              <Detail label="Költségkeret">{budget}</Detail>
              <Detail label="Helyszín">{client.preferredLocations.join(", ") || null}</Detail>
              <Detail label="Típus">
                {r.propertyTypes.map((t) => propertyTypeLabels[t as keyof typeof propertyTypeLabels] ?? t).join(", ") || null}
              </Detail>
              <Detail label="Szobák">{r.minRooms != null ? `min. ${formatNumber(r.minRooms)}` : null}</Detail>
              <Detail label="Hálószobák">{r.minBedrooms != null ? `min. ${formatNumber(r.minBedrooms)}` : null}</Detail>
              <Detail label="Alapterület">
                {r.minAreaSqm != null || r.maxAreaSqm != null
                  ? [r.minAreaSqm, r.maxAreaSqm].map((v) => (v == null ? "…" : formatArea(v))).join(" – ")
                  : null}
              </Detail>
              <Detail label="Költözés">{r.desiredMoveDate ? formatDate(r.desiredMoveDate) : null}</Detail>
            </dl>
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
