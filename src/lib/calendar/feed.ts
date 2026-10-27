import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { appOrigin } from "@/lib/origin";
import { hashSecretToken, newSecretToken } from "@/lib/secret-token";
import { createClient } from "@/lib/supabase/server";
import { buildIcs, type IcsEvent } from "./ics";

type FeedRow = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  location: string | null;
  notes: string | null;
  client_name: string;
  client_phone: string | null;
  property_title: string;
  property_address: string | null;
  updated_at: string;
  workspace_name: string;
};

export async function hasCalendarFeed(user: CurrentUser) {
  const supabase = await createClient();
  const { data } = await supabase.from("calendar_feeds").select("id").eq("organization_id", user.organization.id).eq("user_id", user.id).maybeSingle();
  return Boolean(data);
}

/** A new subscription link for the user; an earlier link stops working. Returns the https URL. */
export async function renewCalendarFeed(user: CurrentUser) {
  const token = newSecretToken();
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("calendar_feeds")
    .update({ token_hash: hashSecretToken(token) })
    .eq("organization_id", user.organization.id)
    .eq("user_id", user.id)
    .select("id");
  if (error) throw new Error(`calendar feed renew failed: ${error.message}`);
  if (!updated?.length) {
    const { error: insertError } = await supabase
      .from("calendar_feeds")
      .insert({ organization_id: user.organization.id, user_id: user.id, token_hash: hashSecretToken(token) });
    if (insertError) throw new Error(`calendar feed create failed: ${insertError.message}`);
  }
  return `${await appOrigin()}/api/calendar/${token}.ics`;
}

/** The .ics text for a subscription token, or null when the link is unknown. */
export async function calendarFeedIcs(token: string, now = new Date()) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("calendar_feed", { p_token_hash: hashSecretToken(token) });
  if (error) throw new Error(`calendar_feed failed: ${error.message}`);
  const rows = (data ?? []) as FeedRow[];
  // An unknown token and a feed without viewings both return no rows; tell them apart.
  if (!rows.length && !(await feedExists(token))) return null;

  const events: IcsEvent[] = rows.map((v) => {
    const start = new Date(v.starts_at);
    return {
      uid: `viewing-${v.id}@flavio.hu`,
      start,
      end: new Date(start.getTime() + v.duration_minutes * 60_000),
      summary: `Megtekintés: ${v.client_name} – ${v.property_title}`,
      location: v.location || v.property_address,
      description: [v.client_phone && `Telefon: ${v.client_phone}`, v.notes].filter(Boolean).join("\n") || null,
      cancelled: v.status === "cancelled",
      updated: new Date(v.updated_at),
    };
  });
  const name = rows[0]?.workspace_name ? `Flavio – ${rows[0].workspace_name}` : "Flavio megtekintések";
  return buildIcs({ name, events, now });
}

async function feedExists(token: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("calendar_feed_exists", { p_token_hash: hashSecretToken(token) });
  return data === true;
}
