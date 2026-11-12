"use client";

import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { markInvoicedAction, setWorkspaceAccessAction, updatePlanAction } from "@/app/(app)/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import type { Payment, WorkspaceBillingRow } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/i18n/format";

type PlanProps = { id: string; name: string; priceMonth: number; priceYear: number; aiDailyPerSeat: number; aiMonthlyPerSeat: number | null; hasStripePrices: boolean };

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** The plan on sale: its name, prices and AI caps per agent. */
export function PlanEditor({ plan }: { plan: PlanProps }) {
  const [v, setV] = useState({
    name: plan.name,
    priceMonth: String(plan.priceMonth),
    priceYear: String(plan.priceYear),
    aiDailyPerSeat: String(plan.aiDailyPerSeat),
    aiMonthlyPerSeat: plan.aiMonthlyPerSeat === null ? "" : String(plan.aiMonthlyPerSeat),
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => {
    setV({ ...v, [k]: e.target.value });
    setMsg(null);
  };
  const month = Number(v.priceMonth) || 0;
  const year = Number(v.priceYear) || 0;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updatePlanAction(plan.id, {
            name: v.name,
            priceMonth: Number(v.priceMonth),
            priceYear: Number(v.priceYear),
            aiDailyPerSeat: Number(v.aiDailyPerSeat),
            aiMonthlyPerSeat: num(v.aiMonthlyPerSeat),
          }).catch(actionFailed);
          setMsg(r.ok ? "Mentve. Az új árak az új előfizetésekre vonatkoznak; a futók a régi áron maradnak." : r.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Csomag neve" htmlFor="plan-name">
          <Input id="plan-name" value={v.name} onChange={set("name")} maxLength={60} />
        </Field>
        <div />
        <Field label="Havi ár (Ft / fő)" htmlFor="plan-month">
          <Input id="plan-month" type="number" min={0} step={100} value={v.priceMonth} onChange={set("priceMonth")} />
        </Field>
        <Field label="Éves ár (Ft / fő)" htmlFor="plan-year" hint={month > 0 && year > 0 ? `${Math.round((1 - year / (month * 12)) * 100)}% kedvezmény a havihoz képest` : undefined}>
          <Input id="plan-year" type="number" min={0} step={100} value={v.priceYear} onChange={set("priceYear")} />
        </Field>
        <Field label="AI-hívás naponta (fő)" htmlFor="plan-daily">
          <Input id="plan-daily" type="number" min={0} step={1} value={v.aiDailyPerSeat} onChange={set("aiDailyPerSeat")} />
        </Field>
        <Field label="AI-hívás havonta (fő)" htmlFor="plan-monthly" hint="Üresen: nincs havi korlát.">
          <Input id="plan-monthly" type="number" min={0} step={1} value={v.aiMonthlyPerSeat} onChange={set("aiMonthlyPerSeat")} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Mentés…" : "Mentés"}
        </Button>
        <span className="text-xs text-muted">{plan.hasStripePrices ? "A Stripe-árak megvannak." : "A Stripe-árak az első fizetéskor jönnek létre."}</span>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </form>
  );
}

const statusTone: Record<string, "success" | "accent" | "warning" | "danger" | "neutral"> = {
  pilot: "accent",
  trialing: "accent",
  active: "success",
  past_due: "danger",
  canceled: "warning",
  none: "neutral",
};
const statusText: Record<string, string> = {
  pilot: "Pilot",
  trialing: "Próbaidő",
  active: "Előfizető",
  past_due: "Elmaradt fizetés",
  canceled: "Lemondva",
  none: "Nincs hozzáférés",
};

/** Every workspace's access, with the admin's controls for free access. */
export function WorkspaceAccessList({ rows, owners }: { rows: WorkspaceBillingRow[]; owners: Record<string, string | null> }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === "all" || r.status === filter) &&
          (!q.trim() || `${r.name} ${owners[r.id] ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [rows, owners, q, filter],
  );
  const counts = rows.reduce<Record<string, number>>((c, r) => ({ ...c, [r.status]: (c[r.status] ?? 0) + 1 }), {});
  if (!rows.length) return <p className="text-sm text-muted">Nincs adat (a számlázási adatbázis-frissítés még hiányzik?).</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keresés név vagy tulajdonos szerint" aria-label="Keresés" className="pl-10" />
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Állapot" className="sm:w-56">
          <option value="all">Mind ({rows.length})</option>
          {Object.keys(statusText).map((s) => (
            <option key={s} value={s}>
              {statusText[s]} ({counts[s] ?? 0})
            </option>
          ))}
        </Select>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
        {shown.map((r) => (
          <AccessRow key={r.id} r={r} owner={owners[r.id] ?? null} />
        ))}
      </ul>
    </div>
  );
}

function AccessRow({ r, owner }: { r: WorkspaceBillingRow; owner: string | null }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const paid = r.stripeCustomerId && (r.status === "active" || r.status === "past_due");
  const run = (access: "pilot" | "none" | "trialing") =>
    start(async () => {
      const res = await setWorkspaceAccessAction(r.id, access, access === "trialing" ? date : undefined).catch(actionFailed);
      setMsg(res.ok ? "Mentve" : res.error);
    });
  const detail =
    r.status === "trialing"
      ? `próbaidő ${formatDate(r.trialEndsAt)}-ig`
      : r.status === "active" || r.status === "past_due" || r.status === "canceled"
        ? `${r.seats ?? 1} fő · ${r.interval === "year" ? "éves" : "havi"} · ${r.cancelAtPeriodEnd || r.status === "canceled" ? "vége" : "forduló"}: ${formatDate(r.currentPeriodEnd)}`
        : null;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            {r.name}
            <Badge tone={statusTone[r.status] ?? "neutral"}>{statusText[r.status] ?? r.status}</Badge>
          </p>
          <p className="text-xs text-muted">
            {owner ?? "—"} · létrehozva {formatDate(r.createdAt)}
            {detail && ` · ${detail}`}
          </p>
        </div>
        {paid ? (
          <span className="text-xs text-muted">Fizetős: a Stripe-ban kezelhető</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {r.status !== "pilot" && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => run("pilot")}>
                Pilot
              </Button>
            )}
            <span className="flex items-center gap-1">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Próbaidő vége" className="h-9 w-40" />
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => run("trialing")}>
                Próbaidő
              </Button>
            </span>
            {r.status !== "none" && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run("none")}>
                Ingyenes vége
              </Button>
            )}
          </div>
        )}
      </div>
      {msg && <p className="text-right text-xs text-muted">{msg}</p>}
    </li>
  );
}

/** Stripe payments, with what the Hungarian invoice needs, and whether it was issued. */
export function PaymentsList({ payments }: { payments: Payment[] }) {
  const [onlyOpen, setOnlyOpen] = useState(true);
  const open = payments.filter((p) => !p.invoicedAt);
  const shown = onlyOpen ? open : payments;
  const total = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {payments.length} fizetés · összesen {formatNumber(total)} Ft · <span className={cn(open.length > 0 && "font-medium text-warning")}>{open.length} számlázatlan</span>
        </p>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="size-4 accent-ink" /> Csak a számlázatlanok
        </label>
      </div>
      {shown.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {shown.map((p) => (
            <PaymentRow key={p.id} p={p} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{payments.length ? "Minden fizetés ki van számlázva." : "Még nem érkezett fizetés."}</p>
      )}
    </div>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  const [number, setNumber] = useState(p.invoiceNumber ?? "");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-ink">
            {formatNumber(p.amount)} Ft · {formatDate(p.paidAt)}
            {p.invoicedAt ? <Badge tone="success">Számlázva</Badge> : <Badge tone="warning">Számla kell</Badge>}
          </p>
          <p className="text-xs text-muted">
            {p.description ?? "Előfizetés"}
            {p.periodStart && p.periodEnd && ` · ${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`}
          </p>
        </div>
        {p.receiptUrl && (
          <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
            Stripe-nyugta {p.stripeNumber} <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {/* What the invoice needs: buyer's name, address and tax number. */}
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="inline text-subtle">Vevő: </dt>
          <dd className="inline text-ink">{p.customerName ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-subtle">E-mail: </dt>
          <dd className="inline text-ink">{p.customerEmail ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-subtle">Cím: </dt>
          <dd className="inline text-ink">{p.customerAddress ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-subtle">Adószám: </dt>
          <dd className="inline text-ink">{p.customerTaxId ?? "— (magánszemély)"}</dd>
        </div>
      </dl>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await markInvoicedAction(p.id, number).catch(actionFailed);
            setMsg(r.ok ? "Mentve" : r.error);
          });
        }}
      >
        <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Számla sorszáma" aria-label="Számla sorszáma" maxLength={60} className="h-9 w-48" />
        <Button type="submit" variant="secondary" size="sm" disabled={busy || number === (p.invoiceNumber ?? "")}>
          {p.invoicedAt ? "Módosítás" : "Számlázva"}
        </Button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </form>
    </li>
  );
}
