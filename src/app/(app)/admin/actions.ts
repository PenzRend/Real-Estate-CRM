"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isPlatformAdmin, newSignupCode } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { appOrigin } from "@/lib/origin";
import { createAdminClient } from "@/lib/supabase/admin";

export type CodeResult = { ok: true; code: string; link: string; note: string | null; email: string | null } | { ok: false; error: string };
type Result = { ok: true } | { ok: false; error: string };

/** The admin's service client, or null for anyone else (and when the key is missing). */
async function adminClient() {
  const user = await getCurrentUser();
  return isPlatformAdmin(user) ? createAdminClient() : null;
}

const codeSchema = z.object({
  note: z.string().trim().max(200),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Adj meg egy érvényes e-mail-címet, vagy hagyd üresen.").max(320)]),
});

/** Makes a sign-up code, optionally locked to one address, and returns the link to send. */
export async function createSignupCodeAction(input: { note: string; email: string }): Promise<CodeResult> {
  const admin = await adminClient();
  if (!admin) return { ok: false, error: "Ehhez nincs jogosultságod." };
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const note = parsed.data.note || null;
  const email = parsed.data.email || null;

  // A clash with an existing code is unlikely; try again a few times if it happens.
  for (let i = 0; i < 3; i++) {
    const code = newSignupCode();
    const { error } = await admin.from("signup_codes").insert({ code, note, email });
    if (!error) {
      refresh();
      return { ok: true, code, note, email, link: `${await appOrigin()}/signup?code=${code}` };
    }
    if (error.code !== "23505") break;
  }
  return { ok: false, error: "A kód létrehozása nem sikerült. Próbáld újra." };
}

export async function revokeSignupCodeAction(id: string): Promise<Result> {
  const admin = await adminClient();
  if (!admin) return { ok: false, error: "Ehhez nincs jogosultságod." };
  const { error } = await admin.from("signup_codes").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("used_at", null);
  if (error) return { ok: false, error: "A visszavonás nem sikerült." };
  refresh();
  return { ok: true };
}

/** The workspace's own monthly AI cap; null goes back to the server default. */
export async function setAiLimitAction(organizationId: string, limit: number | null): Promise<Result> {
  const admin = await adminClient();
  if (!admin) return { ok: false, error: "Ehhez nincs jogosultságod." };
  if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 1_000_000)) return { ok: false, error: "Adj meg egy nem negatív egész számot." };
  const { error } = await admin.from("organizations").update({ ai_monthly_limit: limit }).eq("id", organizationId);
  if (error) return { ok: false, error: "A mentés nem sikerült." };
  refresh();
  return { ok: true };
}
