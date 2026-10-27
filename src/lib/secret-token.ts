import { createHash, randomBytes } from "node:crypto";

// Secret links (team invites, calendar subscriptions): the token travels in
// the URL, only its SHA-256 hash is stored.

export function newSecretToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSecretToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** The shape newSecretToken produces, checked before any lookup. */
export const SECRET_TOKEN = /^[\w-]{43}$/;
