"use client";

import { CircleAlert, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  changeSignupEmail,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type AuthFormState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

function SentNotice({ message }: { message: string }) {
  return (
    <div role="status" className="mt-8 rounded-2xl border border-border bg-surface p-5">
      <MailCheck className="size-5 text-success" />
      <p className="mt-3 text-sm text-ink">{message}</p>
      <p className="mt-2 text-xs text-muted">Nem érkezett meg? Nézd meg a spam mappát is.</p>
    </div>
  );
}

/**
 * After sign-up: the confirmation went out, and a mistyped address can be
 * corrected here (the account moves to it), instead of registering again.
 */
function SignupSent({ sent, next }: { sent: AuthFormState; next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(changeSignupEmail, sent);
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(sent.message);
  // A new confirmation went out: close the form and show where.
  if (state.message && state.message !== shown) {
    setShown(state.message);
    setEditing(false);
  }
  return (
    <div className="flex flex-col gap-4">
      <SentNotice message={state.message ?? sent.message ?? ""} />
      {editing ? (
        <form action={action} className="flex flex-col gap-3 rounded-2xl border border-border p-5">
          {next && <input type="hidden" name="next" value={next} />}
          <FormError message={state.error} />
          <Field label="A helyes e-mail-cím" htmlFor="fixed_email" hint="Ide küldjük újra a megerősítő levelet; a fiókod és a meghívókódod megmarad.">
            <Input id="fixed_email" name="email" type="email" autoComplete="email" required autoFocus defaultValue={state.values?.email} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Küldés…" : "Küldés erre a címre"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Mégse
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted">
          Elírtad a címet?{" "}
          <button type="button" onClick={() => setEditing(true)} className="font-medium text-ink underline-offset-4 hover:underline">
            E-mail-cím javítása
          </button>
        </p>
      )}
    </div>
  );
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {});
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <FormError message={state.error ?? notice} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="E-mail-cím" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="nev@iroda.hu" defaultValue={state.values?.email} />
      </Field>
      <Field label="Jelszó" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-sm text-muted hover:text-ink">
          Elfelejtetted a jelszavad?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Bejelentkezés…" : "Bejelentkezés"}
      </Button>
    </form>
  );
}

/**
 * `next` and `email` come from a team invite link: back to the invite after
 * sign-up, with the invited address filled in, and no code needed. `code` comes
 * from a pilot invite link.
 */
export function SignupForm({ next, email, code }: { next?: string; email?: string; code?: string }) {
  const invited = next?.startsWith("/invite/");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});
  if (state.message) return <SignupSent sent={state} next={next} />;
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <FormError message={state.error} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Teljes név" htmlFor="full_name">
        <Input id="full_name" name="full_name" autoComplete="name" required placeholder="Kovács Anna" defaultValue={state.values?.full_name} />
      </Field>
      <Field label="E-mail-cím" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="nev@iroda.hu" defaultValue={state.values?.email ?? email} />
      </Field>
      <Field label="Jelszó" htmlFor="password" hint="Legalább 8 karakter.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      {!invited && (
        <Field label="Meghívókód (ha van)" htmlFor="signup_code" hint="Kóddal 30 napig ingyenes. Kód nélkül a regisztráció után előfizetéssel kezdheted.">
          <Input
            id="signup_code"
            name="signup_code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            placeholder="ABCD-1234"
            className="font-mono uppercase"
            defaultValue={state.values?.signup_code ?? code}
          />
        </Field>
      )}
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? "Fiók létrehozása…" : "Regisztráció"}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  if (state.message) return <SentNotice message={state.message} />;
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <FormError message={state.error} />
      <Field label="E-mail-cím" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="nev@iroda.hu" defaultValue={state.values?.email} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Küldés…" : "Link küldése"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(updatePassword, {});
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <FormError message={state.error} />
      <Field label="Új jelszó" htmlFor="password" hint="Legalább 8 karakter.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <Field label="Új jelszó még egyszer" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Mentés…" : "Jelszó mentése"}
      </Button>
    </form>
  );
}
