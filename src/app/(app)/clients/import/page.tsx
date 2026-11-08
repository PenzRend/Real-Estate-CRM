import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClientImport } from "@/components/crm/client-import";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Ügyfelek importálása" };

export default function ClientImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/clients" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Ügyfelek
      </Link>
      <PageHeader title="Ügyfelek importálása" description="Hozd át a meglévő ügyfeleidet Excelből, CSV-ből vagy a telefonod névjegyeiből – pár kattintás, nem kell egyenként begépelni." />
      <ClientImport />
    </div>
  );
}
