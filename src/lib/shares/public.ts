import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { MediaItem } from "@/lib/db/media";
import { MEDIA_BUCKET } from "@/lib/media/rules";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// The client-facing listing page's data. Read as an anonymous visitor (no
// session cookies, whoever opens it), through shared_listing(): only what the
// page shows, only for active links. Photos come as short-lived signed links,
// allowed by the "shared listings" storage policy.

export type SharedListing = {
  title: string;
  propertyType: string;
  listingType: "sale" | "rent";
  status: string;
  city: string | null;
  district: string | null;
  address: string | null;
  postalCode: string | null;
  price: number | null;
  currency: "HUF" | "EUR";
  areaSqm: number | null;
  roomCount: number | null;
  bedroomCount: number | null;
  bathroomCount: number | null;
  floor: string | null;
  buildingType: string | null;
  condition: string | null;
  energyRating: string | null;
  hasBalcony: boolean | null;
  hasGarden: boolean | null;
  hasParking: boolean | null;
  features: Record<string, unknown>;
  description: string | null;
  agency: string | null;
  contact: { name: string | null; phone: string | null; email: string | null };
  media: MediaItem[];
  /** For link previews in messengers: longer-lived than the page's links. */
  previewImage: string | null;
};

type Raw = Record<string, unknown> & {
  media: { id: string; kind: "photo" | "video"; path: string; thumb: string | null; width: number | null; height: number | null; duration: number | null; cover: boolean }[];
  contact: { name: string | null; phone: string | null; email: string | null };
};

const PAGE_LINK_SECONDS = 60 * 60;
const PREVIEW_LINK_SECONDS = 7 * 24 * 60 * 60;
const num = (v: unknown) => (v == null ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** One read per request (the page and its metadata share it, so a view counts once). */
export const getSharedListing = cache(async (token: string): Promise<SharedListing | null> => {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const supabase = createSupabaseClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("shared_listing", { p_token: token });
  if (error) {
    console.error("shared_listing failed", error.code);
    return null;
  }
  if (!data) return null;
  const raw = data as Raw;

  const paths = raw.media.flatMap((m) => [m.path, ...(m.thumb ? [m.thumb] : [])]);
  const { data: signed } = paths.length ? await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, PAGE_LINK_SECONDS) : { data: [] };
  const link = new Map((signed ?? []).filter((s) => s.signedUrl && s.path).map((s) => [s.path!, s.signedUrl]));
  const media: MediaItem[] = raw.media.map((m) => ({
    id: m.id,
    kind: m.kind,
    url: link.get(m.path) ?? null,
    thumbUrl: (m.thumb && link.get(m.thumb)) || (m.kind === "photo" ? (link.get(m.path) ?? null) : null),
    mimeType: m.kind === "photo" ? "image/jpeg" : "video/mp4",
    sizeBytes: 0,
    width: m.width,
    height: m.height,
    durationSeconds: m.duration == null ? null : Number(m.duration),
    isCover: m.cover,
  }));

  const cover = raw.media.find((m) => m.kind === "photo");
  const preview = cover ? await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(cover.thumb ?? cover.path, PREVIEW_LINK_SECONDS) : null;

  return {
    title: String(raw.title),
    propertyType: String(raw.property_type),
    listingType: raw.listing_type === "rent" ? "rent" : "sale",
    status: String(raw.status),
    city: str(raw.city),
    district: str(raw.district),
    address: str(raw.address),
    postalCode: str(raw.postal_code),
    price: num(raw.price),
    currency: raw.currency === "EUR" ? "EUR" : "HUF",
    areaSqm: num(raw.area_sqm),
    roomCount: num(raw.room_count),
    bedroomCount: num(raw.bedroom_count),
    bathroomCount: num(raw.bathroom_count),
    floor: str(raw.floor),
    buildingType: str(raw.building_type),
    condition: str(raw.condition),
    energyRating: str(raw.energy_rating),
    hasBalcony: (raw.has_balcony as boolean | null) ?? null,
    hasGarden: (raw.has_garden as boolean | null) ?? null,
    hasParking: (raw.has_parking as boolean | null) ?? null,
    features: (raw.features as Record<string, unknown>) ?? {},
    description: str(raw.description),
    agency: str(raw.agency),
    contact: raw.contact ?? { name: null, phone: null, email: null },
    media,
    previewImage: preview?.data?.signedUrl ?? null,
  };
});
