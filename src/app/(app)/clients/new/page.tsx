import type { Metadata } from "next";
import { ClientForm } from "@/components/crm/client-form";
import { Eyebrow } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { createClientAction } from "../actions";

export const metadata: Metadata = { title: "Új ügyfél" };

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Eyebrow>Ügyfelek</Eyebrow>}
        title="Új ügyfél"
        description="Elég a név és egy elérhetőség. A többit később, akár egy hívásjegyzetből is kitöltheted."
      />
      <ClientForm action={createClientAction} submitLabel="Ügyfél mentése" cancelHref="/clients" />
    </div>
  );
}
