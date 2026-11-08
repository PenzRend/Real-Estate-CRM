import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { AiBreakdownRow, configStatus, DailyRow, FeedbackItem, Overview, SystemStatus, WorkspaceUsage } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber } from "@/lib/i18n/format";

// The admin dashboard's read-only parts. The numbers come from lib/admin.ts.

// Supabase free plan: what the pilot runs inside.
const FREE = { dbBytes: 500 * 1024 ** 2, storageBytes: 1024 ** 3 };

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("hu-HU", { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
}

/** "3 perce", "2 napja"; null as "soha". */
export function ago(iso: string | null, now = Date.now()) {
  if (!iso) return "soha";
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 1) return "most";
  if (min < 60) return `${min} perce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} órája`;
  const d = Math.round(h / 24);
  return d < 60 ? `${d} napja` : formatDate(iso);
}

export function Card({ title, description, children, className }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border border-border p-5", className)}>
      {(title || description) && (
        <div>
          {title && <h2 className="text-base">{title}</h2>}
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "warning" | "danger" }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("text-2xl leading-tight tabular-nums", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink")}>{value}</p>
      {sub && <p className="text-xs text-subtle">{sub}</p>}
    </div>
  );
}

export function Meter({ label, used, total, format = formatNumber }: { label: string; used: number; total: number; format?: (n: number) => string }) {
  const share = total > 0 ? Math.min(used / total, 1) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink">{label}</span>
        <span className="text-muted tabular-nums">
          {format(used)} / {format(total)} · {Math.round(share * 100)}%
        </span>
      </div>
      <span className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
        <span className={cn("block h-full rounded-full", share >= 0.9 ? "bg-danger" : share >= 0.7 ? "bg-warning" : "bg-ink")} style={{ width: `${Math.max(share * 100, used > 0 ? 1 : 0)}%` }} />
      </span>
    </div>
  );
}

/** Thirty days as bars; the hover title gives the exact day and number. */
function DailyBars({ rows, value, accent, label }: { rows: DailyRow[]; value: (r: DailyRow) => number; accent?: (r: DailyRow) => number; label: string }) {
  const max = Math.max(1, ...rows.map(value));
  const total = rows.reduce((s, r) => s + value(r), 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="text-muted tabular-nums">{formatNumber(total)} / 30 nap</span>
      </div>
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={`${label}: ${total} az elmúlt 30 napban`}>
        {rows.map((r) => {
          const v = value(r);
          const a = accent?.(r) ?? 0;
          return (
            <span key={r.day} title={`${formatDate(r.day)}: ${v}${accent ? ` (${a} hiba)` : ""}`} className="relative flex h-full flex-1 flex-col justify-end">
              <span className={cn("block w-full rounded-t-sm", v ? "bg-ink" : "bg-surface")} style={{ height: v ? `${Math.max((v / max) * 100, 4)}%` : "2px" }}>
                {a > 0 && <span className="block w-full rounded-t-sm bg-danger" style={{ height: `${(a / v) * 100}%` }} />}
              </span>
            </span>
          );
        })}
      </div>
      {rows.length > 0 && (
        <div className="flex justify-between text-[11px] text-subtle">
          <span>{formatDate(rows[0].day)}</span>
          <span>{formatDate(rows[rows.length - 1].day)}</span>
        </div>
      )}
    </div>
  );
}

type Alert = { tone: "danger" | "warning"; text: string };

