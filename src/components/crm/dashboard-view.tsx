import { Building2, CalendarCheck, History, Lightbulb, Plus, UserRound, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClientStatusBadge, Eyebrow } from "@/components/ui/badge";
import { ArrowLink, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatDate, formatLongDate, formatPriceShort } from "@/lib/i18n/format";
import type { DashboardData } from "@/lib/types/view-models";
import { ActivityRow, PropertyRow, TaskRow } from "./items";
import { MatchActions, MatchCategoryBadge } from "./match-parts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("hu-HU", { hour: "numeric", timeZone: "Europe/Budapest" }).format(now));
  if (hour < 10) return "Jó reggelt";
  if (hour < 18) return "Szia";
  return "Jó estét";
}

export function DashboardView({ data, now, away, viewings }: { data: DashboardData; now: Date; away?: ReactNode; viewings?: ReactNode }) {
  const title = data.userFirstName ? `${greeting(now)}, ${data.userFirstName}` : "Áttekintés";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Eyebrow>{formatLongDate(now)}</Eyebrow>}
        title={title}
        description="Ami ma figyelmet kér: levelek, megtekintések és feladatok."
      />

      {away}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {viewings}

          <Card>
            <CardHeader title="Mai feladatok" count={data.overdue.length + data.tasksToday.length} action={<ArrowLink href="/tasks">Összes</ArrowLink>} />
            {data.overdue.length + data.tasksToday.length ? (
              <ul className="divide-y divide-border">
                {data.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} overdue />
                ))}
                {data.tasksToday.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarCheck} title="Mára nincs feladat" description="Ha egy hívás után visszahívást vagy utánkövetést vállalsz, itt jelenik meg." />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <CardHeader title="Javaslatok" count={data.suggestions.length} action={<Lightbulb className="size-4 text-accent" />} />
            {data.suggestions.length ? (
              <ul className="divide-y divide-border">
                {data.suggestions.map((s) => (
                  <li key={s.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        {s.client && s.property ? (
                          <>
                            Ajánld{" "}
                            <Link href={`/clients/${s.client.id}`} className="hover:underline">{s.client.name}</Link>
                            {" részére: "}
                            <Link href={`/properties/${s.property.id}`} className="hover:underline">{s.property.name}</Link>
                          </>
                        ) : (
                          s.title
                        )}
                      </p>
                      {s.category && <MatchCategoryBadge category={s.category} />}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      <span className="font-medium text-text">Miért? </span>
                      {s.reason}
                    </p>
                    {s.client && s.property && UUID.test(s.client.id) && UUID.test(s.property.id) && (
                      <div className="mt-3">
                        <MatchActions propertyId={s.property.id} clientId={s.client.id} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Lightbulb}
                title="Most nincs javaslat"
                description="Ha az elmúlt 14 napban felvett ingatlan illik egy ügyfeled igényeihez, itt jelezzük."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Legutóbbi tevékenység" />
            {data.activity.length ? (
              <ul className="divide-y divide-border">
                {data.activity.map((a) => (
                  <ActivityRow key={a.id} item={a} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={History} title="Még nincs rögzített előzmény" />
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Friss ingatlanok" action={<ArrowLink href="/properties">Összes</ArrowLink>} />
          {data.recentProperties.length ? (
            <ul className="divide-y divide-border">
              {data.recentProperties.map((p) => (
                <PropertyRow key={p.id} property={p} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Building2}
              title="Még nincs ingatlan"
              action={<ButtonLink href="/properties/new" size="sm" variant="secondary"><Plus /> Ingatlan hozzáadása</ButtonLink>}
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Frissített ügyfelek" action={<ArrowLink href="/clients">Összes</ArrowLink>} />
          {data.recentClients.length ? (
            <ul className="divide-y divide-border">
              {data.recentClients.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-sm font-medium text-ink">
                      {c.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{c.fullName}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {[c.preferredLocations.join(", "), c.budgetMax ? `max. ${formatPriceShort(c.budgetMax)}` : null]
                          .filter(Boolean)
                          .join(" · ") || `Frissítve: ${formatDate(c.updatedAt)}`}
                      </p>
                    </div>
                    <ClientStatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Users}
              title="Még nincs ügyfél"
              action={<ButtonLink href="/clients/new" size="sm" variant="secondary"><UserRound /> Ügyfél hozzáadása</ButtonLink>}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
