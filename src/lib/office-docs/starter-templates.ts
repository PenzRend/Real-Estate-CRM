// Ready-made templates an office can start from (Sablonok → "Példasablonok"),
// in the document creator's language (template-render.ts).

export const STARTER_TEMPLATES: { name: string; trigger: "manual" | "client_created" | "deal_created"; folder: string; body: string }[] = [
  {
    name: "Bemutatkozó levél új ügyfélnek",
    trigger: "client_created",
    folder: "Sablonok",
    body: `# Köszönjük, hogy minket választott!

Kedves {vevo_nev}!

[[AI: írj két-három barátságos mondatot, amelyben az ingatlanos bemutatkozik az ügyfélnek, és elmondja, hogyan segít neki megtalálni a megfelelő ingatlant. Ha ismert a keresett terület vagy a keret, utalj rá.]]

## Így dolgozunk
- Az igényei alapján folyamatosan figyeljük a kínálatot, és csak illő ingatlanokat küldünk.
- A megtekintéseket a naptárához igazítjuk, előtte emlékeztetőt küldünk.
- Az ajánlattól a szerződésig végig mellette vagyunk.

Bármikor elér: **{ugynok_nev}**, {ugynok_email}

Üdvözlettel,
{ugynok_nev}
{iroda}
{datum}`,
  },
  {
    name: "Foglalási megállapodás (vázlat)",
    trigger: "deal_created",
    folder: "Szerződésminták",
    body: `# Foglalási megállapodás – vázlat

Kelt: {datum}

## Felek
- **Eladó:** {elado_nev}
- **Vevő:** {vevo_nev}
- **Közvetítő:** {iroda}, ügyintéző: {ugynok_nev}

## Az ingatlan
- **Cím:** {ingatlan_cim}
- **Alapterület:** {alapterulet} m²
- **Saját azonosító:** {ingatlan_azonosito}

## Feltételek
- **Vételár:** {vetelar}
- **Foglaló:** {foglalo}, megfizetése: {foglalo_hatarido}
- **Adásvételi szerződés tervezett napja:** {szerzodes_datum}
- **Birtokbaadás:** {birtokbaadas}

[[AI: írj egy rövid, közérthető összefoglalót a feleknek arról, mi a következő lépés a megadott dátumok alapján. Ne adj jogi tanácsot.]]

Ez a dokumentum vázlat; a végleges szerződést ügyvéd készíti el.`,
  },
  {
    name: "Ingatlan-bemutató vevőnek",
    trigger: "manual",
    folder: "Marketing",
    body: `# {ingatlan_megnevezes}

{ingatlan_cim}

[[AI: írj egy rövid, vonzó bemutatót az ingatlanról a megadott adatokból (ár, méret, szobák, hely). Ne találj ki olyan tulajdonságot, ami nincs az adatok között.]]

## A legfontosabbak
- **Irányár:** {ingatlan_ar}
- **Alapterület:** {alapterulet} m²
- **Szobák:** {szobak}

Megtekintés egyeztetése: {ugynok_nev}, {ugynok_email}`,
  },
];
