"use client";

import { BellRing, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { setAiLimitAction } from "@/app/(app)/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import type { AdminUser, WorkspaceUsage } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { ago, formatBytes } from "./dashboard";

function Filter({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-10" />
    </div>
  );
}

const matches = (q: string, ...fields: (string | null)[]) => {
  const needle = q.trim().toLowerCase();
  return !needle || fields.some((f) => f?.toLowerCase().includes(needle));
};

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[11px] text-subtle">{label}</span>
      <span className="text-sm text-ink tabular-nums">{typeof value === "number" ? formatNumber(value) : value}</span>
    </span>
  );
}

/** Every workspace: what is in it, when it was last used, and its AI cap. */
export function WorkspacesTable({ workspaces, defaultLimit, defaultDaily }: { workspaces: WorkspaceUsage[]; defaultLimit: number | null; defaultDaily: number }) {
  const [q, setQ] = useState("");
  const [teamsOnly, setTeamsOnly] = useState(false);
  const shown = useMemo(() => workspaces.filter((w) => matches(q, w.name, w.ownerEmail) && (!teamsOnly || w.members > 1)), [workspaces, q, teamsOnly]);
  if (!workspaces.length) return <p className="text-sm text-muted">Még nincs munkaterület.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Filter value={q} onChange={setQ} placeholder="Keresés név vagy tulajdonos szerint" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={teamsOnly} onChange={(e) => setTeamsOnly(e.target.checked)} className="size-4 accent-ink" /> Csak csapatok
        </label>
      </div>
      <p className="text-xs text-muted">
        {shown.length} / {workspaces.length} munkaterület · alapkeret: napi {defaultDaily}, havi {defaultLimit === null ? "nincs korlát" : defaultLimit} hívás. Üresen hagyva az alap érvényes.
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
        {shown.map((w) => (
          <WorkspaceRow key={w.id} w={w} defaultLimit={defaultLimit} defaultDaily={defaultDaily} />
        ))}
      </ul>
    </div>
  );
}

/** One cap of a workspace: its own number, or empty for the server default. */
function LimitInput({ w, period, own, fallback }: { w: WorkspaceUsage; period: "daily" | "monthly"; own: number | null; fallback: number | null }) {
  const [value, setValue] = useState(own === null ? "" : String(own));
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const saved = own === null ? "" : String(own);
  const label = period === "daily" ? "Napi" : "Havi";
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const limit = value.trim() === "" ? null : Number(value);
        start(async () => {
          const r = await setAiLimitAction(w.id, period, limit).catch(actionFailed);
          setMsg(r.ok ? "Mentve" : r.error);
        });
      }}
    >
      <span className="w-10 text-xs text-muted">{label}</span>
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMsg(null);
        }}
        placeholder={fallback === null ? "Nincs" : `Alap: ${fallback}`}
        aria-label={`${w.name} ${label.toLowerCase()} AI-kerete`}
        className="h-9 w-28"
      />
      <Button type="submit" variant="secondary" size="sm" disabled={busy || value === saved}>
        Mentés
      </Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </form>
  );
}

function UsageBar({ label, used, cap, extra }: { label: string; used: number; cap: number | null; extra?: string }) {
  const share = cap ? Math.min(used / cap, 1) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn("tabular-nums", cap !== null && used >= cap ? "font-medium text-danger" : "text-ink")}>
          {formatNumber(used)}
          {cap !== null && ` / ${formatNumber(cap)}`} hívás{extra && ` · ${extra}`}
        </span>
      </div>
      {cap !== null && (
        <span className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
          <span className={cn("block h-full rounded-full", share >= 1 ? "bg-danger" : share >= 0.8 ? "bg-warning" : "bg-ink")} style={{ width: `${share * 100}%` }} />
        </span>
      )}
    </div>
  );
}

