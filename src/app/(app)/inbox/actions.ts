"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { setEmailStatus } from "@/lib/db/mail";
import { disconnectMailbox, syncMailbox, type SyncResult } from "@/lib/mail/sync";

/** The caller refreshes the list itself, so its result message stays on screen. */
export async function syncMailAction(): Promise<SyncResult> {
  const user = await getCurrentUser();
  return syncMailbox(user);
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

export async function disconnectMailAction() {
  const user = await getCurrentUser();
  await disconnectMailbox(user);
  refresh();
}
