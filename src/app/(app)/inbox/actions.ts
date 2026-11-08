"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { insertTasks } from "@/lib/db/activity";
import { setEmailStatus } from "@/lib/db/mail";
import { createClient } from "@/lib/supabase/server";
import { importMail, readMail } from "@/lib/mail/browse";
import { connectImapMailbox, type ImapConnectState } from "@/lib/mail/connect-imap";
import { disconnectMailbox, setPrimaryMailbox, syncMailboxes, type SyncResult } from "@/lib/mail/sync";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Syncs all mailboxes. The caller refreshes the list itself, so its result message stays on screen. */
export async function syncMailAction(): Promise<SyncResult> {
  const user = await getCurrentUser();
  return syncMailboxes(user);
}

export async function ignoreEmailAction(id: string) {
  const user = await getCurrentUser();
  await setEmailStatus(user, id, "ignored");
  refresh();
}

export async function restoreEmailAction(id: string) {
  const user = await getCurrentUser();
  await setEmailStatus(user, id, "new");
  refresh();
}

export async function disconnectMailAction(mailboxId: string) {
  if (!UUID.test(mailboxId)) return;
  const user = await getCurrentUser();
  await disconnectMailbox(user, mailboxId);
  refresh();
}

export async function setPrimaryMailboxAction(mailboxId: string) {
  if (!UUID.test(mailboxId)) return;
  const user = await getCurrentUser();
  await setPrimaryMailbox(user, mailboxId);
  refresh();
}

/** "Other mailbox" form: checks the servers, saves, and back to the inbox. */
export async function connectImapAction(_prev: ImapConnectState, form: FormData): Promise<ImapConnectState> {
  const user = await getCurrentUser();
  const r = await connectImapMailbox(user, form);
  if (r.ok) redirect(r.calendars ? `/inbox?connected=1&calendars=${r.calendars}` : "/inbox?connected=1");
  return r;
}

/** "Összes levél": the text of one email, read live from the mailbox. */
export async function readMailAction(mailboxId: string, ref: string) {
  const user = await getCurrentUser();
  return readMail(user, mailboxId, String(ref).slice(0, 2000));
}

/** "Feldolgozás" on any email: bring it into Flavio, then process it like the others. */
export async function importMailAction(mailboxId: string, ref: string): Promise<{ ok: false; error: string }> {
  const user = await getCurrentUser();
  const r = await importMail(user, mailboxId, String(ref).slice(0, 2000));
  if (r.ok) redirect(`/interactions/new?email=${r.emailId}`);
  return r;
}

/** "Később válaszolok": a task to answer this email at the chosen time, linked to its client. The email stays in the list. */
export async function replyLaterAction(emailId: string, at: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!/^[0-9a-f-]{36}$/i.test(String(emailId)) || Number.isNaN(Date.parse(at))) return { ok: false, error: "Ismeretlen levél." };
  const supabase = await createClient();
  // RLS limits this to the user's own imported emails.
  const { data: e } = await supabase.from("emails").select("subject, from_name, from_email, client_id").eq("id", emailId).eq("user_id", user.id).maybeSingle();
  if (!e) return { ok: false, error: "Ismeretlen levél." };
  const about = e.subject?.trim() || e.from_name || e.from_email || "levél";
  await insertTasks(user, [{ title: `Válaszolni: ${about}`.slice(0, 200), due_at: new Date(at).toISOString(), client_id: e.client_id, property_id: null, source: "manual" }]);
  refresh();
  return { ok: true };
}