function WorkspaceRow({ w, defaultLimit, defaultDaily }: { w: WorkspaceUsage; defaultLimit: number | null; defaultDaily: number }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            {w.name}
            {w.members > 1 && <Badge tone="accent">{w.members} fős csapat</Badge>}
          </p>
          <p className="text-xs text-muted">
            {w.ownerEmail ?? "—"} · létrehozva {formatDate(w.createdAt)} · utoljára aktív: {ago(w.lastActivityAt)}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <LimitInput w={w} period="daily" own={w.dailyLimit} fallback={defaultDaily} />
          <LimitInput w={w} period="monthly" own={w.limit} fallback={defaultLimit} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <UsageBar label="AI ma" used={w.today} cap={w.dailyLimit ?? defaultDaily} />
        <UsageBar label="AI ebben a hónapban" used={w.calls} cap={w.limit ?? defaultLimit} extra={`${formatNumber(w.tokens)} token`} />
      </div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        <Stat label="Ügyfél" value={w.clients} />
        <Stat label="Ingatlan" value={w.properties} />
        <Stat label="Bejegyzés" value={w.interactions} />
        <Stat label="Megtekintés" value={w.viewings} />
        <Stat label="Ügylet" value={w.deals} />
        <Stat label="Nyitott feladat" value={w.tasksOpen} />
        <Stat label="Postafiók" value={w.mailboxes} />
        <Stat label="Fájlok" value={formatBytes(w.storageBytes)} />
      </div>
    </li>
  );
}

const roleLabel: Record<string, string> = { owner: "Tulajdonos", admin: "Admin", member: "Munkatárs" };

/** Every account: who, since when, last seen, and what they have done. */
export function UsersTable({ users }: { users: AdminUser[] }) {
  const [q, setQ] = useState("");
  const [now] = useState(() => Date.now());
  const shown = useMemo(() => users.filter((u) => matches(q, u.email, u.fullName, u.workspaces, u.signupCode)), [users, q]);
  const week = users.filter((u) => u.lastSeenAt && now - Date.parse(u.lastSeenAt) < 7 * 86_400_000).length;
  if (!users.length) return <p className="text-sm text-muted">Még nincs felhasználó.</p>;
  return (
    <div className="flex flex-col gap-3">
      <Filter value={q} onChange={setQ} placeholder="Keresés név, e-mail, munkaterület vagy kód szerint" />
      <p className="text-xs text-muted">
        {shown.length} / {users.length} felhasználó · {week} aktív az elmúlt 7 napban
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
        {shown.map((u) => {
          const stale = !u.lastSeenAt || now - Date.parse(u.lastSeenAt) > 14 * 86_400_000;
          return (
            <li key={u.id} className="flex flex-col gap-3 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {u.fullName ?? u.email}
                    {!u.confirmed && <Badge tone="warning">Nincs megerősítve</Badge>}
                    {u.role && <Badge>{roleLabel[u.role] ?? u.role}</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {u.email}
                    {u.workspaces && ` · ${u.workspaces}`}
                  </p>
                </div>
                <div className="text-xs sm:text-right">
                  <p className={cn(stale ? "text-warning" : "text-ink")}>Utoljára: {ago(u.lastSeenAt, now)}</p>
                  <p className="text-muted">
                    Regisztrált: {formatDate(u.createdAt)}
                    {u.signupCode && <span className="font-mono"> · {u.signupCode}</span>}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
                <Stat label="AI e hónapban" value={u.aiCalls} />
                <Stat label="Ügyfél" value={u.clients} />
                <Stat label="Ingatlan" value={u.properties} />
                <Stat label="Bejegyzés" value={u.interactions} />
                <Stat label="Megtekintés" value={u.viewings} />
                <Stat label="Postafiók" value={u.mailboxes ? (u.mailboxes > 1 ? `${u.mailboxes} db` : "van") : "nincs"} />
                <span className="flex flex-col">
                  <span className="text-[11px] text-subtle">Értesítés</span>
                  <span className="flex items-center gap-1 text-sm text-ink">
                    {u.pushDevices ? (
                      <>
                        <BellRing className="size-3.5" /> {u.pushDevices}
                      </>
                    ) : (
                      "nincs"
                    )}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
