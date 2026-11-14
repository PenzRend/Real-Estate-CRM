import { CalendarClock, ChevronLeft, ChevronRight, Snowflake, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardHeader, Panel } from "@/components/ui/card";
import { ListSuspense, PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";
import { ViewTabs, ViewTabsPlaceholder } from "@/components/ui/view-tabs";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDate, formatPrice } from "@/lib/i18n/format";
import { getSummary, type SummaryScope } from "@/lib/summary/data";
import { change, PERIOD_KINDS, periodNames, summaryLine, type PeriodKind, type SummaryNumbers } from "@/lib/summary/period";
import { listTeam } from "@/lib/team";

export const metadata: Metadata = { title: "Összefoglaló" };

const VIEWS = PERIOD_KINDS.map((k) => ({ value: k, label: periodNames[k] }));
const SCOPES = [
  { value: "me", label: "Én" },
  { value: "office", label: "Iroda" },
];

const STATS: { key: keyof SummaryNumbers; label: string; money?: boolean }[] = [
  { key: "newClients", label: "Új ügyfél" },
  { key: "conversations", label: "Hívás, levél, találkozó" },
  { key: "viewings", label: "Megtekintés" },
  { key: "newListings", label: "Új megbízás" },
  { key: "offers", label: "Új ügylet" },
  { key: "dealsWon", label: "Lezárt ügylet" },
  { key: "commission", label: "Jutalék", money: true },
  { key: "tasksDone", label: "Elvégzett teendő" },
];

