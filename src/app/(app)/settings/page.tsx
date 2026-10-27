import { ArrowRight, Mail, Puzzle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { Badge } from "@/components/ui/badge";
import { FormSection } from "@/components/ui/form-section";
import { PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { isMailCryptoConfigured } from "@/lib/mail/crypto";
import { googleConfig } from "@/lib/mail/google";
import { getMailbox } from "@/lib/mail/sync";

export const metadata: Metadata = { title: "Beállítások" };

function Connection({ icon: Icon, title, status, href, cta }: { icon: typeof Mail; title: string; status: ReactNode; href: string; cta: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-border p-4 transition-colors hover:bg-surface sm:col-span-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted group-hover:bg-background">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <div className="mt-0.5 truncate text-sm text-muted">{status}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-ink">
        {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

async function SettingsContent() {
  const user = await getCurrentUser();
  const mailbox = googleConfig() && isMailCryptoConfigured() ? await getMailbox(user) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Beállítások" description="A fiókod, a munkaterületed és a kapcsolódó szolgáltatások." />

      <div>
        <FormSection number="01" title="Profil">
          <div className="sm:col-span-2">
            <ProfileForm
              fullName={user.fullName ?? ""}
              email={user.email}
              workspaceName={user.organization.name}
              canRename={user.organization.role !== "member"}
            />
          </div>
        </FormSection>

        <FormSection number="02" title="Kapcsolatok" description="Levelek, naptár és hirdetésimport.">
          <Connection
            icon={Mail}
            title="Gmail és Google Naptár"
            status={
              mailbox ? (
                <span className="flex items-center gap-2">
                  {mailbox.email_address}
                  {mailbox.status === "active" ? <Badge tone="success">Összekapcsolva</Badge> : <Badge tone="warning">Újra kell kapcsolni</Badge>}
                </span>
              ) : (
                "Nincs összekapcsolva"
              )
            }
            href="/inbox"
            cta={mailbox ? "Levelek" : "Összekapcsolás"}
          />
          <Connection
            icon={Puzzle}
            title="Böngészőbővítmény"
            status="Hirdetések átvétele egy kattintással az ingatlan.com-ról és más portálokról."
            href="/properties/import"
            cta="Telepítés"
          />
        </FormSection>

        <FormSection number="03" title="Jelszó">
          <div className="sm:col-span-2">
            <PasswordForm />
          </div>
        </FormSection>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
