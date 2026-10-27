import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isMailCryptoConfigured } from "@/lib/mail/crypto";
import { safeNext } from "@/lib/mail/google";
import { microsoftAuthUrl, microsoftConfig, microsoftScopes } from "@/lib/mail/microsoft";
import { getMailbox } from "@/lib/mail/sync";
import { appOrigin } from "@/lib/origin";

const OAUTH_COOKIE = "mail_oauth_ms";

/**
 * Starts "Connect Outlook": PKCE + state in a short-lived, http-only cookie.
 * `?send=1` / `?calendar=1` add those permissions; permissions already given
 * are asked for again so the new token keeps them.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const origin = await appOrigin();
  if (!microsoftConfig() || !isMailCryptoConfigured()) {
    return NextResponse.redirect(new URL("/inbox?mail_error=config", origin));
  }

  const existing = await getMailbox(user).catch(() => null);
  const outlook = existing?.provider === "outlook" ? existing : null;
  const send = request.nextUrl.searchParams.get("send") === "1" || Boolean(outlook?.can_send);
  const calendar = request.nextUrl.searchParams.get("calendar") === "1" || Boolean(outlook?.can_calendar);
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const response = NextResponse.redirect(
    microsoftAuthUrl({
      redirectUri: `${origin}/api/mail/microsoft/callback`,
      state,
      codeChallenge: challenge,
      send,
      calendar,
      loginHint: outlook?.email_address ?? null,
    }),
  );
  response.cookies.set(
    OAUTH_COOKIE,
    JSON.stringify({
      state,
      verifier,
      scopes: microsoftScopes({ send, calendar }),
      send: request.nextUrl.searchParams.get("send") === "1",
      calendar: request.nextUrl.searchParams.get("calendar") === "1",
      next,
    }),
    { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/api/mail/microsoft", maxAge: 600 },
  );
  return response;
}
