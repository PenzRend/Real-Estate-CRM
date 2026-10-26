"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
  /** Echo non-secret fields so the form keeps them after an error. */
  values?: { email?: string; full_name?: string };
};

const email = z.string().trim().toLowerCase().email("Adj meg egy érvényes e-mail-címet.").max(320);
const newPassword = z
  .string()
  .min(8, "A jelszó legalább 8 karakter legyen.")
  .max(72, "A jelszó legfeljebb 72 karakter lehet.");

const supabaseErrors: Record<string, string> = {
  invalid_credentials: "Hibás e-mail-cím vagy jelszó.",
  email_not_confirmed: "Előbb erősítsd meg az e-mail-címedet a neked küldött levélben található linkkel.",
  user_already_exists: "Ezzel az e-mail-címmel már van fiók. Jelentkezz be, vagy kérj új jelszót.",
  weak_password: "Ez a jelszó túl gyenge. Válassz hosszabbat, kevésbé kitalálhatót.",
  same_password: "Az új jelszó nem egyezhet meg a régivel.",
  over_email_send_rate_limit: "Túl sok e-mail ment ki rövid idő alatt. Próbáld újra néhány perc múlva.",
  over_request_rate_limit: "Túl sok próbálkozás. Próbáld újra néhány perc múlva.",
};

function translate(error: { code?: string; message: string }) {
  return (error.code && supabaseErrors[error.code]) || "Valami hiba történt. Próbáld újra később.";
}

async function siteOrigin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? "http://localhost:3000";
}

/** Only allow same-site relative redirects ("/clients", not "//evil.com"). */
function safeNext(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Add meg a jelszavad.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translate(error), values };

  redirect(safeNext(formData.get("next")));
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/dashboard`,
    },
  });
  if (error) return { error: translate(error), values };

  // Email confirmation disabled in Supabase → already signed in.
  if (data.session) redirect("/dashboard");

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
