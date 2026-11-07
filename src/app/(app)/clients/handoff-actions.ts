"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { handOffClient } from "@/lib/handoff/data";

export async function handOffClientAction(clientId: string, toUserId: string, note: string) {
  const user = await getCurrentUser();
  const r = await handOffClient(user, String(clientId), String(toUserId), String(note ?? ""));
  if (r.ok) refresh();
  return r;
}
