"use server";

import { getCurrentUser } from "@/lib/auth";
import { refresh } from "next/cache";
import { renewListingFeed, saveJofogasConfig } from "@/lib/portal/feed";
import { hungarianMobile } from "@/lib/portal/jofogas-xml";
import type { FeedResult } from "./calendar-actions";

/** A new portal export link; the previous one stops working. */
export async function renewListingFeedAction(): Promise<FeedResult> {
  const user = await getCurrentUser();
  if (user.organization.role === "member") return { ok: false, error: "A linket a tulajdonos vagy egy admin hozhatja létre." };
  try {
    return { ok: true, url: await renewListingFeed(user) };
  } catch (error) {
    console.error("listing feed", error instanceof Error ? error.message : error);
    return { ok: false, error: "A linket nem sikerült létrehozni. Próbáld újra." };
  }
}

/** The Jófogás partner ID and mobile number for the Jófogás feed. */
export async function saveJofogasAction(input: { partnerId: string; phone: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (user.organization.role === "member") return { ok: false, error: "Ezt a tulajdonos vagy egy admin állíthatja be." };
  const phone = input.phone.trim() ? hungarianMobile(input.phone) : null;
  if (input.phone.trim() && !phone) return { ok: false, error: "Magyar mobilszámot adj meg (20, 30, 31, 50 vagy 70), pl. +36 30 123 4567." };
  const partnerId = input.partnerId.trim() || null;
  if (partnerId && !/^[A-Za-z0-9_-]{1,50}$/.test(partnerId)) return { ok: false, error: "A partnerazonosító csak betűt, számot, kötőjelet és aláhúzást tartalmazhat." };
  try {
    const saved = await saveJofogasConfig(user, { partnerId, phone });
    if (!saved) return { ok: false, error: "Előbb hozd létre az export linket." };
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("jofogas config", error instanceof Error ? error.message : error);
    return { ok: false, error: "A mentés nem sikerült. Próbáld újra." };
  }
}
