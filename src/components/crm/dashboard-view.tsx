import { AlarmClock, Building2, CalendarCheck, History, Plus, Sparkles, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { ClientStatusBadge, Eyebrow } from "@/components/ui/badge";
import { ArrowLink, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, StatRow } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatDate, formatLongDate, formatPriceShort } from "@/lib/i18n/format";
import type { DashboardData } from "@/lib/types/view-models";
import { ActivityRow, PropertyRow, TaskRow } from "./items";

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("hu-HU", { hour: "numeric", timeZone: "Europe/Budapest" }).format(now));
  if (hour < 10) return "Jó reggelt";
  if (hour < 18) return "Szép napot";
  return "Jó estét";
}

export function DashboardView({ data, now }: { data: DashboardData; now: Date }) {
  const title = data.userFirstName ? `${greeting(now)}, ${data.userFirstName}` : "Áttekintés";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Eyebrow>{formatLongDate(now)}</Eyebrow>}
        title={title}
        description="Ami ma figyelmet kér: teendők, utánkövetések és a legutóbbi mozgások."
        actions={
          <>
            <ButtonLink href="/clients/new" variant="secondary">
              <Plus /> Új ügyfél
            </ButtonLink>
            <ButtonLink href="/interactions/new">Hívás rögzítése</ButtonLink>
          </>
        }
      />

      <StatRow
        stats={[
          { label: "Mai feladat", value: data.counts ? data.tasksToday.length : "—" },
          {
            label: "Lejárt teendő",
            value: data.counts ? data.overdue.length : "—",
            hint: data.overdue.length ? "Érdemes ma rendezni" : undefined,
          },
          { label: "Aktív ügyfél", value: data.counts?.activeClients ?? "—" },
          { label: "Aktív ingatlan", value: data.counts?.activeProperties ?? "—" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Mai teendők" count={data.tasksToday.length} action={<ArrowLink href="/tasks">Összes</ArrowLink>} />
            {data.tasksToday.length ? (
              <ul className="divide-y divide-border">
                {data.tasksToday.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarCheck} title="Mára nincs teendő" description="Ha egy hívás után utánkövetést vállalsz, itt fog megjelenni." />
            )}
          </Card>

          <Card>
            <CardHeader title="Lejárt utánkövetések" count={data.overdue.length} />
            {data.overdue.length ? (
              <ul className="divide-y divide-border">
                {data.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} overdue />
                ))}
              </ul>
            ) : (
              <EmptyState icon={AlarmClock} title="Nincs lejárt teendő" description="Minden utánkövetés időben megtörtént." />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <CardHeader
              title="AI-javaslatok"
              count={data.suggestions.length}
              action={<Sparkles className="size-4 text-accent" />}
            />
            {data.suggestions.length ? (
              <ul className="divide-y divide-border">
                {data.suggestions.map((s) => (
                  <li key={s.id} className="px-5 py-4">
                    <p className="text-sm font-medium text-ink">{s.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      <span className="font-medium text-text">Miért? </span>
                      {s.reason}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className="whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover">
                        Feladat létrehozása
                      </button>
                      <button type="button" className="rounded-full px-3 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-ink">
                        Elvetés
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Sparkles} title="Még nincs javaslat" description="A javaslatok a rögzített hívásokból és teendőkből készülnek." />
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
              <EmptyState icon={History} title="Nincs még rögzített kapcsolattartás" />
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
