import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for OAuth tokens at rest. The key lives only on the server
// (MAIL_TOKEN_KEY, 32 random bytes as base64); the database never sees it.

function key() {
  const raw = process.env.MAIL_TOKEN_KEY;
  if (!raw) throw new Error("MAIL_TOKEN_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("MAIL_TOKEN_KEY must be 32 bytes, base64-encoded");
  return buf;
}

export function isMailCryptoConfigured() {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptToken(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown token format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
