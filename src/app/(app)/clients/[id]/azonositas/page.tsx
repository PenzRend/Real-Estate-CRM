import { ChevronLeft, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IdentificationForm } from "@/components/aml/identification-form";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getIdentification } from "@/lib/aml/data";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/i18n/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ügyfél-azonosítás" };

async function Identification({ params }: Pick<PageProps<"/clients/[id]/azonositas">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: client }, existing] = await Promise.all([
    supabase.from("clients").select("id, full_name, client_type").eq("id", id).eq("organization_id", user.organization.id).maybeSingle(),
    getIdentification(user, id),
  ]);
  if (!client) notFound();
  const values: Record<string, string> = existing ? Object.fromEntries(Object.entries(existing.data).map(([k, v]) => [k, String(v ?? "")])) : { full_name: client.full_name };

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/clients/${id}`} className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> {client.full_name}
      </Link>
      <PageHeader
        title="Ügyfél-azonosítás"
        description={
          existing
            ? `Azonosítva: ${formatDate(existing.verifiedOn)}. Az adatokat a pénzmosás elleni törvény szerint 8 évig meg kell őrizni.`
            : "A pénzmosás elleni törvény (Pmt.) szerint az ingatlanközvetítőnek azonosítania kell az ügyfelét az üzleti kapcsolat előtt."
        }
        actions={
          existing ? (
            <Link href={`/clients/${id}/adatlap`} className={buttonClasses("secondary")}>
              <Printer /> Adatlap aláírásra
            </Link>
          ) : undefined
        }
      />
      <IdentificationForm clientId={id} kind={existing?.kind ?? "person"} values={values} />
    </div>
  );
}

export default function IdentificationPage({ params }: PageProps<"/clients/[id]/azonositas">) {
  return (
    <PageSuspense>
      <Identification params={params} />
    </PageSuspense>
  );
}
