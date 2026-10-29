"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { setEmailStatus } from "@/lib/db/mail";
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
