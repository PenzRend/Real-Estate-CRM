"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { changePasswordAction, saveProfileAction, usernameAvailableAction, type SettingsState } from "@/app/(app)/settings/actions";
import { AvatarPicker } from "@/components/settings/avatar-picker";
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

export function ProfileForm({
  userId,
  fullName,
  email,
  username,
  avatarUrl,
  workspaceName,
  canRename,
}: {
  userId: string;
  fullName: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  workspaceName: string;
  canRename: boolean;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveProfileAction, {});
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <AvatarPicker userId={userId} name={fullName} url={avatarUrl} />
      </div>
      <Field label="Teljes név" htmlFor="full_name" hint="Vezetéknév elöl, ahogy az ügyfeleid ismernek.">
        <Input id="full_name" name="full_name" autoComplete="name" defaultValue={fullName} required maxLength={200} />
      </Field>
      <UsernameField initial={username} />
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

/** "@" and the name, checked for availability while typed. */
function UsernameField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [free, setFree] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function change(next: string) {
    const v = next.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
    setValue(v);
    setFree(null);
    clearTimeout(timer.current);
    if (v && v !== initial) timer.current = setTimeout(() => void usernameAvailableAction(v).then(setFree), 350);
  }
  const hint =
    value === initial
      ? "A kollégáid így említhetnek az üzenetekben: @" + (value || "…")
      : value.length < 3
        ? "Legalább 3 karakter: kisbetű, szám, pont vagy aláhúzás."
        : free == null
          ? "Ellenőrzés…"
          : free
            ? "Szabad."
            : "Már foglalt – válassz másikat.";
  return (
    <Field label="Felhasználónév" htmlFor="username" hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">@</span>
        <Input id="username" name="username" value={value} onChange={(e) => change(e.target.value)} required minLength={3} maxLength={30} className="pl-7" autoComplete="username" />
      </div>
    </Field>
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
