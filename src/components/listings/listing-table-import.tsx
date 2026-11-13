"use client";

import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { importListingsAction } from "@/app/(app)/properties/import/table/actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";
import { cn } from "@/lib/cn";
import { formatPriceShort } from "@/lib/i18n/format";
import { listingTypeLabels, propertyStatusLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import { guessListingRoles, LISTING_ROLES, listingRoleLabels, rowToListing, type ListingRole } from "@/lib/import/listings";
import type { ListingImportResult } from "@/lib/import/save-listings";
import { readTable, type Table } from "@/lib/import/table";

const MAX_ROWS = 1000;

/** Bring existing listings over from Excel or CSV: read here, checked by the agent, then saved. */
export function ListingTableImport() {
  const [file, setFile] = useState<string | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [roles, setRoles] = useState<ListingRole[]>([]);
  const [result, setResult] = useState<ListingImportResult | null>(null);
  const [saving, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function load(f: File) {
    try {
      const t = readTable(f.name, await f.arrayBuffer());
      if (!t.rows.length) return toast({ message: "Ebben a fájlban nem találtam sorokat." });
      setFile(f.name);
      setTable(t);
      setRoles(guessListingRoles(t.header));
      setResult(null);
    } catch {
      toast({ message: "Ezt a fájlt nem tudtam megnyitni. Excel (.xlsx) vagy CSV fájlt tölts fel." });
    }
  }

  const listings = useMemo(() => (table ? table.rows.slice(0, MAX_ROWS).map((r) => rowToListing(r, roles)) : []), [table, roles]);
  const valid = listings.filter((l): l is NonNullable<typeof l> => l != null);
  const identifies = roles.some((r) => r === "title" || r === "address" || r === "city" || r === "district" || r === "reference");

  function save() {
    start(async () => {
      const r = await importListingsAction(valid).catch(actionFailed);
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
          <CheckCircle2 className="size-5 text-success" /> {result.created ? `${result.created} ingatlan átkerült a Flavióba.` : "Nem volt új ingatlan a fájlban."}
        </p>
        {result.duplicates.length > 0 && (
          <div className="text-sm text-muted">
            <p>{result.duplicates.length} már megvolt (ugyanaz az azonosító, vagy ugyanaz a cím, méret és ár), ezeket kihagytam:</p>
            <p className="mt-1 text-xs">
              {result.duplicates.slice(0, 30).join(", ")}
              {result.duplicates.length > 30 && ` és még ${result.duplicates.length - 30}`}
            </p>
          </div>
        )}
        {result.failed > 0 && <p className="text-sm text-danger">{result.failed} sort nem sikerült menteni (hibás adat).</p>}
        <p className="text-sm text-muted">A fotókat ingatlanonként töltheted fel, vagy hozd át őket a hirdetés linkjéből.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/properties" className={buttonClasses("primary")}>
            Ingatlanok megnyitása
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
          <p className="text-lg font-medium text-ink">Húzd ide az ingatlanlistádat</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Excel (.xlsx) vagy CSV – a régi CRM-ed exportja vagy a saját táblázatod. A fájl a gépeden marad, amíg át nem nézed, mi kerül át.
          </p>
        </div>
        <input ref={input} type="file" accept=".xlsx,.csv,.txt,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
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
                      onChange={(e) => setRoles((rs) => rs.map((r, j) => (j === i ? (e.target.value as ListingRole) : r)))}
                      className={cn("h-9 w-full rounded-xl border px-2 text-sm", roles[i] === "skip" ? "border-border text-muted" : "border-accent/40 bg-accent-soft/40 font-medium text-ink")}
                    >
                      {LISTING_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {listingRoleLabels[r]}
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
          {valid.slice(0, 3).map((l, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 py-2">
              <span className="font-medium text-ink">{l.title}</span>
              <span className="text-muted">
                {propertyTypeLabels[l.property_type]} · {listingTypeLabels[l.listing_type]} · {propertyStatusLabels[l.status]}
              </span>
              {l.price != null && <span className="text-muted">{l.currency === "EUR" ? `${l.price.toLocaleString("hu-HU")} EUR` : formatPriceShort(l.price)}</span>}
              {l.area_sqm != null && <span className="text-muted">{l.area_sqm} m²</span>}
              {l.reference_number && <span className="text-muted">#{l.reference_number}</span>}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {valid.length} ingatlan
            {listings.length - valid.length > 0 && ` · ${listings.length - valid.length} sor kimarad (nincs benne megnevezés, cím vagy azonosító)`}. A már meglévőket kihagyom; a vevőknek nem megy ki ajánló levél.
          </p>
          <Button onClick={save} disabled={saving || !valid.length || !identifies}>
            {saving ? <Loader2 className="animate-spin" /> : <Upload />} {valid.length} ingatlan átvétele
          </Button>
        </div>
        {!identifies && <p className="mt-2 text-xs text-warning">Jelöld meg, melyik oszlopban van a megnevezés vagy a cím.</p>}
      </section>
    </div>
  );
}
