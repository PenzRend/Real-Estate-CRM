import "server-only";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Shareable listing links (property_shares): one active link per listing, made
// and managed by workspace members (RLS). The public page reads through the
// shared_listing() database function, never the tables.

export type Share = {
  id: string;
  token: string;
  url: string;
  showAddress: boolean;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  token: string;
  show_address: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
};

const COLUMNS = "id, token, show_address, contact_name, contact_phone, contact_email, view_count, last_viewed_at, created_at";

/** The CRM's own address, for links that leave it (APP_URL when set, else this request's host). */
export async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const toShare = (r: Row, origin: string): Share => ({
  id: r.id,
  token: r.token,
  url: `${origin}/l/${r.token}`,
  showAddress: r.show_address,
  contactName: r.contact_name,
  contactPhone: r.contact_phone,
  contactEmail: r.contact_email,
  viewCount: r.view_count,
  lastViewedAt: r.last_viewed_at,
  createdAt: r.created_at,
});

export async function getActiveShare(user: CurrentUser, propertyId: string): Promise<Share | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_shares")
    .select(COLUMNS)
    .eq("organization_id", user.organization.id)
    .eq("property_id", propertyId)
    .is("revoked_at", null)
    .maybeSingle();
  return data ? toShare(data as Row, await appOrigin()) : null;
}

/** Contact details for a new link: the agent's last used ones, else their profile. */
export async function defaultContact(user: CurrentUser) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_shares")
    .select("contact_name, contact_phone, contact_email")
    .eq("organization_id", user.organization.id)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    name: data?.contact_name ?? user.fullName ?? "",
    phone: data?.contact_phone ?? "",
    email: data?.contact_email ?? user.email,
  };
}

export type ShareSettings = { showAddress: boolean; contactName: string | null; contactPhone: string | null; contactEmail: string | null };

/** The listing's active link, made now if there is none. */
export async function ensureShare(user: CurrentUser, propertyId: string, settings?: ShareSettings): Promise<Share> {
  const existing = await getActiveShare(user, propertyId);
  if (existing) return existing;
  let contact: ShareSettings;
  if (settings) contact = settings;
  else {
    const c = await defaultContact(user);
    contact = { showAddress: false, contactName: c.name || null, contactPhone: c.phone || null, contactEmail: c.email || null };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_shares")
    .insert({
      organization_id: user.organization.id,
      property_id: propertyId,
      token: randomBytes(18).toString("base64url"),
      show_address: contact.showAddress,
      contact_name: contact.contactName,
      contact_phone: contact.contactPhone,
      contact_email: contact.contactEmail,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    // A parallel request may have made the link a moment ago.
    const again = await getActiveShare(user, propertyId);
    if (again) return again;
    throw new Error(`Failed to create share link: ${error?.code}`);
  }
  return toShare(data as Row, await appOrigin());
}

export async function updateShare(user: CurrentUser, propertyId: string, settings: ShareSettings) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("property_shares")
    .update({ show_address: settings.showAddress, contact_name: settings.contactName, contact_phone: settings.contactPhone, contact_email: settings.contactEmail })
    .eq("organization_id", user.organization.id)
    .eq("property_id", propertyId)
    .is("revoked_at", null);
  if (error) throw new Error(`Failed to update share link: ${error.code}`);
}

export async function revokeShare(user: CurrentUser, propertyId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("property_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", user.organization.id)
    .eq("property_id", propertyId)
    .is("revoked_at", null);
  if (error) throw new Error(`Failed to revoke share link: ${error.code}`);
}
