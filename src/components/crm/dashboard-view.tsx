import { CalendarCheck, ChevronDown, Lightbulb, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/badge";
import { ArrowLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/i18n/format";
import type { DashboardData } from "@/lib/types/view-models";
import { ActivityRow, TaskRow } from "./items";
import { MatchActions, MatchCategoryBadge, MatchCheckList } from "./match-parts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("hu-HU", { hour: "numeric", timeZone: "Europe/Budapest" }).format(now));
  if (hour < 10) return "Jó reggelt";
  if (hour < 18) return "Szia";
  return "Jó estét";
}

function Suggestions({ items }: { items: DashboardData["suggestions"] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Javaslatok" count={items.length} action={<Lightbulb className="size-4 text-accent" />} />
      <ul className="divide-y divide-border">
        {items.map((s) => (
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
            {s.details && s.client && s.property && <SuggestionDetails details={s.details} client={s.client} property={s.property} />}
            {s.client && s.property && UUID.test(s.client.id) && UUID.test(s.property.id) && (
              <div className="mt-3">
                <MatchActions propertyId={s.property.id} clientId={s.client.id} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * "Részletek": opens under a suggestion to judge the fit before offering –
 * each wish against the listing, the client's other wishes in their words,
 * and the listing's facts, cover photo and description.
 */
function SuggestionDetails({
  details: d,
  client,
  property,
}: {
  details: NonNullable<DashboardData["suggestions"][number]["details"]>;
  client: { id: string; name: string };
  property: { id: string; name: string };
}) {
  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-accent select-none hover:underline [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Részletek: tényleg illik?</span>
        <span className="hidden group-open:inline">Részletek elrejtése</span>
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-4 rounded-2xl bg-surface/70 p-4 sm:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h4 className="text-[11px] font-medium tracking-wide text-subtle uppercase">Igény ↔ ingatlan</h4>
          {d.checks.length ? <MatchCheckList checks={d.checks} /> : <p className="text-xs text-muted">Az ügyfélnek nincs rögzített igénye.</p>}
          {d.wishes && (
            <p className="text-xs leading-relaxed text-text">
              <span className="font-medium text-ink">További kérései: </span>
              {d.wishes}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <Link href={`/clients/${client.id}`} className="font-medium text-ink hover:underline">
              {client.name} adatlapja →
            </Link>
            {d.phone && (
              <a href={`tel:${d.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-muted hover:text-ink">
                <Phone className="size-3" /> {d.phone}
              </a>
            )}
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h4 className="text-[11px] font-medium tracking-wide text-subtle uppercase">Az ingatlan</h4>
          <div className="flex gap-3">
            {d.photo && (
              // Signed storage link: a plain img, no optimiser round trip.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.photo} alt="" className="size-16 shrink-0 rounded-xl object-cover" loading="lazy" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              {d.address && (
                <p className="flex items-start gap-1 text-xs text-text">
                  <MapPin className="mt-px size-3 shrink-0 text-muted" /> {d.address}
                </p>
              )}
              {d.facts.length > 0 && <p className="text-xs text-text">{d.facts.join(" · ")}</p>}
            </div>
          </div>
          {d.description && <p className="text-xs leading-relaxed text-muted">{d.description}</p>}
          <Link href={`/properties/${property.id}`} className="mt-1 text-xs font-medium text-ink hover:underline">
            Az ingatlan adatlapja →
          </Link>
        </section>
      </div>
    </details>
  );
}

/** A small heading inside a list, e.g. "Lejárt" above the overdue tasks. */
function ListLabel({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" }) {
  return (
    <li className={cn("bg-surface/70 px-5 py-1.5 text-[11px] font-medium tracking-wide uppercase", tone === "danger" ? "text-danger" : "text-subtle")}>
      {children}
    </li>
  );
}

/** For a new workspace: the three things that make the rest of the dashboard come alive. */
export function DashboardView({
  data,
  now,
  strip,
  away,
  viewings,
  deals,
  welcome,
  route,
}: {
  /** "Mai útvonal" on a viewing day. */
  route?: ReactNode;
  data: DashboardData;
  now: Date;
  /** "Első lépések" for a new agent. */
  welcome?: ReactNode;
  strip?: ReactNode;
  away?: ReactNode;
  viewings?: ReactNode;
  deals?: ReactNode;
}) {
  const title = data.userFirstName ? `${greeting(now)}, ${data.userFirstName}` : "Áttekintés";
  const due = data.overdue.length + data.tasksToday.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={<Eyebrow>{formatLongDate(now)}</Eyebrow>} title={title} description="Egy pillantás a napodra: fent a számok, alatta, amivel most érdemes foglalkozni." />

      {welcome}

      {strip}

      {route}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Mai teendők" count={due} action={<ArrowLink href="/tasks">Összes</ArrowLink>} />
            {due ? (
              <ul className="divide-y divide-border">
                {data.overdue.length > 0 && <ListLabel tone="danger">Lejárt</ListLabel>}
                {data.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} overdue />
                ))}
                {data.overdue.length > 0 && data.tasksToday.length > 0 && <ListLabel>Ma</ListLabel>}
                {data.tasksToday.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarCheck} title="Mára nincs teendő" description="Ha egy hívás után visszahívást vagy utánkövetést vállalsz, itt jelenik meg." />
            )}
          </Card>

          {away}

          {viewings}
        </div>

        <div className="flex flex-col gap-6">
          {deals}

          {data.suggestions.length > 0 && <Suggestions items={data.suggestions} />}

          {data.activity.length > 0 && (
            <Card>
              <CardHeader title="Legutóbbi tevékenység" />
              <ul className="divide-y divide-border">
                {data.activity.map((a) => (
                  <ActivityRow key={a.id} item={a} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
