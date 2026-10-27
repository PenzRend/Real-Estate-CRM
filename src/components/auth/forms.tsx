"use client";

import { CircleAlert, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import {
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

/** `next` and `email` come from an invite link: back to the invite after sign-up, with the invited address filled in. */
export function SignupForm({ next, email }: { next?: string; email?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});
  if (state.message) return <SentNotice message={state.message} />;
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
