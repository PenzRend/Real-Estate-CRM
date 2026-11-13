// The portal feed in Jófogás's own real-estate format
// (https://www.jofogas.hu/xml/ingatlan, schema ingatlan.xsd): numeric codes for
// category, floor, heating and the rest, a 12–70 character subject, a 20–4000
// character body, HUF prices and a +36 mobile number on every item. Listings
// that Jófogás can't take (no price, a euro price, "Egyéb" type) are left out
// with a comment saying why. Pure, so it is tested; feed.ts feeds it.

import { xmlEscape, type FeedListing } from "./feed-xml";

export type JofogasListing = FeedListing & { features?: Record<string, unknown> | null };
export type JofogasSettings = { partnerId: string | null; phone: string | null; email: string | null };

const fold = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** 1020 lakás, 1040 ház, 1340 sorház/ikerház/házrész, 1060 telek, 1080 iroda/üzlet; null: no Jófogás category. */
export function jofogasCategory(l: Pick<FeedListing, "property_type" | "building_type" | "title">): number | null {
  switch (l.property_type) {
    case "apartment":
      return 1020;
    case "house":
      return /sorhaz|ikerhaz|hazresz/.test(fold(`${l.building_type ?? ""} ${l.title}`)) ? 1340 : 1040;
    case "plot":
      return 1060;
    case "commercial":
      return 1080;
    default:
      return null;
  }
}

/** Földszint 1, magasföldszint 2, félemelet 3, 1–10. emelet 4–13, 10 fölött 14, tetőtér 15, alagsor/szuterén 16. */
export function jofogasFloor(raw: string | null): number | null {
  const f = fold(raw);
  if (!f) return null;
  if (/magasfoldszint|magas foldszint/.test(f)) return 2;
  if (/foldszint|^fsz|^0$/.test(f)) return 1;
  if (/felemelet/.test(f)) return 3;
  if (/tetoter/.test(f)) return 15;
  if (/alagsor|szuteren|pince/.test(f)) return 16;
  const n = /\d+/.exec(f);
  if (!n) return null;
  const floor = Number(n[0]);
  if (floor === 0) return 1;
  return floor > 10 ? 14 : floor + 3;
}

/** Fűtés szövegből a Jófogás kódja; 8 = egyéb. */
export function jofogasHeating(raw: unknown): number | null {
  const f = fold(typeof raw === "string" ? raw : "");
  if (!f) return null;
  if (/cirko|kombi|kazan/.test(f)) return 1;
  if (/hoszivattyu/.test(f)) return 10;
  if (/padlo/.test(f)) return 13;
  if (/tavfut|tavho/.test(f)) return 7;
  if (/hazkozpont/.test(f)) return 4;
  if (/egyedi meres/.test(f)) return 9;
  if (/kozponti/.test(f)) return 6;
  if (/konvektor/.test(f)) return 3;
  if (/kandallo|cserepkalyha|kalyha/.test(f)) return 5;
  if (/elektromos|villany|aram/.test(f)) return 2;
  if (/napkollektor|napelem|solar/.test(f)) return 11;
  if (/geoterm/.test(f)) return 12;
  return 8;
}

/** Állapot: 2 jó, 3 felújítandó, 4 építés alatt, 5 új építésű, 6 felújított, 7 újszerű. */
export function jofogasCondition(raw: string | null): number | null {
  const f = fold(raw);
  if (!f) return null;
  if (/felujitando|felujitasra szorul|lakhatatlan/.test(f)) return 3;
  if (/felujitott|frissen felujitott/.test(f)) return 6;
  if (/epites alatt|epul/.test(f)) return 4;
  if (/ujszeru/.test(f)) return 7;
  if (/uj epitesu|ujepitesu|^uj$|uj ep/.test(f)) return 5;
  if (/jo|kozepes|atlagos|kituno|kiv/.test(f)) return 2;
  return null;
}

const ENERGY: Record<string, number> = { "a+++": 12, "a++": 11, "a+": 1, a: 2, b: 3, c: 4, d: 5, e: 6, f: 7, g: 8, h: 9, i: 10 };
export function jofogasEnergy(raw: string | null): number | null {
  const m = /^[a-j](\+{0,3})/.exec(fold(raw).replace(/\s/g, ""));
  return m ? (ENERGY[m[0]] ?? null) : null;
}

const strip = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const typeWords: Record<string, string> = { apartment: "lakás", house: "ház", plot: "telek", commercial: "üzlethelyiség" };

/** 12–70 characters: the title, made longer with the place when too short, cut at a word when too long. */
export function jofogasSubject(l: Pick<FeedListing, "title" | "city" | "district" | "listing_type" | "property_type">): string {
  let s = strip(l.title).replace(/\s+/g, " ");
  if (s.length < 12) s = [s, [l.city, l.district].filter(Boolean).join(", ")].filter(Boolean).join(" – ");
  if (s.length < 12) s = `${l.listing_type === "rent" ? "Kiadó" : "Eladó"} ${typeWords[l.property_type] ?? "ingatlan"}${s ? ` – ${s}` : ""}`;
  if (s.length > 70) s = `${s.slice(0, 69).replace(/\s+\S*$/, "")}…`;
  return s.slice(0, 70);
}

/** 20–4000 characters, no HTML: the ad text, or a short summary of the data when there is none. */
export function jofogasBody(l: JofogasListing): string {
  const text = strip(l.description ?? "");
  if (text.length >= 20) return text.length > 4000 ? `${text.slice(0, 3999)}…` : text;
  const facts = [
    l.title,
    l.area_sqm != null ? `${Number(l.area_sqm)} m²` : null,
    l.room_count != null ? `${String(Number(l.room_count)).replace(".", ",")} szoba` : null,
    [l.city, l.district].filter(Boolean).join(", ") || null,
    text || null,
  ].filter(Boolean);
  const body = `${facts.join(". ")}.`;
  return body.length >= 20 ? body : `${body} Érdeklődjön telefonon!`;
}

