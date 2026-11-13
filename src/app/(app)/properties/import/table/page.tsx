import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ListingTableImport } from "@/components/listings/listing-table-import";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Ingatlanok importálása táblázatból" };

export default function ListingTableImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/properties" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Ingatlanok
      </Link>
      <PageHeader
        title="Ingatlanok importálása táblázatból"
        description="Hozd át az összes meglévő ingatlanodat egyszerre, a régi CRM-ed exportjából vagy a saját Excel-táblázatodból – nem kell egyenként felvinni."
      />
      <ListingTableImport />
    </div>
  );
}
