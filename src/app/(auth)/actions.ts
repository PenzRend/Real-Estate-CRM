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
  values?: { email?: string; full_name?: string };
};

const email = z.string().trim().toLowerCase().email("Adj meg egy érvényes e-mail-címet.").max(320);

// Emailed links point at the CRM's own address (APP_URL in production).
const siteOrigin = appOrigin;

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
    })
    .safeParse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
  const values = { email: String(formData.get("email") ?? ""), full_name: String(formData.get("full_name") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const next = safePath(formData.get("next"), "/dashboard");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
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
