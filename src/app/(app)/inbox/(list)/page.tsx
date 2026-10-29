import { CheckCircle2, CircleAlert, EyeOff, Inbox, Sparkles, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AllMailList } from "@/components/mail/all-mail";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormSubmit } from "@/components/ui/form-submit";
import { ListSuspense } from "@/components/ui/list-suspense";
import { EmptyState } from "@/components/ui/page";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { listEmails, type EmailItem } from "@/lib/db/mail";
import { formatDateTime } from "@/lib/i18n/format";
import { browseMailbox } from "@/lib/mail/browse";
import { isMailCryptoConfigured } from "@/lib/mail/crypto";
import { inboxViews } from "@/lib/mail/inbox-views";
import { listMailboxes, type Mailbox } from "@/lib/mail/sync";
import { ignoreEmailAction, restoreEmailAction } from "../actions";

export const metadata: Metadata = { title: "Levelek" };

type Params = Awaited<PageProps<"/inbox">["searchParams"]>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

const errors: Record<string, string> = {
  config: "A postafiók-kapcsolat most nem érhető el. Jelezd nekünk a Visszajelzés gombbal.",
  denied: "Az engedélyezést megszakítottad, így nem jött létre kapcsolat.",
  state: "A kapcsolódás lejárt vagy megszakadt. Próbáld újra.",
  no_refresh: "A szolgáltató nem adott tartós hozzáférést. Próbáld újra, és engedélyezd a hozzáférést.",
  scope: "A levelek olvasásához szükséges engedély hiányzik. Próbáld újra, és engedélyezd a levelek olvasását.",
  exchange: "A kapcsolat létrehozása nem sikerült. Próbáld újra.",
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

/**
 * "Összes levél": the chosen mailbox read live (the mailbox and search are in
 * the header); nothing here is stored until the agent processes an email.
 */
async function AllMail({ user, mailboxes, params }: { user: CurrentUser; mailboxes: Mailbox[]; params: Params }) {
  const usable = mailboxes.filter((m) => m.status !== "revoked");
  const mailbox = usable.find((m) => m.id === one(params.mb)) ?? usable[0];
  if (!mailbox) return <EmptyState icon={Inbox} title="Nincs elérhető postafiók." description="Kapcsold össze újra a postafiókodat." />;
  const query = one(params.q)?.trim() || null;
  const page = await browseMailbox(user, mailbox.id, { cursor: one(params.page), query });
  const href = (extra: Record<string, string | null>) => {
    const q = new URLSearchParams({ view: "all", mb: mailbox.id });
    if (query) q.set("q", query);
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
    return `/inbox?${q.toString()}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">Élőben a postafiókodból. A Flavio ezeket nem tárolja – csak azt, amit a Feldolgozás gombbal átveszel.</p>
      <Card>
        {!page.ok ? (
          <p role="alert" className="px-5 py-4 text-sm text-danger">
            {page.error}
          </p>
        ) : page.items.length ? (
          <AllMailList mailboxId={page.mailbox.id} ownEmail={page.mailbox.email} items={page.items} />
        ) : (
          <EmptyState icon={Inbox} title={query ? "Nincs találat." : "A postafiók üres."} description={query ? "Próbálj más keresőszót." : ""} />
        )}
      </Card>
      {page.ok && (page.next || one(params.page)) && (
        <div className="flex gap-2">
          {one(params.page) && (
            <Link href={href({})} className={buttonClasses("ghost", "sm")}>
              Legújabbak
            </Link>
          )}
          {page.next && (
            <Link href={href({ page: page.next })} className={buttonClasses("secondary", "sm")}>
              Régebbi levelek
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

async function InboxList({ searchParams }: Pick<PageProps<"/inbox">, "searchParams">) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const view = inboxViews.find((v) => v.value === params.view) ?? inboxViews[0];
  const mailboxes = isMailCryptoConfigured() ? await listMailboxes(user) : [];
  const error = typeof params.mail_error === "string" ? errors[params.mail_error] : null;

  const notices = (
    <>
      {params.connected === "1" && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" /> A postafiók összekapcsolva. Az elmúlt 14 nap releváns leveleit most töltjük be.
          {Number(params.calendars) > 0 && (
            <>
              {" "}
              Az iCloud-naptárad is bekerült a{" "}
              <Link href="/calendar" className="font-medium underline">
                Naptárba
              </Link>
              .
            </>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <CircleAlert className="size-4" /> {error}
        </p>
      )}
    </>
  );
  // No mailbox yet: the layout shows how to connect one; only the notices belong here.
  if (!mailboxes.length) return <div className="flex flex-col gap-4">{notices}</div>;

  if (view.value === "all") {
    return (
      <div className="flex flex-col gap-4">
        {notices}
        <AllMail user={user} mailboxes={mailboxes} params={params} />
      </div>
    );
  }
  const emails = await listEmails(user, view.value);
  return (
    <div className="flex flex-col gap-4">
      {notices}
      <Card>
        {emails.length ? (
          <ul className="divide-y divide-border">
            {emails.map((e) => (
              <EmailRow key={e.id} e={e} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Inbox}
            title={view.empty}
            description="Itt az ügyfelekkel kapcsolatos és az ingatlanos érdeklődő levelek vannak. Minden más levelet az Összes levél fülön látsz."
          />
        )}
      </Card>
    </div>
  );
}

export default function InboxPage({ searchParams }: PageProps<"/inbox">) {
  return (
    <ListSuspense>
      <InboxList searchParams={searchParams} />
    </ListSuspense>
  );
}
