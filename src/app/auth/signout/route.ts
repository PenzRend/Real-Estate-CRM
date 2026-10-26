import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.nextUrl.origin);
  const error = request.nextUrl.searchParams.get("error");
  if (error === "profile") url.searchParams.set("error", "profile");
  // 303 so a POST is followed by a GET of the login page.
  return NextResponse.redirect(url, 303);
}

/** Logout button (form POST). */
export const POST = signOut;

/** Used by the data access layer when a session has no usable profile. */
export const GET = signOut;
