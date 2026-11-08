import { CalendarCheck, Lightbulb } from "lucide-react";
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
import { MatchActions, MatchCategoryBadge } from "./match-parts";

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
