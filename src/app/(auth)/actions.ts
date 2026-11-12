"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { appOrigin } from "@/lib/origin";
import { authErrorMessage as translate, newPassword } from "@/lib/password";
import { safePath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
  /** Echo non-secret fields so the form keeps them after an error. */
  values?: { email?: string; full_name?: string; signup_code?: string };
};

const email = z.string().trim().toLowerCase().email("Adj meg egy érvényes e-mail-címet.").max(320);

// Emailed links point at the CRM's own address (APP_URL in production).
const siteOrigin = appOrigin;

const codeErrors: Record<string, string> = {
  unknown: "Ez a meghívókód nem érvényes. Ellenőrizd, vagy kérj újat tőlünk.",
  used: "Ezt a meghívókódot már felhasználták. Kérj újat tőlünk.",
  expired: "Ez a meghívókód lejárt. Kérj újat tőlünk.",
  other_email: "Ez a meghívókód egy másik e-mail-címhez szól. Azzal a címmel regisztrálj, amelyikre kaptad.",
};

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Add meg a jelszavad.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translate(error), values };

  redirect(safePath(formData.get("next"), "/dashboard"));
}

export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({
      full_name: z.string().trim().min(1, "Add meg a neved.").max(200),
      email,
      password: newPassword,
      signup_code: z.string().trim().toUpperCase().max(20),
    })
    .safeParse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      password: formData.get("password"),
      signup_code: formData.get("signup_code") ?? "",
    });
  const values = {
    email: String(formData.get("email") ?? ""),
    full_name: String(formData.get("full_name") ?? ""),
    signup_code: String(formData.get("signup_code") ?? ""),
  };
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const next = safePath(formData.get("next"), "/dashboard");
  const supabase = await createClient();
  // A code is optional: a valid one gives 30 free days, without one the
  // account starts at the payment page. A mistyped code is caught here, so
  // nobody loses their trial to a typo (the sign-up trigger checks it again).
  const code = parsed.data.signup_code;
  if (code) {
    const { data: status } = await supabase.rpc("signup_code_status", { p_code: code, p_email: parsed.data.email });
    if (status !== "open") return { error: codeErrors[status as string] ?? codeErrors.unknown, values };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, ...(code && { signup_code: code }) },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  // The trigger refused the account: a 500 "Database error saving new user", with no error code, is the only sign of it.
  if (error && /database error saving new user/i.test(error.message)) return { error: codeErrors.unknown, values };
  if (error) return { error: translate(error), values };

  // Email confirmation disabled in Supabase → already signed in.
  if (data.session) redirect(next);

  return {
    message: `Küldtünk egy megerősítő levelet a(z) ${parsed.data.email} címre. Kattints a benne lévő linkre a fiókod aktiválásához.`,
  };
}

export async function requestPasswordReset(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: { email: String(formData.get("email") ?? "") } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  // Rate limits are worth reporting; anything else gets the same neutral
  // answer so the form cannot be used to probe which addresses have accounts.
  if (error?.code?.startsWith("over_")) return { error: translate(error) };

  return { message: "Ha ehhez a címhez tartozik fiók, néhány percen belül megérkezik a levél az új jelszó beállításához." };
}

export async function updatePassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ password: newPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "A két jelszó nem egyezik." })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: translate(error) };

  redirect("/dashboard");
}
