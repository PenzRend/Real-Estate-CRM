"use server";

import { getCurrentUser } from "@/lib/auth";
import { renewListingFeed } from "@/lib/portal/feed";
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