const hhmm = (iso: string) => new Intl.DateTimeFormat("hu-HU", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" }).format(new Date(iso));
const compareTo: Record<PeriodKind, string> = { day: "naphoz", week: "héthez", month: "hónaphoz" };
const comingTitle: Record<PeriodKind, string> = { day: "Holnap", week: "Jövő héten", month: "Jövő hónapban" };

async function Content({ searchParams }: Pick<PageProps<"/summary">, "searchParams">) {
  const params = await searchParams;
  const kind = (PERIOD_KINDS as string[]).includes(String(params.view)) ? (params.view as PeriodKind) : "day";
  const offset = Math.min(0, Math.max(-60, Math.trunc(Number(params.offset) || 0)));
  const user = await getCurrentUser();
  const canSeeOffice = user.organization.role !== "member";
  const scope: SummaryScope = canSeeOffice && params.scope === "office" ? "office" : "me";
  const s = await getSummary(user, kind, new Date(), { offset, scope });
  const href = (o: number) => `/summary?view=${kind}${o ? `&offset=${o}` : ""}${scope === "office" ? "&scope=office" : ""}`;
  const office = scope === "office";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href={href(offset - 1)} className="grid size-9 place-items-center rounded-full border border-border text-ink hover:bg-surface" aria-label="Előző">
          <ChevronLeft className="size-4" />
        </Link>
        <h2 className="min-w-0 flex-1 text-center text-lg font-semibold tracking-[-0.02em] text-ink sm:flex-none sm:px-3">{s.period.label}</h2>
        {offset < 0 ? (
          <Link href={href(offset + 1)} className="grid size-9 place-items-center rounded-full border border-border text-ink hover:bg-surface" aria-label="Következő">
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className="size-9" />
        )}
      </div>

      <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-ink">{summaryLine(s.now)}</p>

      <Panel className="grid grid-cols-2 sm:grid-cols-4">
        {STATS.map((x, i) => {
          const value = s.now[x.key];
          const delta = x.money ? "" : change(value, s.before[x.key]);
          return (
            <div key={x.key} className={cn("min-w-0 p-4", i % 2 === 1 && "border-l border-border", i % 4 !== 0 && "sm:border-l", i >= 2 && "border-t border-border", i < 4 && "sm:border-t-0")}>
              <div className="flex items-baseline gap-2">
                <span className="truncate text-[20px] font-medium tracking-[-0.02em] text-ink tabular-nums sm:text-[24px]">{x.money ? formatPrice(value) : value}</span>
                {delta && <span className={cn("text-xs tabular-nums", delta.startsWith("↑") ? "text-success" : "text-danger")}>{delta}</span>}
              </div>
              <div className="mt-1 text-xs text-muted sm:text-sm">{x.label}</div>
            </div>
          );
        })}
      </Panel>
      <p className="-mt-3 text-xs text-muted">A nyilak az előző {compareTo[kind]} képest mutatják a változást.</p>

      {office && s.agents.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Kollégánként" count={s.agents.length} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 font-medium">Név</th>
                  <th className="px-2 py-2 font-medium">Új ügyfél</th>
                  <th className="px-2 py-2 font-medium">Beszélgetés</th>
                  <th className="px-2 py-2 font-medium">Megtekintés</th>
                  <th className="px-2 py-2 font-medium">Lezárt</th>
                  <th className="px-5 py-2 text-right font-medium">Jutalék</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {s.agents.map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-2.5 font-medium text-ink">{a.name}</td>
                    <td className="px-2 py-2.5">{a.numbers.newClients}</td>
                    <td className="px-2 py-2.5">{a.numbers.conversations}</td>
                    <td className="px-2 py-2.5">{a.numbers.viewings}</td>
                    <td className="px-2 py-2.5">{a.numbers.dealsWon}</td>
                    <td className="px-5 py-2.5 text-right">{formatPrice(a.numbers.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {s.coming && (
          <Card className="overflow-hidden">
            <CardHeader title={comingTitle[kind]} count={s.coming.viewings.length + s.coming.tasks.length} action={<CalendarClock className="size-4 text-muted" />} />
            {s.coming.viewings.length + s.coming.tasks.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Még nincs semmi beütemezve.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {s.coming.viewings.map((v) => (
                  <li key={v.id} className="flex items-start gap-3 px-5 py-2.5">
                    <span className="w-24 shrink-0 text-xs text-muted tabular-nums">{hhmm(v.startsAt)}</span>
                    <span className="min-w-0">
                      <span className="font-medium text-ink">Megtekintés: {v.client}</span>
                      {v.place && <span className="block truncate text-xs text-muted">{v.place}</span>}
                    </span>
                  </li>
                ))}
                {s.coming.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-2.5">
                    <span className="w-24 shrink-0 text-xs text-muted tabular-nums">{hhmm(t.dueAt)}</span>
                    <span className="min-w-0 text-ink">{t.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card className="overflow-hidden">
          <CardHeader title="Kihűlő ügyfelek" count={s.cold.length} action={<Snowflake className="size-4 text-accent" />} />
          {s.cold.length ? (
            <ul className="divide-y divide-border text-sm">
              {s.cold.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <Link href={`/clients/${c.id}`} className="truncate font-medium text-ink hover:underline">
                    {c.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{c.lastContactedAt ? `utoljára ${formatDate(c.lastContactedAt)}` : "még nem kerested"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted">Minden aktív ügyféllel beszéltél az elmúlt két hétben.</p>
          )}
          {s.overdueTasks > 0 && (
            <Link href="/tasks" className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm text-danger hover:bg-danger-soft">
              <TriangleAlert className="size-4" /> {s.overdueTasks} lejárt teendő vár rád
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}

async function ScopeTabs() {
  const user = await getCurrentUser();
  if (user.organization.role === "member") return null;
  const { members } = await listTeam(user);
  if (members.length < 2) return null;
  return <ViewTabs param="scope" label="Kié" items={SCOPES} keep={["view", "offset"]} />;
}

export default function SummaryPage({ searchParams }: PageProps<"/summary">) {
  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <PageHeader title="Összefoglaló" description="Mit végeztél egy nap, egy hét vagy egy hónap alatt, mi jön, és kit érdemes újra felhívni." />
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={<ViewTabsPlaceholder label="Időszak" items={VIEWS} />}>
            <ViewTabs label="Időszak" items={VIEWS} keep={["scope"]} />
          </Suspense>
          <Suspense fallback={null}>
            <ScopeTabs />
          </Suspense>
        </div>
        <ListSuspense>
          <Content searchParams={searchParams} />
        </ListSuspense>
      </div>
    </PageTransition>
  );
}
