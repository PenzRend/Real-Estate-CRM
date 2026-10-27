import { CheckCircle2, CircleAlert, EyeOff, Inbox, Mail, PlugZap, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MailboxBar } from "@/components/mail/mailbox-bar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { listEmails, type EmailItem, type EmailStatus } from "@/lib/db/mail";
import { formatDateTime } from "@/lib/i18n/format";
import { isMailCryptoConfigured } from "@/lib/mail/crypto";
import { googleConfig } from "@/lib/mail/google";
import { getMailbox } from "@/lib/mail/sync";
import { ignoreEmailAction, restoreEmailAction } from "./actions";
import { FormSubmit } from "@/components/ui/form-submit";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Levelek" };

const tabs: { key: EmailStatus; label: string; empty: string }[] = [
  { key: "new", label: "Feldolgozandó", empty: "Nincs feldolgozandó levél." },
  {
    key: "processed",
    label: "Feldolgozott",
    empty: "Még nincs feldolgozott levél.",
  },
  { key: "ignored", label: "Elrejtett", empty: "Nincs elrejtett levél." },
];

const errors: Record<string, string> = {
  config: "A Gmail-kapcsolat most nem érhető el. Jelezd nekünk a Visszajelzés gombbal.",
  denied: "A Google-engedélyezést megszakítottad, így nem jött létre kapcsolat.",
  state: "A kapcsolódás lejárt vagy megszakadt. Próbáld újra.",
  no_refresh: "A Google nem adott tartós hozzáférést. Próbáld újra, és engedélyezd a hozzáférést.",
  scope: "A levelek olvasásához szükséges engedély hiányzik. Próbáld újra, és pipáld be a Gmail-hozzáférést.",
  exchange: "A Google-kapcsolat létrehozása nem sikerült. Próbáld újra.",
  save: "A kapcsolat mentése nem sikerült. Próbáld újra.",
};

function EmailRow({ e }: { e: EmailItem }) {
  const sender = e.direction === "outgoing" ? `→ ${e.toEmails.join(", ")}` : (e.fromName ?? e.fromEmail ?? "Ismeretlen");
  return (
    <li className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{sender}</p>
          {e.portal && <Badge tone="accent">{e.portal}</Badge>}
          {e.client ? (
            <Link href={`/clients/${e.client.id}`} className="inline-flex">
              <Badge tone="success">
                <UserRound className="size-3" /> {e.client.name}
              </Badge>
            </Link>
          ) : (
            e.direction === "incoming" && <Badge tone="warning">Új érdeklődő?</Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-text">{e.subject ?? "(nincs tárgy)"}</p>
        {e.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{e.snippet}</p>}
        <p className="mt-1 text-xs text-subtle">{formatDateTime(e.receivedAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {e.status === "new" && (
          <>
            <Link href={`/interactions/new?email=${e.id}`} className={buttonClasses("primary", "xs")}>
              <Sparkles /> Feldolgozás
            </Link>
            <form action={ignoreEmailAction.bind(null, e.id)}>
              <FormSubmit className={buttonClasses("ghost", "xs", "text-muted hover:text-ink")}>
                <EyeOff /> Elrejtés
              </FormSubmit>
            </form>
          </>
        )}
        {e.status === "processed" && e.client && (
          <Link href={`/clients/${e.client.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" /> Rögzítve
          </Link>
        )}
        {e.status === "ignored" && (
          <form action={restoreEmailAction.bind(null, e.id)}>
            <FormSubmit className={buttonClasses("ghost", "xs", "text-muted hover:text-ink")}>Visszaállítás</FormSubmit>
          </form>
        )}
      </div>
    </li>
  );
}

function ConnectCard() {
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex max-w-2xl flex-col gap-4">
        <span className="grid size-11 place-items-center rounded-xl border border-border bg-surface text-muted shadow-float">
          <Mail className="size-5" />
        </span>
        <h2 className="text-2xl">Kapcsold össze a Gmail-fiókodat</h2>
        <p className="text-muted">
          Az ügyfeleiddel váltott levelek és a portálokról (ingatlan.com, Jófogás…) érkező érdeklődések maguktól megjelennek itt. Egy kattintással ügyféllé,
          előzménnyé és feladattá alakíthatod őket.
        </p>
        <ul className="flex flex-col gap-2 text-sm text-text">
          {[
            "Alapból csak olvasási jog. Válaszolni a Flavióból akkor tudsz, ha a küldést külön engedélyezed – és akkor is csak a te kattintásodra megy el levél. Törölni vagy módosítani nem tud.",
            "Csak a releváns leveleket tároljuk: ügyfelekkel váltott, portálról érkező vagy ingatlanos érdeklődés. A többit nem mentjük el.",
            "A hozzáférési kulcsot titkosítva tároljuk, és bármikor leválaszthatod.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> {t}
            </li>
          ))}
        </ul>
        <a href="/api/mail/google/connect" className={buttonClasses("primary", "lg", "w-fit")}>
          <Mail className="size-4" /> Gmail összekapcsolása
        </a>
      </div>
    </Card>
  );
}

async function InboxContent({ searchParams }: Pick<PageProps<"/inbox">, "searchParams">) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const tab = tabs.find((t) => t.key === params.view) ?? tabs[0];
  const configured = Boolean(googleConfig()) && isMailCryptoConfigured();
  const mailbox = configured ? await getMailbox(user) : null;
  const emails = mailbox ? await listEmails(user, tab.key) : [];
  const error = typeof params.mail_error === "string" ? errors[params.mail_error] : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Levelek" description="Ügyfelekkel váltott levelek és portálos érdeklődések, feldolgozásra várva." />

      {params.connected === "1" && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> A Gmail-fiók összekapcsolva. Az elmúlt 14 nap releváns leveleit most töltjük be.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <CircleAlert className="size-4" /> {error}
        </p>
      )}

      {!configured ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning-soft px-5 py-4 text-sm text-warning">
          <PlugZap className="mt-0.5 size-4 shrink-0" />
          <p>A Gmail-kapcsolat most nem érhető el. Jelezd nekünk a Visszajelzés gombbal, és beállítjuk.</p>
        </div>
      ) : !mailbox ? (
        <ConnectCard />
      ) : (
        <>
          <MailboxBar email={mailbox.email_address} status={mailbox.status} lastSyncedAt={mailbox.last_synced_at} lastError={mailbox.last_error} />

          <nav aria-label="Nézetek" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-border p-1 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/inbox?view=${t.key}`}
                aria-current={t.key === tab.key ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  t.key === tab.key ? "bg-primary font-medium text-white" : "text-muted hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <Card>
            {emails.length ? (
              <ul className="divide-y divide-border">
                {emails.map((e) => (
                  <EmailRow key={e.id} e={e} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={Inbox} title={tab.empty} description="Csak az ügyfelekkel kapcsolatos és az ingatlanos érdeklődő leveleket mutatjuk." />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default function InboxPage({ searchParams }: PageProps<"/inbox">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InboxContent searchParams={searchParams} />
    </Suspense>
  );
}
