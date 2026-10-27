"use server";

import { getCurrentUser } from "@/lib/auth";
import { renewCalendarFeed } from "@/lib/calendar/feed";

export type FeedResult = { ok: true; url: string } | { ok: false; error: string };

/** A new calendar subscription link; the previous one stops working. */
export async function renewCalendarFeedAction(): Promise<FeedResult> {
  const user = await getCurrentUser();
  try {
    return { ok: true, url: await renewCalendarFeed(user) };
  } catch (error) {
    console.error("calendar feed", error instanceof Error ? error.message : error);
    return { ok: false, error: "A linket nem sikerült létrehozni. Próbáld újra." };
  }
}
