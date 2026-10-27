import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isMailCryptoConfigured } from "@/lib/mail/crypto";
import { googleAuthUrl, googleConfig, safeNext } from "@/lib/mail/google";
import { appOrigin } from "@/lib/origin";

const OAUTH_COOKIE = "mail_oauth";

/**
 * Starts "Connect Gmail": PKCE + state in a short-lived, http-only cookie.
 * `?send=1` also asks for the send permission, `?calendar=1` for the
 * Calendar permission (each granted on top of reading).
 */
export async function GET(request: NextRequest) {
  await getCurrentUser();
  // Google needs the exact public address (https behind the proxy), so not the request's own URL.
  const origin = await appOrigin();
  if (!googleConfig() || !isMailCryptoConfigured()) {
    return NextResponse.redirect(new URL("/inbox?mail_error=config", origin));
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const send = request.nextUrl.searchParams.get("send") === "1";
  const calendar = request.nextUrl.searchParams.get("calendar") === "1";
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(
    googleAuthUrl({ redirectUri: `${origin}/api/mail/google/callback`, state, codeChallenge: challenge, send, calendar }),
  );
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, send, calendar, next }), {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: "/api/mail/google",
    maxAge: 600,
  });
  return response;
}