/** What needs a look, in plain words: the first card of the overview. */
function alerts(o: Overview, s: SystemStatus | null, config: ReturnType<typeof configStatus>): Alert[] {
  const out: Alert[] = [];
  for (const c of config.checks) if (!c.ok && !c.optional) out.push({ tone: "danger", text: `Hiányzik a szerveren: ${c.name} (${c.what}).` });
  if (s) {
    const staleMin = s.lastMailSync ? (Date.now() - Date.parse(s.lastMailSync)) / 60_000 : null;
    if (o.mailboxes > 0 && (staleMin === null || staleMin > 15))
      out.push({ tone: "danger", text: `A levelek ${ago(s.lastMailSync)} szinkronizáltak utoljára: a cron-job.org „mail” feladata valószínűleg nem fut.` });
    if (s.dbBytes > FREE.dbBytes * 0.8) out.push({ tone: "warning", text: `Az adatbázis ${formatBytes(s.dbBytes)}: közel az ingyenes 500 MB-hoz.` });
    if (s.storageBytes > FREE.storageBytes * 0.8) out.push({ tone: "warning", text: `A tárhely ${formatBytes(s.storageBytes)}: közel az ingyenes 1 GB-hoz.` });
    if (s.outboxFailed.length) out.push({ tone: "warning", text: `${s.outboxFailed.length} automatikus levél küldése nem sikerült.` });
    if (s.calendarErrors.length) out.push({ tone: "warning", text: `${s.calendarErrors.length} naptárkapcsolat hibás.` });
  }
  if (o.mailboxes_broken) out.push({ tone: "warning", text: `${o.mailboxes_broken} postafiókot újra kell kapcsolni.` });
  if (o.ai_calls >= 10 && o.ai_errors / o.ai_calls > 0.1)
    out.push({ tone: "warning", text: `Az AI-hívások ${Math.round((o.ai_errors / o.ai_calls) * 100)}%-a hibával ért véget ebben a hónapban.` });
  if (o.users - o.users_confirmed > 0) out.push({ tone: "warning", text: `${o.users - o.users_confirmed} fiók nem erősítette meg az e-mail-címét (SMTP beállítva?).` });
  return out;
}

