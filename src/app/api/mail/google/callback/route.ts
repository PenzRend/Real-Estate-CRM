import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { encryptToken } from "@/lib/mail/crypto";
import { exchangeCode, gmail } from "@/lib/mail/google";
import { createClient } from "@/lib/supabase/server";

const OAUTH_COOKIE = "mail_oauth";

function back(origin: string, query: string) {
  const res = NextResponse.redirect(new URL(`/inbox?${query}`, origin));
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/mail/google" });
  return res;
}

/** Google redirects here after consent: verify state, store the encrypted tokens. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const { searchParams, origin } = request.nextUrl;

  if (searchParams.get("error")) return back(origin, "mail_error=denied");

  let saved: { state?: string; verifier?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {
    // treated as missing below
  }
  const code = searchParams.get("code");
  if (!code || !saved.state || !saved.verifier || searchParams.get("state") !== saved.state) {
    return back(origin, "mail_error=state");
  }

  try {
    const tokens = await exchangeCode(code, saved.verifier, `${origin}/api/mail/google/callback`);
    if (!tokens.refresh_token) return back(origin, "mail_error=no_refresh");
    if (!tokens.scope?.includes("gmail.readonly")) return back(origin, "mail_error=scope");
    const profile = await gmail<{ emailAddress: string }>("profile", tokens.access_token);

    const supabase = await createClient();
    const { error } = await supabase.from("mailboxes").upsert(
      {
        organization_id: user.organization.id,
        user_id: user.id,
        provider: "gmail",
        email_address: profile.emailAddress.toLowerCase(),
        refresh_token_enc: encryptToken(tokens.refresh_token),
        access_token_enc: encryptToken(tokens.access_token),
        access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
        status: "active",
        last_error: null,
      },
      { onConflict: "user_id,provider,email_address" },
    );
    if (error) {
      console.error("mailbox upsert failed", error.code);
      return back(origin, "mail_error=save");
    }
  } catch (error) {
    console.error("gmail connect failed", error instanceof Error ? error.message : error);
    return back(origin, "mail_error=exchange");
  }
  return back(origin, "connected=1");
}
