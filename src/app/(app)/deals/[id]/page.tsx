import { ShareToChat } from "@/components/chat/share-to-chat";
import { ContractsCard } from "@/components/contracts/contracts-card";
import { LinkedFilesCard } from "@/components/office-docs/linked-files-card";
import { ChevronLeft, Mail, MapPin, Phone, ShieldAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskToggle } from "@/components/crm/task-toggle";
import { DealField } from "@/components/deals/deal-field";
import { DealOutcome, OffersList, PartiesList, StageBar } from "@/components/deals/deal-parts";
import { NextStepCard } from "@/components/deals/next-step-card";
import { listDrafts } from "@/lib/contracts/data";
import { nextStep } from "@/lib/deals/next-step";
import { utcToZonedLocal } from "@/lib/i18n/timezone";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageSuspense } from "@/components/ui/page-suspense";
import { identificationSummaries } from "@/lib/aml/data";
import { identificationStatus } from "@/lib/aml/identification";
import { getCurrentUser } from "@/lib/auth";
import { listClientOptions } from "@/lib/db/activity";
import { getDeal } from "@/lib/deals/data";
import { stageLabels } from "@/lib/deals/logic";
import { formatDate, formatDateTime, formatPrice } from "@/lib/i18n/format";
import { listTeam } from "@/lib/team";

export const metadata: Metadata = { title: "Ügylet" };

/** 76000000 → "76 000 000": readable in the field, and read back the same way. */
const amount = (v: number | null) => (v == null ? "" : String(Math.round(Number(v))).replace(/\B(?=(\d{3})+(?!\d))/g, " "));

