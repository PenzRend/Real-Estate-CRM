import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EmailRules } from "@/components/email-auto/email-rules";
import { OutboxList } from "@/components/email-auto/outbox-list";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { getCurrentUser } from "@/lib/auth";
import { listOutbox } from "@/lib/email-auto/outbox";
import { listEmailTemplates } from "@/lib/email-auto/templates";

export const metadata: Metadata = { title: "Automatikus levelek" };

async function Automation() {
  await connection();
  const user = await getCurrentUser();
  const [templates, outbox] = await Promise.all([listEmailTemplates(user), listOutbox(user)]);
  const waiting = outbox.filter((o) => o.status === "awaiting_approval").length;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Automatikus levelek"
        description="Levelek, amelyek maguktól készülnek el a megfelelő pillanatban – új ügyfélnél, megtekintés előtt és után, lezáráskor. A saját postafiókodból mennek, és ha úgy állítod, előbb te nézed át őket."
        actions={
          <Link href="/inbox" className={buttonClasses("ghost", "sm")}>
            <ArrowLeft /> Levelek
          </Link>
        }
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-base tracking-tight">Kimenő levelek{waiting > 0 ? ` · ${waiting} vár rád` : ""}</h2>
        <OutboxList items={outbox} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base tracking-tight">Szabályok</h2>
        <EmailRules templates={templates} />
      </section>
    </div>
  );
}

export default function AutomationPage() {
  return (
    <PageSuspense>
      <Automation />
    </PageSuspense>
  );
}
