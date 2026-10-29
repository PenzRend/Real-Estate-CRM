import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DealForm } from "@/components/deals/deal-form";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listClientOptions } from "@/lib/db/activity";

export const metadata: Metadata = { title: "Új ügylet" };

async function NewDeal({ searchParams }: Pick<PageProps<"/deals/new">, "searchParams">) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: properties }, clients] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, reference_number, owner_client_id, price, currency")
      .eq("organization_id", user.organization.id)
      .is("archived_at", null)
      .not("status", "in", "(sold,rented)")
      .order("created_at", { ascending: false })
      .limit(500),
    listClientOptions(user),
  ]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/deals" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Ügyletek
      </Link>
      <PageHeader title="Új ügylet" description="Egy vevő ajánlatot tett: innen követed a foglalótól a jutalékig." />
      <DealForm
        properties={(properties ?? []).map((p) => ({ id: p.id, name: p.title, reference: p.reference_number, ownerId: p.owner_client_id, price: p.price, currency: p.currency }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name, detail: c.detail ?? null }))}
        propertyId={one(params.property)}
        buyerId={one(params.buyer)}
        defaultPercent="3"
      />
    </div>
  );
}

export default function NewDealPage({ searchParams }: PageProps<"/deals/new">) {
  return (
    <PageSuspense>
      <NewDeal searchParams={searchParams} />
    </PageSuspense>
  );
}
