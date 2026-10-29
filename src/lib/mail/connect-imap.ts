import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { configuredProviders } from "./configured";
import { encryptToken, isMailCryptoConfigured } from "./crypto";
import { discoverSettings, testMailbox } from "./imap";
import type { ServerSettings, Suggestion } from "./imap-settings";
import { isFirstMailbox } from "./sync";

// Connecting an IMAP/SMTP mailbox: find the servers, check the password on
// both, then store it encrypted. Nothing is saved until both servers accept it.

export type ImapConnectState = {
  ok?: boolean;
  error?: string;
  /** Which field the error is about, so the form can point at it. */
  field?: "email" | "password" | "imap" | "smtp";
  email?: string;
  /** The settings tried, so the agent can correct them. */
  settings?: ServerSettings;
  hint?: string | null;
  /** The address belongs to Google or Microsoft: their sign-in is the way. */
  suggest?: Suggestion;
};

const port = z.coerce.number().int();
const schema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(500),
  imapHost: z.string().trim().max(253).optional(),
  imapPort: port.optional(),
  smtpHost: z.string().trim().max(253).optional(),
  smtpPort: port.optional(),
  username: z.string().trim().max(320).optional(),
});

const blankToUndefined = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v : undefined);

export async function connectImapMailbox(user: CurrentUser, form: FormData): Promise<ImapConnectState> {
  if (!isMailCryptoConfigured()) return { error: "A postafiók-kapcsolat most nem érhető el. Jelezd nekünk a Visszajelzés gombbal." };
  const parsed = schema.safeParse({
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    password: form.get("password") ?? "",
    imapHost: blankToUndefined(form.get("imapHost")),
    imapPort: blankToUndefined(form.get("imapPort")),
    smtpHost: blankToUndefined(form.get("smtpHost")),
    smtpPort: blankToUndefined(form.get("smtpPort")),
    username: blankToUndefined(form.get("username")),
  });
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] === "password" ? "password" : "email";
    return { email, field, error: field === "password" ? "Add meg a jelszót." : "Adj meg érvényes e-mail-címet." };
  }
  const d = parsed.data;

  let settings: ServerSettings;
  let hint: string | null = null;
  if (d.imapHost && d.smtpHost) {
    const login = d.username ?? d.email;
    settings = { imap: { host: d.imapHost.toLowerCase(), port: d.imapPort ?? 993, user: login }, smtp: { host: d.smtpHost.toLowerCase(), port: d.smtpPort ?? 465, user: login } };
  } else {
    const found = await discoverSettings(d.email);
    if ("suggest" in found) {
      // Google Workspace / Microsoft 365: the proper sign-in, when this deployment has it.
      if (configuredProviders().includes(found.suggest === "gmail" ? "gmail" : "outlook")) return { email, suggest: found.suggest };
      return { email, error: "Ez a cím Google- vagy Microsoft-fiók, és az összekapcsolása most nem érhető el. Jelezd nekünk a Visszajelzés gombbal." };
    }
    settings = found.settings;
    hint = found.hint;
  }

  const result = await testMailbox(d.email, settings, d.password);
  if (!result.ok) return { email, error: result.error, field: result.field, settings, hint };

  const first = await isFirstMailbox(user);
  const supabase = await createClient();
  const { error } = await supabase.from("mailboxes").upsert(
    {
      organization_id: user.organization.id,
      user_id: user.id,
      provider: "imap",
      email_address: d.email,
      ...(first ? { is_primary: true } : {}),
      refresh_token_enc: encryptToken(d.password),
      access_token_enc: null,
      access_token_expires_at: null,
      server_settings: result.settings,
      status: "active",
      last_error: null,
      // SMTP accepted the password: sending works; there is no calendar to write to.
      can_send: true,
      can_calendar: false,
    },
    { onConflict: "user_id,provider,email_address" },
  );
  if (error) {
    console.error("imap mailbox save failed", error.code);
    return { email, error: "A kapcsolat mentése nem sikerült. Próbáld újra.", settings: result.settings };
  }
  return { ok: true, email };
}
