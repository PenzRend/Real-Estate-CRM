"use client";

import { Loader2, Mail, RefreshCw, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { disconnectMailAction, syncMailAction } from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { formatDateTime } from "@/lib/i18n/format";

const STALE_MS = 15 * 60_000;

/** Connected mailbox: status, manual sync, and a background sync when the inbox is opened with stale data. */
export function MailboxBar({
  email,
  status,
  lastSyncedAt,
  lastError,
}: {
  email: string;
  status: "active" | "revoked" | "error";
  lastSyncedAt: string | null;
  lastError: string | null;
}) {
  const [syncing, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const autoSynced = useRef(false);
  const router = useRouter();

  function runSync() {
    start(async () => {
      const r = await syncMailAction();
      setMessage(
        r.ok
          ? { tone: "ok", text: r.stored ? `${r.stored} új releváns levél.` : "Nincs új releváns levél." }
          : { tone: "error", text: r.error },
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
    if (autoSynced.current || status !== "active") return;
    const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > STALE_MS;
    if (!stale) return;
    autoSynced.current = true;
    runSync();
  });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-surface text-muted">
          <Mail className="size-4" />
        </span>
        <div className="text-sm">
          <p className="font-medium text-ink">{email}</p>
          <p className={status === "active" ? "text-xs text-muted" : "text-xs text-danger"}>
            {status === "revoked"
              ? "A hozzáférés megszűnt – kapcsold össze újra."
              : status === "error"
                ? (lastError ?? "A legutóbbi szinkronizálás nem sikerült.")
                : lastSyncedAt
                  ? `Utolsó szinkronizálás: ${formatDateTime(lastSyncedAt)}`
                  : "Még nem volt szinkronizálás."}
          </p>
          {message && (
            <p role="status" className={message.tone === "ok" ? "text-xs text-success" : "text-xs text-danger"}>
              {message.text}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "revoked" ? (
          <a href="/api/mail/google/connect" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover">
            Újracsatlakozás
          </a>
        ) : (
          <Button variant="secondary" onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} {syncing ? "Szinkronizálás…" : "Szinkronizálás"}
          </Button>
        )}
        <ConfirmAction
          action={disconnectMailAction}
          trigger={
            <>
              <Unplug /> Leválasztás
            </>
          }
          title="Gmail leválasztása"
          description="A CRM-nek a Google-nél is megszűnik a hozzáférése, és a még fel nem dolgozott importált levelek törlődnek. A már rögzített beszélgetések megmaradnak."
          confirmLabel="Leválasztás"
          tone="danger"
        />
      </div>
    </div>
  );
}
