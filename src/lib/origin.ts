import "server-only";
import { headers } from "next/headers";

/**
 * The CRM's own public address, for redirects and links that leave it:
 * APP_URL when set (production, behind a proxy that terminates HTTPS), else
 * the forwarded or direct host of this request (development).
 */
export async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
