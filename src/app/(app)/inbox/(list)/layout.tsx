import { PlugZap } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { AllMailToolbar } from "@/components/mail/all-mail-toolbar";
import { ConnectCard } from "@/components/mail/connect-card";
import { MailboxBar } from "@/components/mail/mailbox-bar";
import { ListSkeleton, PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";
import { ViewTabs } from "@/components/ui/view-tabs";
import { getCurrentUser } from "@/lib/auth";
import { configuredProviders } from "@/lib/mail/configured";
import { isMailCryptoConfigured } from "@/lib/mail/crypto";
import { inboxViews } from "@/lib/mail/inbox-views";
import { listMailboxes } from "@/lib/mail/sync";

/**
 * What stays on screen while Levelek switches tabs, mailboxes or searches:
 * the mailboxes, the tabs and the search. Only the list (page.tsx) loads.
 */
async function MailShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // Gmail and Outlook need their sign-in app; any mailbox needs the encryption key.
  const providers = configuredProviders();
  if (!isMailCryptoConfigured()) {
    return (
      <>
        {children}
        <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning-soft px-5 py-4 text-sm text-warning">
          <PlugZap className="mt-0.5 size-4 shrink-0" />
          <p>A postafiók-kapcsolat most nem érhető el. Jelezd nekünk a Visszajelzés gombbal, és beállítjuk.</p>
        </div>
      </>
    );
  }
  const mailboxes = await listMailboxes(user);
  if (!mailboxes.length) {
    return (
      <>
        {children}
        <ConnectCard providers={providers} />
      </>
    );
  }
  return (
    <>
      <MailboxBar
        providers={providers}
        mailboxes={mailboxes.map((m) => ({
          id: m.id,
          email: m.email_address,
          provider: m.provider,
          status: m.status,
          lastSyncedAt: m.last_synced_at,
          lastError: m.last_error,
          isPrimary: m.is_primary,
        }))}
      />
      <ViewTabs label="Nézetek" items={inboxViews} />
      <AllMailToolbar mailboxes={mailboxes.filter((m) => m.status !== "revoked").map((m) => ({ id: m.id, email: m.email_address }))} />
      {children}
    </>
  );
}

export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader title="Levelek" description="Ügyfelekkel váltott levelek és portálos érdeklődések, feldolgozásra várva." />
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <div className="h-24 shimmer rounded-2xl bg-surface" />
            <ListSkeleton />
          </div>
        }
      >
        <MailShell>{children}</MailShell>
      </Suspense>
    </PageTransition>
  );
}
