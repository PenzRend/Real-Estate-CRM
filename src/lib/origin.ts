import "server-only";
import { headers } from "next/headers";

/**
 * The CRM's own public address, for redirects and links that leave it:
 * APP_URL when set (production, behind a proxy that terminates HTTPS), else
 * the forwarded or direct host of this request (development only: in
 * production the Host header is client input, so links must not follow it).
 */
export async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL must be set in production (e.g. https://flavio.hu)");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
