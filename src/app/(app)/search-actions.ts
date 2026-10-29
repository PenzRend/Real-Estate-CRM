"use server";

import { getCurrentUser } from "@/lib/auth";
import { globalSearch, type SearchHit } from "@/lib/search/global";

/** Ctrl+K: everything that matches, grouped (clients, listings, deals, emails, tasks). */
export async function globalSearchAction(query: string): Promise<SearchHit[]> {
  const user = await getCurrentUser();
  return globalSearch(user, String(query ?? "").slice(0, 200));
}
