import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/origin";
import { safePath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL("/login", await appOrigin());
  const error = request.nextUrl.searchParams.get("error");
  if (error === "profile") url.searchParams.set("error", "profile");
  // E.g. an invite opened in the wrong account: sign out, then back to the invite.
  const next = safePath(request.nextUrl.searchParams.get("next"), "");
  if (next) url.searchParams.set("next", next);
  // 303 so a POST is followed by a GET of the login page.
  return NextResponse.redirect(url, 303);
}

/** Logout button (form POST). */
export const POST = signOut;

/** Used by the data access layer when a session has no usable profile. */
export const GET = signOut;
