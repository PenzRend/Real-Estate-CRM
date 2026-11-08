"use client";

import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { importClientsAction } from "@/app/(app)/clients/import-actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import { guessRoles, ROLES, roleLabels, rowToClient, type Role } from "@/lib/import/clients";
import { readTable, type Table } from "@/lib/import/table";
import { clientTypeLabels } from "@/lib/i18n/labels";
import type { ImportResult } from "@/lib/import/save";

const MAX_ROWS = 3000;
const money = (n: number | null) => (n == null ? "" : `${Math.round(n / 100_000) / 10} M`);

/** Bring existing clients over from Excel, CSV or phone contacts: read here, checked by the agent, then saved. */
export function ClientImport() {
  const [file, setFile] = useState<string | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [saving, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function load(f: File) {
    try {
      const t = readTable(f.name, await f.arrayBuffer());
      if (!t.rows.length) return toast({ message: "Ebben a fájlban nem találtam sorokat." });
      setFile(f.name);
      setTable(t);
      setRoles(guessRoles(t.header, t.rows.slice(0, 20)));
      setResult(null);
    } catch {
      toast({ message: "Ezt a fájlt nem tudtam megnyitni. Excel (.xlsx), CSV vagy névjegy (.vcf) fájlt tölts fel." });
    }
  }

  const clients = useMemo(() => (table ? table.rows.slice(0, MAX_ROWS).map((r) => rowToClient(r, roles)) : []), [table, roles]);
  const valid = clients.filter((c): c is NonNullable<typeof c> => c != null);
  const hasName = roles.includes("name") || roles.includes("first_name") || roles.includes("last_name");

  function save() {
    start(async () => {
      const r = await importClientsAction(valid).catch(actionFailed);
      if (!r.ok) {
        toast({ message: r.error });
        return;
      }
      setResult(r.result);
    });
  }

  if (result) {
    return (
      <section className="reveal flex flex-col gap-4 rounded-3xl border border-border bg-background p-6">
        <p className="flex items-center gap-2 text-lg font-medium text-ink">
          <CheckCircle2 className="size-5 text-success" /> {result.created} ügyfél átkerült a Flavióba.
        </p>
        {result.duplicates.length > 0 && (
          <div className="text-sm text-muted">
            <p>{result.duplicates.length} már megvolt (ugyanaz a telefonszám vagy e-mail), ezeket kihagytam:</p>
            <p className="mt-1 text-xs">
              {result.duplicates.slice(0, 30).join(", ")}
              {result.duplicates.length > 30 && ` és még ${result.duplicates.length - 30}`}
            </p>
          </div>
        )}
        {result.failed > 0 && <p className="text-sm text-danger">{result.failed} sort nem sikerült menteni (hibás adat).</p>}
        <div className="flex flex-wrap gap-2">
          <Link href="/clients" className={buttonClasses("primary")}>
            Ügyfelek megnyitása
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setTable(null);
              setResult(null);
            }}
          >
            Másik fájl
          </Button>
        </div>
      </section>
    );
  }

  if (!table) {
    return (
      <section
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) void load(f);
        }}
        className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-border-strong bg-background px-6 py-14 text-center"
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <FileSpreadsheet className="size-7" />
        </span>
        <div>
          <p className="text-lg font-medium text-ink">Húzd ide az ügyféllistádat</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Excel (.xlsx), CSV, vagy a telefonod névjegyei (.vcf – iPhone-on és Androidon is exportálható). A fájl a gépeden marad, amíg át nem nézed, mi kerül át.
          </p>
        </div>
        <input ref={input} type="file" accept=".xlsx,.csv,.txt,.vcf,text/csv,text/vcard" className="hidden" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
        <Button onClick={() => input.current?.click()}>
          <Upload /> Fájl kiválasztása
        </Button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <p className="text-sm text-ink">
            <span className="font-medium">{file}</span> · {table.rows.length} sor
            {table.rows.length > MAX_ROWS && <span className="text-warning"> (egyszerre az első {MAX_ROWS})</span>}
          </p>
          <button type="button" onClick={() => setTable(null)} className="text-xs text-muted hover:text-ink">
            Másik fájl
          </button>
        </div>
        <p className="px-5 pt-4 text-sm text-muted">Melyik oszlopban mi van? Kitaláltam, amit tudtam – javítsd, ha kell.</p>
        <div className="overflow-x-auto px-5 pt-3 pb-5">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {table.header.map((h, i) => (
                  <th key={i} className="min-w-40 pr-3 pb-2 text-left align-bottom font-normal">
                    <span className="mb-1 block truncate text-xs text-muted">{h || `${i + 1}. oszlop`}</span>
                    <select
                      value={roles[i]}
                      onChange={(e) => setRoles((rs) => rs.map((r, j) => (j === i ? (e.target.value as Role) : r)))}
                      className={cn("h-9 w-full rounded-xl border px-2 text-sm", roles[i] === "skip" ? "border-border text-muted" : "border-accent/40 bg-accent-soft/40 font-medium text-ink")}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabels[r]}
                        </option>
                      ))}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.slice(0, 4).map((r, i) => (
                <tr key={i}>
                  {table.header.map((_, j) => (
                    <td key={j} className={cn("max-w-56 truncate border-t border-border py-2 pr-3", roles[j] === "skip" ? "text-subtle" : "text-text")}>
                      {r[j]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-background p-5">
        <h2 className="text-sm font-medium text-ink">Így kerülnek át</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {valid.slice(0, 3).map((c, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 py-2">
              <span className="font-medium text-ink">{c.full_name}</span>
              <span className="text-muted">{clientTypeLabels[c.client_type]}</span>
              {c.phone && <span className="text-muted">{c.phone}</span>}
              {c.email && <span className="text-muted">{c.email}</span>}
              {(c.budget_min != null || c.budget_max != null) && (
                <span className="text-muted">
                  {money(c.budget_min)}
                  {c.budget_min != null && c.budget_max != null && "–"}
                  {money(c.budget_max)}
                </span>
              )}
              {c.preferred_locations.length > 0 && <span className="text-muted">{c.preferred_locations.join(", ")}</span>}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {valid.length} ügyfél
            {clients.length - valid.length > 0 && ` · ${clients.length - valid.length} sor kimarad (nincs benne név, telefon vagy e-mail)`}. A már meglévőket kihagyom; üdvözlő levél nem megy ki nekik.
          </p>
          <Button onClick={save} disabled={saving || !valid.length || !hasName}>
            {saving ? <Loader2 className="animate-spin" /> : <Upload />} {valid.length} ügyfél átvétele
          </Button>
        </div>
        {!hasName && <p className="mt-2 text-xs text-warning">Jelöld meg, melyik oszlopban van a név.</p>}
      </section>
    </div>
  );
}