export function OverviewTab({
  overview: o,
  daily,
  system,
  config,
  workspaces,
  defaultLimit,
}: {
  overview: Overview;
  daily: DailyRow[];
  system: SystemStatus | null;
  config: ReturnType<typeof configStatus>;
  workspaces: WorkspaceUsage[];
  defaultLimit: number | null;
}) {
  const list = alerts(o, system, config);
  // What the AI caps add up to this month, against what was used.
  const capTotal = defaultLimit === null && workspaces.every((w) => w.limit === null) ? null : workspaces.reduce((s, w) => s + (w.limit ?? defaultLimit ?? 0), 0);
  const nearCap = workspaces.filter((w) => {
    const cap = w.limit ?? defaultLimit;
    return cap !== null && cap > 0 && w.calls / cap >= 0.8;
  });

  return (
    <div className="flex flex-col gap-6">
      <Card title={list.length ? "Figyelmet kér" : "Minden rendben"}>
        {list.length ? (
          <ul className="flex flex-col gap-2">
            {list.map((a) => (
              <li key={a.text} className="flex items-start gap-2 text-sm text-ink">
                <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", a.tone === "danger" ? "text-danger" : "text-warning")} />
                {a.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <CheckCircle2 className="size-4 text-success" /> Nincs hiba, minden beállítás megvan.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Felhasználók" value={formatNumber(o.users)} sub={`+${o.signups_7d} az elmúlt 7 napban · +${o.signups_30d} / 30 nap`} />
        <Kpi label="Aktív (7 nap)" value={formatNumber(o.active_7d)} sub={`Ma: ${o.active_1d} · 30 nap: ${o.active_30d}`} />
        <Kpi label="Munkaterületek" value={formatNumber(o.workspaces)} sub={`${o.teams} csapat (több tag)`} />
        <Kpi
          label="AI-hívás ebben a hónapban"
          value={formatNumber(o.ai_calls)}
          sub={`${formatNumber(o.ai_tokens)} token · ${o.ai_errors} hiba`}
          tone={o.ai_calls >= 10 && o.ai_errors / o.ai_calls > 0.1 ? "warning" : undefined}
        />
        <Kpi label="Ügyfelek" value={formatNumber(o.clients)} sub={`${formatNumber(o.deals)} ügylet`} />
        <Kpi label="Ingatlanok" value={formatNumber(o.properties)} sub={`${formatNumber(o.viewings)} megtekintés`} />
        <Kpi label="Új rekord ebben a hónapban" value={formatNumber(o.created_month)} sub={`${formatNumber(o.interactions)} bejegyzés · ${formatNumber(o.tasks_open)} nyitott feladat`} />
        <Kpi
          label="Postafiókok"
          value={formatNumber(o.mailboxes)}
          sub={`${o.mailboxes_broken} újrakapcsolandó · ${o.push_devices} értesítős eszköz · ${o.phone_keys} telefonkulcs`}
          tone={o.mailboxes_broken ? "warning" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Az elmúlt 30 nap">
          <DailyBars rows={daily} label="AI-hívások (piros: hiba)" value={(r) => r.ai_calls} accent={(r) => r.ai_errors} />
          <DailyBars rows={daily} label="Új rekordok (ügyfél, ingatlan, bejegyzés, megtekintés, feladat)" value={(r) => r.records} />
          <DailyBars rows={daily} label="Regisztrációk" value={(r) => r.signups} />
        </Card>
        <div className="flex flex-col gap-6">
          <Card title="Ingyenes keretek" description="A Supabase ingyenes csomagja; a Vercel használatát a Vercel → Usage oldal mutatja.">
            {system ? (
              <>
                <Meter label="Adatbázis" used={system.dbBytes} total={FREE.dbBytes} format={formatBytes} />
                <Meter label={`Fájltárhely (${formatNumber(system.storageFiles)} fájl)`} used={system.storageBytes} total={FREE.storageBytes} format={formatBytes} />
              </>
            ) : (
              <p className="text-sm text-muted">Nem érhető el.</p>
            )}
            {capTotal !== null && <Meter label="AI-keretek összesen, ebben a hónapban" used={o.ai_calls} total={capTotal} />}
          </Card>
          <Card title="Közel a havi AI-kerethez" description="A munkaterületek, amelyek a keretük 80%-át már elérték.">
            {nearCap.length ? (
              <ul className="flex flex-col gap-3">
                {nearCap.map((w) => (
                  <li key={w.id}>
                    <Meter label={`${w.name}${w.ownerEmail ? ` · ${w.ownerEmail}` : ""}`} used={w.calls} total={w.limit ?? defaultLimit ?? 0} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Egy munkaterület sincs közel a kerethez.</p>
            )}
          </Card>
          <Card title="Meghívók és visszajelzések">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-muted">Szabad kód</dt>
                <dd className="text-lg text-ink tabular-nums">{o.codes_open}</dd>
              </div>
              <div>
                <dt className="text-muted">Felhasznált kód</dt>
                <dd className="text-lg text-ink tabular-nums">{o.codes_used}</dd>
              </div>
              <div>
                <dt className="text-muted">Visszajelzés (7 nap)</dt>
                <dd className="text-lg text-ink tabular-nums">{o.feedback_7d}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

const operationLabels: Record<string, string> = {
  extract_interaction: "Rögzítés, diktálás, hirdetésimport",
  assistant: "Asszisztens, dokumentumok, szerződések",
  next_actions: "Válaszlevél, ajánlat, hirdetésszöveg",
  client_summary: "Ügyfélösszefoglaló",
};

export function AiTab({ rows, config, workspaces, defaultLimit }: { rows: AiBreakdownRow[]; config: ReturnType<typeof configStatus>; workspaces: WorkspaceUsage[]; defaultLimit: number | null }) {
  const byOperation = new Map<string, { calls: number; errors: number; tokens: number }>();
  const byModel = new Map<string, { calls: number; input: number; output: number }>();
  for (const r of rows) {
    if (r.status === "rejected") continue;
    const op = byOperation.get(r.operation) ?? { calls: 0, errors: 0, tokens: 0 };
    op.calls += r.calls;
    if (r.status === "error") op.errors += r.calls;
    op.tokens += r.inputTokens + r.outputTokens;
    byOperation.set(r.operation, op);
    if (r.status === "success") {
      const m = byModel.get(r.model) ?? { calls: 0, input: 0, output: 0 };
      m.calls += r.calls;
      m.input += r.inputTokens;
      m.output += r.outputTokens;
      byModel.set(r.model, m);
    }
  }
  const top = workspaces.filter((w) => w.calls > 0).slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <Card title="Beállított modellek">
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          {[
            ["Fő modell", config.aiModel],
            ["Tartalék", config.aiFallbackModel],
            ["Diktálás", config.transcribeModel],
            ["Havi alapkeret", defaultLimit === null ? "nincs korlát" : `${formatNumber(defaultLimit)} hívás / munkaterület`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="break-all text-ink">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Funkciónként" description="Ebben a hónapban.">
          <Table
            head={["Funkció", "Hívás", "Hiba", "Token"]}
            rows={[...byOperation.entries()]
              .sort((a, b) => b[1].calls - a[1].calls)
              .map(([op, v]) => [operationLabels[op] ?? op, formatNumber(v.calls), v.errors ? <span className="text-danger">{v.errors}</span> : "0", formatNumber(v.tokens)])}
            empty="Ebben a hónapban még nem volt AI-hívás."
          />
        </Card>
        <Card title="Modellenként" description="Sikeres hívások, bemeneti és kimeneti tokenek.">
          <Table
            head={["Modell", "Hívás", "Be", "Ki"]}
            rows={[...byModel.entries()]
              .sort((a, b) => b[1].calls - a[1].calls)
              .map(([m, v]) => [<span key={m} className="break-all">{m}</span>, formatNumber(v.calls), formatNumber(v.input), formatNumber(v.output)])}
            empty="Nincs adat."
          />
        </Card>
      </div>

      <Card title="Legtöbbet használó munkaterületek" description="A kereteket a Munkaterületek fülön lehet állítani.">
        <ul className="flex flex-col gap-3">
          {top.length ? (
            top.map((w) => {
              const cap = w.limit ?? defaultLimit;
              return (
                <li key={w.id}>
                  {cap !== null ? (
                    <Meter label={`${w.name}${w.ownerEmail ? ` · ${w.ownerEmail}` : ""}`} used={w.calls} total={cap} />
                  ) : (
                    <p className="flex justify-between text-sm">
                      <span>{w.name}</span>
                      <span className="text-muted tabular-nums">{formatNumber(w.calls)} hívás</span>
                    </p>
                  )}
                </li>
              );
            })
          ) : (
            <p className="text-sm text-muted">Még senki nem használta az AI-t ebben a hónapban.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}

export function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            {head.map((h, i) => (
              <th key={h} className={cn("px-1 pb-2 font-normal", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={cn("px-1 py-2 align-top text-ink", j > 0 && "text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const mailboxStatus: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  active: { label: "Rendben", tone: "success" },
  revoked: { label: "Újrakapcsolandó", tone: "warning" },
  error: { label: "Hiba", tone: "danger" },
};

const outboxLabels: Record<string, string> = {
  awaiting_approval: "Jóváhagyásra vár",
  queued: "Sorban",
  sent: "Elküldve",
  failed: "Sikertelen",
  cancelled: "Visszavonva",
};

export function SystemTab({ system, config }: { system: SystemStatus | null; config: ReturnType<typeof configStatus> }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Beállítások a szerveren" description="Csak az látszik, hogy megvan-e; a titkos értékek nem.">
          <ul className="flex flex-col divide-y divide-border">
            {config.checks.map((c) => (
              <li key={c.name} className="flex items-center gap-3 py-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                ) : c.optional ? (
                  <CircleDashed className="size-4 shrink-0 text-subtle" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0 text-danger" />
                )}
                <span className="font-mono text-xs text-ink">{c.name}</span>
                <span className="min-w-0 flex-1 truncate text-right text-muted">{c.ok ? c.what : c.optional ? `nem kötelező · ${c.what}` : `hiányzik · ${c.what}`}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-col gap-6">
          <Card title="Telepítés">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <dt className="text-muted">Cím (APP_URL)</dt>
                <dd className="break-all text-ink">{config.appUrl ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Régió</dt>
                <dd className="text-ink">{config.region ?? "helyi"}</dd>
              </div>
              <div>
                <dt className="text-muted">Verzió</dt>
                <dd className="font-mono text-ink">{config.commit ?? "helyi"}</dd>
              </div>
              {config.commitMessage && (
                <div className="col-span-2">
                  <dt className="text-muted">Utolsó változás</dt>
                  <dd className="text-ink">{config.commitMessage}</dd>
                </div>
              )}
            </dl>
          </Card>
          {system && (
            <Card title="Tárhely">
              <Meter label="Adatbázis" used={system.dbBytes} total={FREE.dbBytes} format={formatBytes} />
              <Meter label={`Fájlok (${formatNumber(system.storageFiles)} db)`} used={system.storageBytes} total={FREE.storageBytes} format={formatBytes} />
            </Card>
          )}
        </div>
      </div>

      {system ? (
        <>
          <Card title="Levelek" description={`Utolsó szinkron: ${ago(system.lastMailSync)}. A cron-job.org „mail” feladata 2 percenként fut; ha ez 15 percnél régebbi, a feladat nem fut.`}>
            <Table
              head={["Postafiók", "Állapot", "Utolsó szinkron"]}
              rows={system.mailboxes.map((m) => [
                <span key={m.email} className="flex flex-col">
                  <span className="break-all">{m.email}</span>
                  <span className="text-xs text-muted">
                    {m.provider}
                    {m.owner && m.owner !== m.email ? ` · ${m.owner}` : ""}
                    {m.lastError && m.status !== "active" ? ` · ${m.lastError}` : ""}
                  </span>
                </span>,
                <Badge key="s" tone={(mailboxStatus[m.status] ?? mailboxStatus.error).tone}>
                  {(mailboxStatus[m.status] ?? mailboxStatus.error).label}
                </Badge>,
                ago(m.lastSyncedAt),
              ])}
              empty="Még senki nem kapcsolt postafiókot."
            />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Automatikus levelek">
              <Table
                head={["Állapot", "Darab"]}
                rows={Object.entries(system.outbox)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => [outboxLabels[k] ?? k, formatNumber(v)])}
                empty="Még nem ment ki automatikus levél."
              />
              {system.reportsFailed > 0 && <p className="text-sm text-warning">{system.reportsFailed} eladói riport küldése nem sikerült.</p>}
            </Card>
            <Card title="Naptárkapcsolatok hibái">
              {system.calendarErrors.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {system.calendarErrors.map((c, i) => (
                    <li key={i}>
                      <span className="text-ink">{c.owner ?? "—"}</span> <span className="text-muted">· {c.kind} · {c.error}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nincs hiba.</p>
              )}
            </Card>
          </div>

          {system.outboxFailed.length > 0 && (
            <Card title="Sikertelen küldések" description="A legutóbbi 20. A címzett nem látszik; a levél az ügynök Automatikus levelek oldalán van.">
              <Table
                head={["Tárgy", "Hiba", "Mikor"]}
                rows={system.outboxFailed.map((f) => [
                  <span key="s" className="flex flex-col">
                    <span>{f.subject ?? "—"}</span>
                    <span className="text-xs text-muted">{f.owner ?? ""}</span>
                  </span>,
                  <span key="e" className="text-xs text-danger">{f.error ?? "—"}</span>,
                  formatDateTime(f.at),
                ])}
                empty=""
              />
            </Card>
          )}
        </>
      ) : (
        <Card>
          <p className="text-sm text-muted">A rendszerállapot nem érhető el (SUPABASE_SECRET_KEY?).</p>
        </Card>
      )}
    </div>
  );
}

const feedbackKinds: Record<string, { label: string; tone: "danger" | "accent" | "neutral" }> = {
  bug: { label: "Hiba", tone: "danger" },
  idea: { label: "Ötlet", tone: "accent" },
  other: { label: "Egyéb", tone: "neutral" },
};

/** Phone or computer, and which browser, from the user agent. */
function device(ua: string | null) {
  if (!ua) return null;
  const kind = /iphone|android.+mobile/i.test(ua) ? "telefon" : /ipad|tablet/i.test(ua) ? "tablet" : "számítógép";
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome\//i.test(ua) ? "Chrome" : /firefox\//i.test(ua) ? "Firefox" : /safari\//i.test(ua) ? "Safari" : null;
  return [kind, browser].filter(Boolean).join(", ");
}

export function FeedbackTab({ items }: { items: FeedbackItem[] }) {
  const counts = { bug: 0, idea: 0, other: 0 } as Record<string, number>;
  for (const f of items) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Hiba" value={counts.bug} tone={counts.bug ? "danger" : undefined} />
        <Kpi label="Ötlet" value={counts.idea} />
        <Kpi label="Egyéb" value={counts.other} />
      </div>
      <Card title="Visszajelzések" description="A Visszajelzés gombbal küldöttek, legújabb elöl (legfeljebb 200).">
        {items.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((f) => {
              const k = feedbackKinds[f.kind] ?? feedbackKinds.other;
              return (
                <li key={f.id} className="flex flex-col gap-1.5 py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <Badge tone={k.tone}>{k.label}</Badge>
                    <span className="text-ink">{f.email ?? "ismeretlen"}</span>
                    <span>· {formatDateTime(f.createdAt)}</span>
                    {f.page && <span className="font-mono">· {f.page}</span>}
                    {device(f.userAgent) && <span>· {device(f.userAgent)}</span>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-ink">{f.message}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Még nem jött visszajelzés.</p>
        )}
      </Card>
    </div>
  );
}
