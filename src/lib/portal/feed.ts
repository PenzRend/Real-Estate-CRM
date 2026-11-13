import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { MEDIA_BUCKET } from "@/lib/media/rules";
import { appOrigin } from "@/lib/origin";
import { hashSecretToken, newSecretToken } from "@/lib/secret-token";
import { createClient } from "@/lib/supabase/server";
import { buildListingFeed, type FeedListing } from "./feed-xml";
import { buildJofogasFeed, type JofogasListing } from "./jofogas-xml";

// The workspace's portal export link. Portals fetch it without cookies: the
// token is the key, only its hash is stored, and a new link replaces the old.

export async function feedStatus(user: CurrentUser) {
  const supabase = await createClient();
  const [{ data: feed }, { count }] = await Promise.all([
    supabase.from("listing_feeds").select("*").eq("organization_id", user.organization.id).maybeSingle(),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", user.organization.id).eq("portal_export", true).is("archived_at", null),
  ]);
  // select("*"): before the Jófogás columns exist, the rest still loads.
  const jofogas: JofogasConfig = { partnerId: (feed?.jofogas_partner_id as string | null | undefined) ?? null, phone: (feed?.jofogas_phone as string | null | undefined) ?? null };
  return { exists: Boolean(feed), lastFetchedAt: (feed?.last_fetched_at as string | null) ?? null, listings: count ?? 0, jofogas };
}

/** A new feed link (owner or admin); an earlier link stops working. Returns the https URL. */
export async function renewListingFeed(user: CurrentUser) {
  if (user.organization.role === "member") throw new Error("only managers renew the feed");
  const token = newSecretToken();
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("listing_feeds")
    .update({ token_hash: hashSecretToken(token) })
    .eq("organization_id", user.organization.id)
    .select("id");
  if (error) throw new Error(`listing feed renew failed: ${error.message}`);
  if (!updated?.length) {
    const { error: insertError } = await supabase.from("listing_feeds").insert({ organization_id: user.organization.id, token_hash: hashSecretToken(token) });
    if (insertError) throw new Error(`listing feed create failed: ${insertError.message}`);
  }
  return `${await appOrigin()}/api/feed/${token}.xml`;
}

/** The XML for a feed token, or null when the link is unknown. */
export async function listingFeedXml(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listing_feed", { p_token_hash: hashSecretToken(token) });
  if (error) throw new Error(`listing_feed failed: ${error.message}`);
  if (!data) return null;
  const feed = data as { agency: string; listings: FeedListing[] };
  const origin = await appOrigin();
  return buildListingFeed({ agency: feed.agency, listings: feed.listings, photoUrl: (id) => `${origin}/api/feed/${token}/photo/${id}` });
}

/** One photo of a listing in the feed, or null. */
export async function listingFeedPhoto(token: string, mediaId: string) {
  const supabase = await createClient();
  const { data: path } = await supabase.rpc("listing_feed_photo", { p_token_hash: hashSecretToken(token), p_media_id: mediaId });
  if (typeof path !== "string") return null;
  const { data: file } = await supabase.storage.from(MEDIA_BUCKET).download(path);
  return file;
}

export async function portalExportOf(user: CurrentUser, propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("properties").select("portal_export").eq("organization_id", user.organization.id).eq("id", propertyId).maybeSingle();
  return data?.portal_export === true;
}

/** Puts a listing in or out of the portal feed. */
export async function setPortalExport(user: CurrentUser, propertyId: string, on: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("properties").update({ portal_export: on }).eq("organization_id", user.organization.id).eq("id", propertyId);
  if (error) throw new Error(`portal export toggle failed: ${error.message}`);
}

/** The same feed in Jófogás's format, or null when the link is unknown. */
export async function jofogasFeedXml(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listing_feed", { p_token_hash: hashSecretToken(token) });
  if (error) throw new Error(`listing_feed failed: ${error.message}`);
  if (!data) return null;
  const feed = data as { agency: string; jofogas?: { partner_id: string | null; phone: string | null; email: string | null }; listings: JofogasListing[] };
  const origin = await appOrigin();
  return buildJofogasFeed({
    agency: feed.agency,
    settings: { partnerId: feed.jofogas?.partner_id ?? null, phone: feed.jofogas?.phone ?? null, email: feed.jofogas?.email ?? null },
    listings: feed.listings,
    photoUrl: (id) => `${origin}/api/feed/${token}/photo/${id}`,
  });
}

export type JofogasConfig = { partnerId: string | null; phone: string | null };

/** The Jófogás partner ID and mobile number next to the feed link (managers only). */
export async function saveJofogasConfig(user: CurrentUser, config: JofogasConfig) {
  if (user.organization.role === "member") throw new Error("only managers change the feed");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_feeds")
    .update({ jofogas_partner_id: config.partnerId, jofogas_phone: config.phone })
    .eq("organization_id", user.organization.id)
    .select("id");
  if (error) throw new Error(`jofogas config failed: ${error.message}`);
  return Boolean(data?.length);
}