function Person({ label, person }: { label: string; person: { id: string; name: string; phone: string | null; email: string | null } | null }) {
  if (!person) return null;
  return (
    <div className="flex items-center gap-2 px-5 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted">
        <UserRound className="size-4" />
      </span>
      <Link href={`/clients/${person.id}`} className="min-w-0 flex-1 hover:underline">
        <p className="truncate text-sm font-medium text-ink">{person.name}</p>
        <p className="text-xs text-muted">{label}</p>
      </Link>
      {person.phone && (
        <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label={`${person.name} hívása`}>
          <Phone className="size-4" />
        </a>
      )}
      {person.email && (
        <a href={`mailto:${person.email}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label={`E-mail: ${person.name}`}>
          <Mail className="size-4" />
        </a>
      )}
    </div>
  );
}

async function DealContent({ params }: Pick<PageProps<"/deals/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const [deal, clients, team] = await Promise.all([getDeal(user, id), listClientOptions(user), listTeam(user).catch(() => null)]);
  if (!deal) notFound();
  // Pmt.: buyer and seller are identified before the deal goes ahead.
  const idents = await identificationSummaries(user, [deal.buyer_client_id, deal.seller_client_id].filter((x): x is string => Boolean(x)));
  const today = new Date().toISOString().slice(0, 10);
  const unidentified = [deal.buyer, deal.seller].filter((p): p is NonNullable<typeof p> => Boolean(p)).filter((p) => identificationStatus(idents.get(p.id) ?? null, today).state !== "ok");
  const open = deal.status === "open";
  const clientOptions = [{ value: "", label: "Nincs megadva" }, ...clients.map((c) => ({ value: c.id, label: c.name }))];
  const members = team?.members ?? [];
  const drafts = await listDrafts(user, { dealId: deal.id }).catch(() => []);
  const localToday = utcToZonedLocal(new Date().toISOString()).slice(0, 10);
  const step = nextStep(
    {
      ...deal,
      rent: deal.property.listingType === "rent",
      deposit_amount: deal.deposit_amount == null ? null : Number(deal.deposit_amount),
      agreed_price: deal.agreed_price == null ? null : Number(deal.agreed_price),
      offers: deal.offers,
      contracts: drafts.map((d) => d.kind),
      unidentified: unidentified.map((p) => ({ name: p.name, href: `/clients/${p.id}/azonositas` })),
    },
    localToday,
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Link href="/deals" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Ügyletek
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {deal.status === "won" ? <Badge tone="success">Sikeres</Badge> : deal.status === "lost" ? <Badge tone="danger">Meghiúsult</Badge> : <Badge tone="accent">{stageLabels[deal.stage]}</Badge>}
              {deal.agent && <span className="text-xs text-muted">Ügyintéző: {deal.agent.name}</span>}
            </div>
            <h1 className="mt-2 text-[28px] leading-tight sm:text-[32px]">
              <Link href={`/properties/${deal.property.id}`} className="hover:underline">
                {deal.property.name}
              </Link>
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1">
                <MapPin className="size-4" /> Irányár: {formatPrice(deal.property.askingPrice, deal.currency)}
              </span>
              {deal.lost_reason && <span className="text-danger">Ok: {deal.lost_reason}</span>}
              {deal.closed_at && <span>Lezárva: {formatDate(deal.closed_at)}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {members.length > 1 && <ShareToChat kind="deal" id={deal.id} title={deal.property.name} />}
            <DealOutcome dealId={deal.id} status={deal.status} />
          </div>
        </div>
        <StageBar dealId={deal.id} stage={deal.stage} status={deal.status} />
        {step && <NextStepCard dealId={deal.id} step={step} today={localToday} />}
        {open && unidentified.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <ShieldAlert className="size-4 shrink-0" /> Pénzmosás elleni azonosítás hiányzik:
            {unidentified.map((p) => (
              <Link key={p.id} href={`/clients/${p.id}/azonositas`} className="font-medium underline">
                {p.name}
              </Link>
            ))}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Határidők" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <DealField dealId={deal.id} field="deposit_due" kind="date" label="Foglaló határideje" value={deal.deposit_due ?? ""} />
              <DealField dealId={deal.id} field="deposit_paid_on" kind="date" label="Foglaló beérkezett" value={deal.deposit_paid_on ?? ""} />
              <DealField dealId={deal.id} field="contract_on" kind="date" label="Adásvételi aláírása" value={deal.contract_on ?? ""} />
              <DealField dealId={deal.id} field="financing_deadline" kind="date" label="Finanszírozás határideje" value={deal.financing_deadline ?? ""} hint="Hitelbírálat, banki értékbecslés" />
              <DealField dealId={deal.id} field="handover_on" kind="date" label="Birtokbaadás" value={deal.handover_on ?? ""} />
              <DealField dealId={deal.id} field="commission_paid_on" kind="date" label="Jutalék kifizetve" value={deal.commission_paid_on ?? ""} />
            </div>
            <p className="border-t border-border px-5 py-3 text-xs text-muted">Minden megadott dátumból feladat lesz (aznap 9:00-ra), és a dátummal együtt mozog.</p>
          </Card>

          <div id="offers">
            <Card>
              <CardHeader title="Ajánlatok" count={deal.offers.length} />
              <OffersList dealId={deal.id} offers={deal.offers} currency={deal.currency} open={open} />
            </Card>
          </div>

          <Card>
            <CardHeader title="Feladatok" count={deal.tasks.length} />
            {deal.tasks.length ? (
              <ul className="divide-y divide-border">
                {deal.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                    <TaskToggle id={t.id} done={t.done} title={t.title} />
                    <div className="min-w-0">
                      <p className={t.done ? "text-sm text-muted line-through" : "text-sm text-ink"}>{t.title}</p>
                      {t.dueAt && <p className="text-xs text-muted">{formatDateTime(t.dueAt)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">Adj meg egy határidőt, és feladat lesz belőle.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Jegyzet" />
            <div className="p-5">
              <DealField dealId={deal.id} field="notes" kind="notes" label="Belső jegyzet" value={deal.notes ?? ""} placeholder="Pl. a vevő hitelt vesz fel, a bank: …" />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Ár és jutalék" />
            <div className="flex flex-col gap-4 p-5">
              <DealField dealId={deal.id} field="agreed_price" kind="money" label="Megállapodott vételár" value={amount(deal.agreed_price)} placeholder="79M" hint="Elfogadott ajánlatnál magától kitöltődik." />
              <DealField dealId={deal.id} field="deposit_amount" kind="money" label="Foglaló összege" value={amount(deal.deposit_amount)} placeholder="2M" />
              <div className="grid grid-cols-2 gap-3">
                <DealField dealId={deal.id} field="commission_percent" kind="percent" label="Jutalék (%)" value={deal.commission_percent == null ? "" : String(deal.commission_percent)} />
                <DealField dealId={deal.id} field="commission_amount" kind="money" label="Vagy fix összeg" value={amount(deal.commission_amount)} />
              </div>
              <div className="rounded-xl bg-success-soft px-4 py-3">
                <p className="text-xs text-success">Jutalék</p>
                <p className="text-xl font-medium text-success tabular-nums">{deal.commissionValue != null ? formatPrice(deal.commissionValue, deal.currency) : "—"}</p>
              </div>
            </div>
          </Card>

          <ContractsCard user={user} from="deal" id={deal.id} rent={deal.property.listingType === "rent"} />
          <LinkedFilesCard user={user} kind="deal" id={deal.id} />

          <Card>
            <CardHeader title="Felek" />
            <Person label="Vevő" person={deal.buyer} />
            <Person label="Eladó" person={deal.seller} />
            <div className="grid grid-cols-1 gap-3 border-t border-border p-5">
              <DealField dealId={deal.id} field="buyer_client_id" kind="select" label="Vevő" value={deal.buyer_client_id ?? ""} options={clientOptions} />
              <DealField dealId={deal.id} field="seller_client_id" kind="select" label="Eladó" value={deal.seller_client_id ?? ""} options={clientOptions} />
              {members.length > 1 && (
                <DealField
                  dealId={deal.id}
                  field="assigned_to"
                  kind="select"
                  label="Ügyintéző (övé a jutalék)"
                  value={deal.assigned_to ?? ""}
                  options={[{ value: "", label: "Nincs megadva" }, ...members.map((m) => ({ value: m.userId, label: m.name }))]}
                />
              )}
            </div>
            <div className="border-t border-border">
              <PartiesList dealId={deal.id} parties={deal.parties} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DealPage({ params }: PageProps<"/deals/[id]">) {
  return (
    <PageSuspense>
      <DealContent params={params} />
    </PageSuspense>
  );
}
