import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";

// The database client for code that runs both for a signed-in user (their
// session, RLS applies) and in background jobs (/api/cron, where there is no
// session). Background jobs run that code inside `asBackgroundJob`; everywhere
// else `db()` is the user's client.

const jobClient = new AsyncLocalStorage<SupabaseClient>();

export async function db(): Promise<SupabaseClient> {
  return jobClient.getStore() ?? (await createClient());
}

/** Runs `fn` with `client` as `db()` — for background jobs only, with the admin client. */
export function asBackgroundJob<T>(client: SupabaseClient, fn: () => Promise<T>): Promise<T> {
  return jobClient.run(client, fn);
}
