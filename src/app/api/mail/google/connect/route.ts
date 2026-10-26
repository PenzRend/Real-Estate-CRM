import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isMailCryptoConfigured } from "@/lib/mail/crypto";
import { googleAuthUrl, googleConfig } from "@/lib/mail/google";

const OAUTH_COOKIE = "mail_oauth";

/** Starts "Connect Gmail": PKCE + state in a short-lived, http-only cookie. */
export async function GET(request: NextRequest) {
  await getCurrentUser();
  const origin = request.nextUrl.origin;
  if (!googleConfig() || !isMailCryptoConfigured()) {
    return NextResponse.redirect(new URL("/inbox?mail_error=config", origin));
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const response = NextResponse.redirect(
    googleAuthUrl({ redirectUri: `${origin}/api/mail/google/callback`, state, codeChallenge: challenge }),
  );
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier }), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/mail/google",
    maxAge: 600,
  });
  return response;
}
