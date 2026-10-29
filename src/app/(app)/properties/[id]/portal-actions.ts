"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { setPortalExport } from "@/lib/portal/feed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setPortalExportAction(propertyId: string, on: boolean) {
  if (!UUID.test(propertyId)) return { ok: false as const };
  const user = await getCurrentUser();
  try {
    await setPortalExport(user, propertyId, on === true);
    refresh();
    return { ok: true as const };
  } catch (error) {
    console.error("portal export", error instanceof Error ? error.message : error);
    return { ok: false as const };
  }
}
