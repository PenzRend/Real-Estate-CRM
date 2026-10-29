import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { MEDIA_BUCKET } from "@/lib/media/rules";
import { appOrigin } from "@/lib/origin";
import { hashSecretToken, newSecretToken } from "@/lib/secret-token";
import { createClient } from "@/lib/supabase/server";
import { buildListingFeed, type FeedListing } from "./feed-xml";

// The workspace's portal export link. Portals fetch it without cookies: the
// token is the key, only its hash is stored, and a new link replaces the old.

export async function feedStatus(user: CurrentUser) {
  const supabase = await createClient();
  const [{ data: feed }, { count }] = await Promise.all([
    supabase.from("listing_feeds").select("created_at, updated_at, last_fetched_at").eq("organization_id", user.organization.id).maybeSingle(),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", user.organization.id).eq("portal_export", true).is("archived_at", null),
  ]);
  return { exists: Boolean(feed), lastFetchedAt: (feed?.last_fetched_at as string | null) ?? null, listings: count ?? 0 };
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
