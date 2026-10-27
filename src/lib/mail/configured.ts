import "server-only";
import { isMailCryptoConfigured } from "./crypto";
import { googleConfig } from "./google";
import { microsoftConfig } from "./microsoft";
import type { MailProvider } from "./provider";

/** The mail providers this deployment can connect (their OAuth app is set up, tokens can be encrypted). */
export function configuredProviders(): MailProvider[] {
  if (!isMailCryptoConfigured()) return [];
  return [...(googleConfig() ? (["gmail"] as const) : []), ...(microsoftConfig() ? (["outlook"] as const) : [])];
}
