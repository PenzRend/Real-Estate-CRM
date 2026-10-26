"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

// The browser client, signed in through the session cookie. Used only where
// data must not pass through our server (large file uploads); RLS and the
// storage policies apply exactly as on the server.
export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
