# Portal export feed (Hirdetési portálok)

One private XML link per workspace lists every listing an agent marked
**Portálokra** on its page, while the listing is active, reserved or under
negotiation and not archived. Real estate portals fetch the link on a schedule
and update the listings and photos on their side.

**Going live needs the portal.** Hungarian portals (ingatlan.com,
Otthon Centrum partner network, Jófogás, Startlak…) accept automatic imports
only from partners with an agreement, and each has its own import format. With
an agreement in place, either the portal maps the fields below (most accept a
generic XML), or a portal-specific format is added next to
`src/lib/portal/feed-xml.ts` from the same data.

## Setting it up

1. Owner or admin: Beállítások → Kapcsolatok → *Hirdetési portálok* →
   **Export link létrehozása**, then **Link másolása**.
2. Give the link to the portal (partner admin page or their support).
3. Agents mark listings with **Portálokra** on the listing's page.

A new link replaces the old one; the portal then needs the new one. The
settings card shows when a portal last fetched the feed.

## What the feed contains

- `GET /api/feed/<token>.xml` — `application/xml`, UTF-8.
- `GET /api/feed/<token>/photo/<id>` — each photo, at a link that stays the same.

```xml
<listings generator="Flavio" version="1" agency="…" generated="2026-10-29T12:00:00.000Z" count="1">
  <listing id="uuid" updated="ISO time">
    <reference>ABC-001</reference>
    <title>…</title>
    <type>apartment|house|plot|commercial|other</type>
    <transaction>sale|rent</transaction>
    <status>active|reserved|under_negotiation</status>
    <location><country>HU</country><city/><district/><postal_code/></location>
    <price currency="HUF|EUR">79900000</price>
    <area unit="sqm">54.5</area>
    <rooms>2.5</rooms><bedrooms/><bathrooms/><floor/>
    <building_type/><condition/><energy_rating/>
    <features><balcony>true</balcony><garden/><parking/></features>
    <description>…</description>
    <photos><photo>https://…/api/feed/<token>/photo/<id></photo>…</photos>
    <contact><name>agent</name><email>agent@…</email></contact>
  </listing>
</listings>
```

Empty fields are left out. Never in the feed: the street address, the owner,
internal notes, documents. The first photo is the cover.

## Security

The token is the key (portals send no cookies); only its SHA-256 hash is
stored (`listing_feeds`). The database functions `listing_feed` and
`listing_feed_photo` return only marked listings of the link's workspace.
