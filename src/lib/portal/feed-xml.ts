// The portal export feed as XML: one <listing> per listing the agents marked
// "Portálokra". A plain, documented format (docs/PORTAL-FEED.md); a portal's
// own import format is a mapping of these fields, done once its partner
// agreement is in place. Pure, so it is tested; feed.ts feeds it.

export type FeedListing = {
  id: string;
  reference: string | null;
  title: string;
  property_type: string;
  listing_type: string;
  status: string;
  country: string;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  price: number | null;
  currency: string;
  area_sqm: number | null;
  room_count: number | null;
  bedroom_count: number | null;
  bathroom_count: number | null;
  floor: string | null;
  building_type: string | null;
  condition: string | null;
  energy_rating: string | null;
  has_balcony: boolean | null;
  has_garden: boolean | null;
  has_parking: boolean | null;
  description: string | null;
  updated_at: string;
  agent: { name: string | null; email: string } | null;
  photos: string[];
};

// Characters XML 1.0 does not allow (control characters other than tab and newlines).
const INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export const xmlEscape = (s: string) =>
  s.replace(INVALID, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** `<name>value</name>`, or nothing when the value is empty. */
function el(name: string, value: string | number | boolean | null | undefined, attrs = "") {
  if (value == null || value === "") return "";
  return `<${name}${attrs}>${xmlEscape(String(value))}</${name}>`;
}

export function buildListingFeed({ agency, listings, photoUrl, now = new Date() }: { agency: string; listings: FeedListing[]; photoUrl: (id: string) => string; now?: Date }) {
  const items = listings.map((l) =>
    [
      `<listing id="${xmlEscape(l.id)}" updated="${xmlEscape(new Date(l.updated_at).toISOString())}">`,
      el("reference", l.reference),
      el("title", l.title),
      el("type", l.property_type),
      el("transaction", l.listing_type),
      el("status", l.status),
      "<location>",
      el("country", l.country),
      el("city", l.city),
      el("district", l.district),
      el("postal_code", l.postal_code),
      "</location>",
      el("price", l.price == null ? null : Math.round(Number(l.price)), ` currency="${xmlEscape(l.currency)}"`),
      el("area", l.area_sqm == null ? null : Number(l.area_sqm), ' unit="sqm"'),
      el("rooms", l.room_count == null ? null : Number(l.room_count)),
      el("bedrooms", l.bedroom_count),
      el("bathrooms", l.bathroom_count),
      el("floor", l.floor),
      el("building_type", l.building_type),
      el("condition", l.condition),
      el("energy_rating", l.energy_rating),
      "<features>",
      el("balcony", l.has_balcony),
      el("garden", l.has_garden),
      el("parking", l.has_parking),
      "</features>",
      el("description", l.description),
      l.photos.length ? `<photos>${l.photos.map((id) => el("photo", photoUrl(id))).join("")}</photos>` : "",
      l.agent ? `<contact>${el("name", l.agent.name)}${el("email", l.agent.email)}</contact>` : "",
      "</listing>",
    ]
      .filter(Boolean)
      .join("\n    "),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<listings generator="Flavio" version="1" agency="${xmlEscape(agency)}" generated="${now.toISOString()}" count="${listings.length}">`,
    ...items.map((i) => `  ${i}`),
    "</listings>",
    "",
  ].join("\n");
}
