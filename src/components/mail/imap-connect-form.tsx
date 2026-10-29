"use client";

import { Info, Loader2, Mail, Server } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { connectImapAction } from "@/app/(app)/inbox/actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import type { ImapConnectState } from "@/lib/mail/connect-imap";
import { connectPaths } from "@/lib/mail/provider";

/**
 * "Other mailbox": a business address on its own domain, iCloud, Yahoo… The
 * servers are found from the address; the agent only opens the server
 * settings when that guess doesn't work.
 */
export function ImapConnectForm({ email, cancelHref }: { email?: string; cancelHref: string | null }) {
  const [state, action, pending] = useActionState<ImapConnectState, FormData>(connectImapAction, { email });
  const s = state.settings;

  return (
    <Card className="p-6 sm:p-8">
      <form action={action} className="flex max-w-xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="grid size-11 place-items-center rounded-xl border border-border bg-surface text-muted shadow-float">
            <Mail className="size-5" />
          </span>
          <h2 className="text-2xl">Céges, iCloud vagy más postafiók</h2>
          <p className="text-sm text-muted">
            Bármelyik postafiók, ami IMAP-ot és SMTP-t használ: saját domaines céges cím (pl. tárhelyszolgáltatónál), iCloud, Yahoo, Zoho… A szerverbeállításokat
            a címből kikeressük. Google Workspace és Microsoft 365 címeknél a Google- vagy Microsoft-bejelentkezésre irányítunk.
          </p>
        </div>

        <Field label="E-mail-cím" htmlFor="imap-email" error={state.field === "email" ? state.error : undefined}>
          <Input id="imap-email" name="email" type="email" autoComplete="email" required defaultValue={state.email ?? email} aria-invalid={state.field === "email"} />
        </Field>
        <Field
          label="Jelszó"
          htmlFor="imap-password"
          hint="iCloudnál és kétlépcsős azonosításnál a szolgáltatónál létrehozott alkalmazásjelszó kell, nem a fiók jelszava."
          error={state.field === "password" ? state.error : undefined}
        >
          <Input id="imap-password" name="password" type="password" autoComplete="off" required aria-invalid={state.field === "password"} />
        </Field>

        {state.hint && (
          <p className="flex gap-2 rounded-xl bg-surface px-3 py-2 text-xs text-text">
            <Info className="mt-0.5 size-3.5 shrink-0 text-accent" /> {state.hint}
          </p>
        )}

        {state.suggest && (
          <div className="flex flex-col gap-3 rounded-xl border border-border-strong bg-background p-4 text-sm">
            <p className="text-ink">
              Ez a cím {state.suggest === "gmail" ? "Google (Gmail / Google Workspace)" : "Microsoft (Outlook / Microsoft 365)"}-fiók. Kapcsold össze a
              {state.suggest === "gmail" ? " Google" : " Microsoft"}-bejelentkezéssel – jelszó nélkül, biztonságosabban.
            </p>
            <a href={connectPaths[state.suggest]} className={buttonClasses("primary", "md", "w-fit")}>
              {state.suggest === "gmail" ? "Gmail összekapcsolása" : "Outlook / Microsoft 365 összekapcsolása"}
            </a>
          </div>
        )}

        {/* Keyed by the settings tried, so a new attempt's values replace the defaults. */}
        <details key={s ? `${s.imap.host}|${s.smtp.host}` : "none"} open={Boolean(s) && state.field !== "password"} className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
            <Server className="size-4 text-muted" /> Szerverbeállítások
            <span className="font-normal text-muted">{s ? `(${s.imap.host})` : "(automatikus)"}</span>
          </summary>
          <div className="grid grid-cols-1 gap-4 border-t border-border p-4 sm:grid-cols-[1fr_8rem]">
            {(state.field === "imap" || state.field === "smtp") && state.error && (
              <p role="alert" className="text-sm text-danger sm:col-span-2">
                {state.error}
              </p>
            )}
            <Field label="Bejövő (IMAP) szerver" htmlFor="imap-host">
              <Input id="imap-host" name="imapHost" placeholder="mail.irodad.hu" defaultValue={s?.imap.host} autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field label="Port" htmlFor="imap-port">
              <Select id="imap-port" name="imapPort" defaultValue={String(s?.imap.port ?? 993)}>
                <option value="993">993 (SSL)</option>
                <option value="143">143 (STARTTLS)</option>
              </Select>
            </Field>
            <Field label="Kimenő (SMTP) szerver" htmlFor="smtp-host">
              <Input id="smtp-host" name="smtpHost" placeholder="mail.irodad.hu" defaultValue={s?.smtp.host} autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field label="Port" htmlFor="smtp-port">
              <Select id="smtp-port" name="smtpPort" defaultValue={String(s?.smtp.port ?? 465)}>
                <option value="465">465 (SSL)</option>
                <option value="587">587 (STARTTLS)</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Felhasználónév" htmlFor="imap-user" hint="Általában a teljes e-mail-cím. Üresen hagyva azt használjuk.">
                <Input id="imap-user" name="username" defaultValue={s && s.imap.user !== state.email ? s.imap.user : undefined} autoCapitalize="none" spellCheck={false} />
              </Field>
            </div>
            <p className="text-xs text-muted sm:col-span-2">Ha a mezőket üresen hagyod, a címből keressük ki a beállításokat. A tárhelyszolgáltatód súgójában is megtalálod őket.</p>
          </div>
        </details>

        {state.error && !state.field && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Mail />} {pending ? "Kapcsolódás…" : "Összekapcsolás"}
          </Button>
          {cancelHref && (
            <Link href={cancelHref} className={buttonClasses("ghost", "lg")}>
              Mégse
            </Link>
          )}
        </div>
        <p className="text-xs text-muted">
          A jelszót titkosítva tároljuk, és csak a levelek lekéréséhez és a te kattintásodra történő küldéshez használjuk. Bármikor leválaszthatod.
        </p>
      </form>
    </Card>
  );
}
