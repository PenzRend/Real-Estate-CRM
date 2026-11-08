import { FileSignature, PenLine, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { listDrafts } from "@/lib/contracts/data";
import { CONTRACT_KINDS, CONTRACT_ORDER } from "@/lib/contracts/kinds";
import { listOfficeTemplates } from "@/lib/contracts/templates";
import { formatDate } from "@/lib/i18n/format";

export const metadata: Metadata = { title: "Szerződések" };

async function Contracts() {
  await connection();
  const user = await getCurrentUser();
  const [drafts, own] = await Promise.all([listDrafts(user), listOfficeTemplates(user)]);
  const waiting = drafts.filter((d) => d.status === "draft");
  const approved = drafts.filter((d) => d.status === "approved");
  const list = (items: typeof drafts) => (
    <ul className="divide-y divide-border rounded-3xl border border-border bg-background">
      {items.map((d) => (
        <li key={d.id}>
          <Link href={`/contracts/${d.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <FileSignature className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{d.title}</span>
              <span className="block text-xs text-muted">
                {d.label} · {formatDate(d.createdAt)}
              </span>
            </span>
            {d.origin === "auto" && (
              <Badge tone="accent">
                <Zap className="size-3" /> automatikus
              </Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Szerződések" description="Flavio megírja őket az ügylet, az ingatlan és az ügyfelek adataiból – te átnézed és jóváhagyod." />
      <section className="flex flex-col gap-3">
        <h2 className="text-base tracking-tight">Felülvizsgálatra vár · {waiting.length}</h2>
        {waiting.length ? (
          list(waiting)
        ) : (
          <EmptyState icon={FileSignature} title="Nincs átnézendő tervezet" description="Ügylet indításakor, megtekintés foglalásakor és új ingatlan felvételekor a tervezet magától elkészül." />
        )}
      </section>
      {approved.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base tracking-tight">Jóváhagyott · {approved.length}</h2>
          {list(approved)}
        </section>
      )}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base tracking-tight">Amit Flavio megír</h2>
          <p className="mt-1 text-sm text-muted">Mindegyik szövege testreszabható – vagy töltsd fel a saját Word- vagy PDF-szerződéseteket, és Flavio sablonná alakítja.</p>
        </div>
        <ul className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {CONTRACT_ORDER.map((k) => (
            <li key={k}>
              <Link href={`/contracts/templates/${k}`} className="group flex h-full flex-col gap-1 rounded-3xl border border-border bg-background p-5 transition-colors hover:border-border-strong hover:bg-surface">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{CONTRACT_KINDS[k].label}</span>
                  {own[k] && <Badge tone="accent">Saját szöveg</Badge>}
                </span>
                <span className="text-muted">{CONTRACT_KINDS[k].short}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium text-muted group-hover:text-ink">
                  <PenLine className="size-3.5" /> Testreszabás
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function ContractsPage() {
  return (
    <PageSuspense>
      <Contracts />
    </PageSuspense>
  );
}
