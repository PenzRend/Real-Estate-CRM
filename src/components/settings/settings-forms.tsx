"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { changePasswordAction, saveProfileAction, type SettingsState } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

function Result({ state }: { state: SettingsState }) {
  if (state.error)
    return (
      <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
        <CircleAlert className="size-4 shrink-0" /> {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm text-success">
        <CheckCircle2 className="size-4 shrink-0" /> {state.message}
      </p>
    );
  return null;
}

export function ProfileForm({ fullName, email, workspaceName, canRename }: { fullName: string; email: string; workspaceName: string; canRename: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveProfileAction, {});
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <Field label="Teljes név" htmlFor="full_name" hint="Vezetéknév elöl, ahogy az ügyfeleid ismernek.">
        <Input id="full_name" name="full_name" autoComplete="name" defaultValue={fullName} required maxLength={200} />
      </Field>
      <Field label="E-mail-cím" htmlFor="email" hint="Ezzel jelentkezel be.">
        <Input id="email" value={email} disabled readOnly />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Munkaterület neve"
          htmlFor="workspace_name"
          hint={canRename ? "Pl. az irodád neve. Az AI ezt írja az irodád neveként a levélvázlatokba." : "Csak a munkaterület tulajdonosa módosíthatja."}
        >
          <Input id="workspace_name" name="workspace_name" defaultValue={workspaceName} disabled={!canRename} required maxLength={200} />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-4 sm:col-span-2">
        <Result state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Mentés…" : "Mentés"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePasswordAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="grid gap-5 sm:grid-cols-2">
      <Field label="Új jelszó" htmlFor="password" hint="Legalább 8 karakter.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <Field label="Új jelszó még egyszer" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <div className="flex items-center justify-end gap-4 sm:col-span-2">
        <Result state={state} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Mentés…" : "Jelszó módosítása"}
        </Button>
      </div>
    </form>
  );
}
