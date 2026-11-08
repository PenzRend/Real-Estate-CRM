"use client";

import { Apple, CalendarDays, Check, CircleAlert, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { addCalDavAction, addICloudFromMailboxAction, removeSubscriptionAction, type SubscriptionState } from "@/app/(app)/(teendok)/calendar/actions";
import { AppPasswordSteps } from "@/components/mail/app-password-steps";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import type { Subscription } from "@/lib/calendar/data";
import { cn } from "@/lib/cn";
import { calendarLabels, permissionHref, type MailProvider } from "@/lib/mail/provider";
import { eventColors } from "./colors";

export type CalendarAccount = { id: string; email: string; provider: Exclude<MailProvider, "imap">; canCalendar: boolean };

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className="grid size-8 place-items-center rounded-lg bg-surface text-muted">{icon}</span> {title}
      </p>
      {children}
    </div>
  );
}

/** Google or Outlook: the connected accounts, each shown or one click from being allowed. */
function ProviderCard({ provider, accounts, configured, returnTo }: { provider: CalendarAccount["provider"]; accounts: CalendarAccount[]; configured: boolean; returnTo: string }) {
  const mine = accounts.filter((a) => a.provider === provider);
  if (!mine.length && !configured) return null;
  const connect = provider === "gmail" ? "/api/mail/google/connect" : "/api/mail/microsoft/connect";
  return (
    <Card icon={<CalendarDays className="size-4" />} title={calendarLabels[provider]}>
      {mine.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="break-all text-text">{a.email}</span>
          {a.canCalendar ? (
            <Badge tone="success">
              <Check className="size-3" /> Megjelenik
            </Badge>
          ) : (
            <a href={permissionHref("calendar", returnTo, a.id)} className={buttonClasses("secondary", "xs")}>
              <ShieldCheck /> Engedélyezés
            </a>
          )}
        </div>
      ))}
      {configured && (
        <a href={`${connect}?calendar=1&next=${encodeURIComponent(returnTo)}`} className={buttonClasses(mine.length ? "ghost" : "secondary", "sm", "w-fit")}>
          {mine.length ? "Másik fiók hozzáadása" : `${provider === "gmail" ? "Google" : "Microsoft"}-fiók összekapcsolása`}
        </a>
      )}
      {!mine.length && <p className="text-xs text-muted">A fiók leveleit is látod majd a Levelek oldalon.</p>}
    </Card>
  );
}

function ICloudCard({ calendars, icloudMailboxes, appleId }: { calendars: Subscription[]; icloudMailboxes: { id: string; email: string }[]; appleId: string }) {
  const [state, action, pending] = useActionState<SubscriptionState, FormData>(addCalDavAction, {});
  const [quick, setQuick] = useState<SubscriptionState>({});
  const [quickPending, startQuick] = useTransition();
  const accounts = [...new Set(calendars.map((c) => c.username ?? ""))];
  const offer = icloudMailboxes.filter((m) => !accounts.includes(m.email.toLowerCase()));

  return (
    <Card icon={<Apple className="size-4" />} title="Apple iCloud-naptár">
      {calendars.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {calendars.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span className={cn("size-2.5 shrink-0 rounded-full", eventColors[c.color]?.dot)} />
              <span className="min-w-0 flex-1 truncate text-text">
                {c.name} <span className="text-xs text-subtle">· {c.username}</span>
              </span>
              {c.lastError && <CircleAlert className="size-3.5 text-danger" aria-label={c.lastError} />}
              <form action={removeSubscriptionAction.bind(null, c.id)}>
                <Button type="submit" variant="ghost" size="xs" aria-label={`${c.name} eltávolítása`} title="Eltávolítás">
                  <Trash2 />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {calendars.some((c) => c.lastError) && <p className="text-xs text-danger">{calendars.find((c) => c.lastError)?.lastError}</p>}

      {offer.map((m) => (
        <Button
          key={m.id}
          size="sm"
          className="w-fit"
          disabled={quickPending}
          onClick={() => startQuick(async () => setQuick(await addICloudFromMailboxAction(m.id).catch(actionFailed)))}
        >
          {quickPending ? <Loader2 className="animate-spin" /> : <Apple />} Naptáraim innen: {m.email}
        </Button>
      ))}
      {quick.error && <p className="text-xs text-danger">{quick.error}</p>}

      {!calendars.length && !offer.length && (
        <p className="text-sm text-muted">Így az iPhone-od naptára is itt lesz. Két perc, egyszer kell megcsinálni:</p>
      )}
      <details open={!calendars.length && !offer.length} className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-ink">{calendars.length || offer.length ? "Másik Apple ID hozzáadása" : "Lépések"}</summary>
        <form action={action} className="mt-3 flex flex-col gap-4">
          <AppPasswordSteps id="icloud-password" error={state.error} />
          <Field label="Apple ID-d (e-mail-cím)" htmlFor="icloud-user" hint="Amivel az iPhone-odon be vagy jelentkezve: Beállítások → legfelül a neved.">
            <Input id="icloud-user" name="username" type="email" autoComplete="email" required defaultValue={appleId} />
          </Field>
          <Button type="submit" className="w-fit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Apple />} {pending ? "Naptárak keresése…" : "Kész – naptáraim megjelenítése"}
          </Button>
          <p className="text-xs text-muted">Csak olvassuk a naptáraidat, és csak te látod őket. A jelszót titkosítva tároljuk.</p>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Nem iCloudot használsz? Más naptárszerver (Fastmail, Nextcloud, Zoho…)</summary>
            <div className="mt-2">
              <Field label="Szerver címe" htmlFor="caldav-server" hint="Üresen hagyva az iCloudot használjuk.">
                <Input id="caldav-server" name="server" placeholder="https://caldav.fastmail.com/" autoCapitalize="none" spellCheck={false} />
              </Field>
            </div>
          </details>
        </form>
      </details>
    </Card>
  );
}

/** Where the outside calendars come from: Google, Outlook, Apple; links are below this. */
export function CalendarSources({
  accounts,
  configured,
  calendars,
  icloudMailboxes,
  appleId,
  returnTo,
}: {
  accounts: CalendarAccount[];
  configured: CalendarAccount["provider"][];
  calendars: Subscription[];
  icloudMailboxes: { id: string; email: string }[];
  /** A good first guess for the Apple ID: the agent's own email address. */
  appleId: string;
  /** Where Google / Microsoft sign-ins come back to. */
  returnTo: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <ICloudCard calendars={calendars} icloudMailboxes={icloudMailboxes} appleId={appleId} />
      <ProviderCard provider="gmail" accounts={accounts} configured={configured.includes("gmail")} returnTo={returnTo} />
      <ProviderCard provider="outlook" accounts={accounts} configured={configured.includes("outlook")} returnTo={returnTo} />
    </div>
  );
}
