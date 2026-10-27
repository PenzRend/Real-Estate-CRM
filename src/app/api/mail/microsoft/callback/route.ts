import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { encryptToken } from "@/lib/mail/crypto";
import { safeNext } from "@/lib/mail/google";
import { exchangeMicrosoftCode, grantedScopes, outlookProfile } from "@/lib/mail/microsoft";
import { appOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import { syncPendingToCalendar } from "@/lib/viewings/data";

const OAUTH_COOKIE = "mail_oauth_ms";

function back(origin: string, query: string, path = "/inbox") {
  const res = NextResponse.redirect(new URL(`${path}?${query}`, origin));
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/mail/microsoft" });
  return res;
}

/** Microsoft redirects here after consent: verify state, store the encrypted tokens. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const { searchParams } = request.nextUrl;
  const origin = await appOrigin();

  if (searchParams.get("error")) return back(origin, "mail_error=denied");

  let saved: { state?: string; verifier?: string; scopes?: string[]; send?: boolean; calendar?: boolean; next?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {
    // treated as missing below
  }
  const code = searchParams.get("code");
  if (!code || !saved.state || !saved.verifier || !saved.scopes?.length || searchParams.get("state") !== saved.state) {
    return back(origin, "mail_error=state");
  }

  try {
    const tokens = await exchangeMicrosoftCode(code, saved.verifier, `${origin}/api/mail/microsoft/callback`, saved.scopes);
    if (!tokens.refresh_token) return back(origin, "mail_error=no_refresh");
    const granted = grantedScopes(tokens.scope);
    if (!granted.has("mail.read")) return back(origin, "mail_error=scope");
    const canSend = granted.has("mail.send");
    const canCalendar = granted.has("calendars.readwrite");
    if (saved.send && !canSend) return back(origin, "mail_error=send_scope", safeNext(saved.next ?? null));
    if (saved.calendar && !canCalendar) return back(origin, "mail_error=calendar_scope", safeNext(saved.next ?? null));
    const email = await outlookProfile(tokens.access_token);

    const supabase = await createClient();
    const { error } = await supabase.from("mailboxes").upsert(
      {
        organization_id: user.organization.id,
        user_id: user.id,
        provider: "outlook",
        email_address: email,
        refresh_token_enc: encryptToken(tokens.refresh_token),
        access_token_enc: encryptToken(tokens.access_token),
        access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
        status: "active",
        last_error: null,
        can_send: canSend,
        can_calendar: canCalendar,
      },
      { onConflict: "user_id,provider,email_address" },
    );
    if (error) {
      console.error("mailbox upsert failed", error.code);
      return back(origin, "mail_error=save");
    }
  } catch (error) {
    console.error("outlook connect failed", error instanceof Error ? error.message : error);
    return back(origin, "mail_error=exchange");
  }
  if (saved.calendar) {
    // Viewings booked before the permission was given go into the calendar now.
    const { added, problem } = await syncPendingToCalendar(user, new Date()).catch(() => ({ added: 0, problem: "failed" as const }));
    return back(origin, `calendar_enabled=${added}${problem ? `&calendar_problem=${problem}` : ""}`, safeNext(saved.next ?? null));
  }
  return saved.send ? back(origin, "send_enabled=1", safeNext(saved.next ?? null)) : back(origin, "connected=1");
}