/** Jófogás doesn't allow ( ) [ ] { } < > / \ | + = ? ! # $ % ^ in a name, and 50 characters at most. */
export const jofogasName = (s: string) =>
  s
    .replace(/[()[\]{}<>/\\|+=?!#$%^]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);

/** Why a listing can't go to Jófogás, or null when it can. */
export function jofogasSkipReason(l: JofogasListing): string | null {
  if (jofogasCategory(l) == null) return "a Jófogáson nincs ilyen kategória (Egyéb)";
  if (l.currency !== "HUF") return "a Jófogás csak forintos árat fogad";
  const price = l.price == null ? null : Math.round(Number(l.price));
  if (price == null || price < 5 || price > 2_000_000_000) return "nincs ár";
  if (!l.postal_code) return "nincs irányítószám";
  return null;
}

function el(name: string, value: string | number | null | undefined) {
  if (value == null || value === "") return "";
  return `<${name}>${xmlEscape(String(value))}</${name}>`;
}

const yesNo = (v: unknown) => (v === true ? 1 : v === false ? 2 : null);

export function buildJofogasFeed({
  agency,
  settings,
  listings,
  photoUrl,
}: {
  agency: string;
  settings: JofogasSettings;
  listings: JofogasListing[];
  photoUrl: (id: string) => string;
}) {
  const items: string[] = [];
  const skipped: string[] = [];
  for (const l of listings) {
    const reason = jofogasSkipReason(l);
    if (reason) {
      // "--" is not allowed inside an XML comment.
      skipped.push(`  <!-- Kihagyva: ${l.title.replace(/-{2,}/g, "-")} (${reason}) -->`);
      continue;
    }
    const features = l.features ?? {};
    const rooms = l.room_count == null ? null : Number(l.room_count);
    const whole = rooms == null ? null : Math.floor(rooms);
    const half = rooms != null && rooms - Math.floor(rooms) >= 0.5 ? 1 : null;
    const year = typeof features.year_built === "number" ? features.year_built : null;
    let condition = jofogasCondition(l.condition);
    // "Új építésű" needs the building year (2012–2027) as well.
    const buildingDate = year != null && year >= 2012 && year <= 2027 ? year - 2011 : null;
    if (condition === 5 && buildingDate == null) condition = 7;
    const buildingType = l.building_type ? (/tegla/.test(fold(l.building_type)) ? 1 : /panel/.test(fold(l.building_type)) ? 2 : 3) : null;

    const fields = [
      el("external_ad_id", l.id),
      el("email", l.agent?.email ?? settings.email),
      el("name", jofogasName(l.agent?.name || agency) || "Ingatlaniroda"),
      el("phone", settings.phone),
      el("price", Math.round(Number(l.price))),
      el("subject", jofogasSubject(l)),
      el("body", jofogasBody(l)),
      el("category", jofogasCategory(l)),
      el("type", l.listing_type === "rent" ? "u" : "s"),
      el("zipcode", l.postal_code),
      el("city", l.city?.slice(0, 30)),
      el("jfg_area", l.district),
      el("size", l.area_sqm == null ? null : Math.round(Number(l.area_sqm))),
      el("rooms", whole == null || whole < 1 ? null : Math.min(whole, 5)),
      el("half_room", half),
      el("floor", jofogasFloor(l.floor)),
      el("building_type", buildingType),
      el("realestate_condition", condition),
      el("building_date", condition === 5 ? buildingDate : null),
      el("energy_certificate", jofogasEnergy(l.energy_rating)),
      el("heating_type", jofogasHeating(features.heating)),
      el("balcony", yesNo(l.has_balcony)),
      el("elevator", yesNo(features.elevator)),
      el("garden", l.has_garden === true ? 1 : l.has_garden === false ? 4 : null),
      el("has_furniture", yesNo(features.furnished)),
      el("common_cost", typeof features.common_cost_huf === "number" ? features.common_cost_huf : null),
      l.photos.length
        ? `<images>${l.photos
            .slice(0, 15)
            .map((id, i) => `<image${i === 0 ? ' main-image="1"' : ""}>${xmlEscape(photoUrl(id))}</image>`)
            .join("")}</images>`
        : "",
    ].filter(Boolean);
    items.push(["    <item>", ...fields.map((f) => `      ${f}`), "    </item>"].join("\n"));
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<xml>",
    "  <contact>",
    `    ${`<partner_email>${xmlEscape(settings.email ?? "")}</partner_email>`}`,
    `    ${`<partner_name>${xmlEscape(jofogasName(agency) || "Ingatlaniroda")}</partner_name>`}`,
    `    ${`<partner_phone>${xmlEscape(settings.phone ?? "")}</partner_phone>`}`,
    `    ${`<partner_id>${xmlEscape(settings.partnerId ?? "")}</partner_id>`}`,
    "  </contact>",
    ...skipped,
    "  <items>",
    ...items,
    "  </items>",
    "</xml>",
    "",
  ].join("\n");
}

/** "06 30 123 4567", "+36 30/123-4567", "0630…" → "+36301234567"; null unless it's a Hungarian mobile (20, 30, 31, 50, 70). */
export function hungarianMobile(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+36")) d = d.slice(3);
  else if (d.startsWith("0036")) d = d.slice(4);
  else if (d.startsWith("06")) d = d.slice(2);
  return /^(20|30|31|50|70)\d{7}$/.test(d) ? `+36${d}` : null;
}
