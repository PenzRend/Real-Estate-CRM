import "server-only";
import type { CurrentUser } from "@/lib/auth";
import {
  compareMatches,
  matchClientToProperty,
  wantedListingType,
  type Match,
  type MatchClient,
  type MatchProperty,
} from "@/lib/matching/match";
import { createClient } from "@/lib/supabase/server";

const CLIENT_COLUMNS =
  "id, full_name, client_type, budget_min, budget_max, preferred_locations, preferred_property_types, min_rooms, min_bedrooms, min_area_sqm, max_area_sqm, other_requirements";
const PROPERTY_COLUMNS =
  "id, title, listing_type, property_type, status, city, district, price, currency, area_sqm, room_count, bedroom_count, has_balcony, has_garden, has_parking, owner_client_id, created_at";
const INACTIVE_CLIENT = "(converted,lost,archived)";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Decision = "dismissed" | "task_created" | null;
export type PropertyMatch = { property: MatchProperty & { created_at: string }; match: Match; decision: Decision };
export type ClientMatch = { client: MatchClient; match: Match; decision: Decision };

const num = (v: unknown) => (v == null ? null : Number(v));
function toMatchClient(r: MatchClient): MatchClient {
  return {
    ...r,
    budget_min: num(r.budget_min),
    budget_max: num(r.budget_max),
    min_rooms: num(r.min_rooms),
    min_area_sqm: num(r.min_area_sqm),
    max_area_sqm: num(r.max_area_sqm),
    preferred_locations: r.preferred_locations ?? [],
    preferred_property_types: r.preferred_property_types ?? [],
  };
}
function toMatchProperty<T extends MatchProperty>(r: T): T {
  return { ...r, price: num(r.price), area_sqm: num(r.area_sqm), room_count: num(r.room_count) };
}

async function decisions(user: CurrentUser, filter: { clientId?: string; propertyId?: string }) {
  const supabase = await createClient();
  let q = supabase.from("property_client_matches").select("property_id, client_id, status").eq("organization_id", user.organization.id);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  if (filter.propertyId) q = q.eq("property_id", filter.propertyId);
  const { data, error } = await q.limit(5000);
  if (error) throw new Error(`Failed to load match decisions: ${error.message}`);
  return new Map((data ?? []).map((d) => [`${d.property_id}:${d.client_id}`, d.status as Decision]));
}

async function activeProperties(user: CurrentUser, listingType?: "sale" | "rent", since?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("organization_id", user.organization.id)
    .eq("status", "active")
    .is("archived_at", null);
  if (listingType) q = q.eq("listing_type", listingType);
  if (since) q = q.gte("created_at", since);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(`Failed to load properties: ${error.message}`);
  return ((data ?? []) as (MatchProperty & { created_at: string })[]).map(toMatchProperty);
}

async function activeClients(user: CurrentUser) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("organization_id", user.organization.id)
    .is("archived_at", null)
    .not("status", "in", INACTIVE_CLIENT)
    .in("client_type", ["buyer", "investor", "tenant"])
    .limit(2000);
  if (error) throw new Error(`Failed to load clients: ${error.message}`);
  return ((data ?? []) as MatchClient[]).map(toMatchClient);
}

/** Active listings that fit a client, best first. Dismissed ones are left out. */
export async function matchesForClient(user: CurrentUser, clientId: string): Promise<PropertyMatch[]> {
  if (!UUID.test(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("id", clientId)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load client: ${error.message}`);
  if (!data) return [];
  const client = toMatchClient(data as MatchClient);
  const listingType = wantedListingType(client.client_type);
  if (!listingType) return [];

  const [properties, decided] = await Promise.all([activeProperties(user, listingType), decisions(user, { clientId })]);
  return properties
    .map((property) => {
      const match = matchClientToProperty(client, property);
      const decision = decided.get(`${property.id}:${clientId}`) ?? null;
      return match && decision !== "dismissed" ? { property, match, decision } : null;
    })
    .filter((m) => m !== null)
    .sort((a, b) => compareMatches(a.match, b.match));
}

/** Active clients a listing fits, best first. Dismissed ones are left out. */
export async function matchesForProperty(user: CurrentUser, propertyId: string): Promise<ClientMatch[]> {
  if (!UUID.test(propertyId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("id", propertyId)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load property: ${error.message}`);
  if (!data) return [];
  const property = toMatchProperty(data as MatchProperty & { created_at: string });
  // Draft or sold listings are not offered to anyone.
  if (property.status !== "active") return [];

  const [clients, decided] = await Promise.all([activeClients(user), decisions(user, { propertyId })]);
  return clients
    .map((client) => {
      const match = matchClientToProperty(client, property);
      const decision = decided.get(`${propertyId}:${client.id}`) ?? null;
      return match && decision !== "dismissed" ? { client, match, decision } : null;
    })
    .filter((m) => m !== null)
    .sort((a, b) => compareMatches(a.match, b.match));
}

export type Suggestion = { client: MatchClient; property: MatchProperty & { created_at: string }; match: Match };

/**
 * Dashboard suggestions: listings added in the last 14 days that strongly or
 * well fit an active client, and that the agent has not acted on yet.
 */
export async function matchSuggestions(user: CurrentUser, now: Date, limit = 5): Promise<Suggestion[]> {
  const since = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const [properties, clients, decided] = await Promise.all([
    activeProperties(user, undefined, since),
    activeClients(user),
    decisions(user, {}),
  ]);
  const out: Suggestion[] = [];
  for (const property of properties.slice(0, 50)) {
    for (const client of clients) {
      if (decided.has(`${property.id}:${client.id}`)) continue;
      const match = matchClientToProperty(client, property);
      if (match && match.category !== "possible") out.push({ client, property, match });
    }
  }
  return out.sort((a, b) => compareMatches(a.match, b.match) || b.property.created_at.localeCompare(a.property.created_at)).slice(0, limit);
}
