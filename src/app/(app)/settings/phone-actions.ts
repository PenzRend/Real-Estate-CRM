"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { appOrigin } from "@/lib/origin";
import { createPhoneKey, revokePhoneKey } from "@/lib/phone/calls";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createPhoneKeyAction(label: string): Promise<{ ok: true; key: string; server: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  try {
    const key = await createPhoneKey(user, String(label ?? ""));
    refresh();
    return { ok: true, key, server: await appOrigin() };
  } catch (error) {
    console.error("phone key", error instanceof Error ? error.message : error);
    return { ok: false, error: "A kulcsot nem sikerült létrehozni. Próbáld újra." };
  }
}

export async function revokePhoneKeyAction(id: string) {
  if (!UUID.test(id)) return;
  await revokePhoneKey(await getCurrentUser(), id);
  refresh();
}
