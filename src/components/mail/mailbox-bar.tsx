"use client";

import { Loader2, Mail, Plus, RefreshCw, Star, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { disconnectMailAction, setPrimaryMailboxAction, syncMailAction } from "@/app/(app)/inbox/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { formatDateTime } from "@/lib/i18n/format";
import { connectPaths, mailboxLabel, type MailProvider } from "@/lib/mail/provider";

const STALE_MS = 15 * 60_000;

export type MailboxRow = {
  id: string;
  email: string;
  provider: MailProvider;
  status: "active" | "revoked" | "error";
  lastSyncedAt: string | null;
  lastError: string | null;
  isPrimary: boolean;
};

const disconnectNote: Record<MailProvider, string> = {
  gmail: ", a Google-nél is",
  outlook: " (a Microsoft-fiókod beállításaiban az alkalmazás engedélyét is visszavonhatod)",
  imap: " (a jelszót a Flavio törli; ha alkalmazásjelszót adtál meg, azt a szolgáltatónál vissza is vonhatod)",
};

/** Where an expired connection is made again: the provider's sign-in, or the IMAP form with the address filled in. */
const reconnectHref = (m: MailboxRow) => (m.provider === "imap" ? `/inbox/connect?email=${encodeURIComponent(m.email)}` : connectPaths[m.provider]);

function statusLine(m: MailboxRow) {
  if (m.status === "revoked") return "A hozzáférés megszűnt – kapcsold össze újra.";
  if (m.status === "error") return m.lastError ?? "A legutóbbi szinkronizálás nem sikerült.";
  return m.lastSyncedAt ? `Utolsó szinkronizálás: ${formatDateTime(m.lastSyncedAt)}` : "Még nem volt szinkronizálás.";
}

/** Connected mailboxes: status, default sender, manual sync of all, and a background sync when the inbox is opened with stale data. */
export function MailboxBar({ mailboxes, providers }: { mailboxes: MailboxRow[]; providers: MailProvider[] }) {
  const [syncing, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const autoSynced = useRef(false);
  const router = useRouter();

  function runSync() {
    start(async () => {
      const r = await syncMailAction().catch(() => ({ stored: 0, errors: ["A levelek lekérése nem sikerült. Próbáld újra."] }));
      setMessage(
        r.errors.length
          ? { tone: "error", text: r.errors.join(" ") }
          : { tone: "ok", text: r.stored ? `${r.stored} új releváns levél.` : "Nincs új releváns levél." },
      );
      // Same transition: the list updates while this bar (and its message) stays mounted.
      router.refresh();
    });
  }

  function sync() {
    setMessage(null);
    runSync();
  }

  // Opening the inbox with stale data syncs in the background, once per visit.
  useEffect(() => {
    if (autoSynced.current) return;
    const stale = mailboxes.some((m) => m.status === "active" && (!m.lastSyncedAt || Date.now() - new Date(m.lastSyncedAt).getTime() > STALE_MS));
    if (!stale) return;
    autoSynced.current = true;
    runSync();
  });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4">
      <ul className="flex flex-col divide-y divide-border">
        {mailboxes.map((m) => (
          <li key={m.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-muted">
                <Mail className="size-4" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-medium text-ink">
                  <span className="break-all">{m.email}</span>
                  <span className="font-normal text-muted">· {mailboxLabel(m.provider, m.email)}</span>
                  {m.isPrimary && mailboxes.length > 1 && <Badge tone="accent">Alapértelmezett küldő</Badge>}
                </p>
                <p className={m.status === "active" ? "text-xs text-muted" : "text-xs text-danger"}>{statusLine(m)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              {m.status === "revoked" && (
                <a href={reconnectHref(m)} className={buttonClasses("primary", "sm")}>
                  Újracsatlakozás
                </a>
              )}
              {!m.isPrimary && m.status !== "revoked" && (
                <form action={setPrimaryMailboxAction.bind(null, m.id)}>
                  <Button type="submit" variant="ghost" size="sm" title="Az új levelek és ajánlatok innen mennek">
                    <Star /> Alapértelmezett
                  </Button>
                </form>
              )}
              <ConfirmAction
                action={disconnectMailAction.bind(null, m.id)}
                size="sm"
                trigger={
                  <>
                    <Unplug /> Leválasztás
                  </>
                }
                title={`${m.email} leválasztása`}
                description={`A Flavio hozzáférése megszűnik${disconnectNote[m.provider]}, és a postafiók még fel nem dolgozott importált levelei törlődnek. A már rögzített beszélgetések megmaradnak.`}
                confirmLabel="Leválasztás"
                tone="danger"
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs">
          {message && (
            <p role="status" className={message.tone === "ok" ? "text-success" : "text-danger"}>
              {message.text}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} {syncing ? "Szinkronizálás…" : "Szinkronizálás"}
          </Button>
          <details className="relative">
            <summary className={buttonClasses("secondary", "sm", "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
              <Plus /> Postafiók hozzáadása
            </summary>
            <div className="absolute right-0 z-20 mt-2 flex w-64 flex-col rounded-2xl border border-border bg-background p-1.5 shadow-float">
              {providers.map((p) => (
                <a key={p} href={connectPaths[p]} className="rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface">
                  {p === "outlook" ? "Outlook / Microsoft 365" : "Gmail / Google Workspace"}
                </a>
              ))}
              <Link href="/inbox/connect" className="rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface">
                Céges, iCloud vagy más postafiók
              </Link>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
