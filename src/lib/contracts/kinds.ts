// The contracts Flavio drafts: what each needs and its text, in the document
// creator's language (lib/office-docs/template-render.ts: # headings,
// **bold**, - bullets, {fields}, [[AI: …]] paragraphs). The texts are sound
// starting points for a Hungarian agency, not legal advice: every draft says
// it should be checked, and a sale contract needs a lawyer's countersignature
// for the land registry. Field values come from the records (contracts/data.ts);
// what isn't stored anywhere (parcel number, meter readings…) the agent fills
// in on the review screen.

export type ContractKind = "megbizasi" | "megtekintesi" | "foglalasi" | "adasveteli" | "berleti" | "atadas";
export type FieldGroup = "Felek" | "Ingatlan" | "Pénzügyek" | "Iroda" | "Egyéb";
export type ContractField = { key: string; label: string; group: FieldGroup; required?: boolean; hint?: string; options?: string[] };

const party = (who: "elado" | "vevo", label: string, group: FieldGroup = "Felek"): ContractField[] => [
  { key: `${who}_nev`, label: `${label} neve`, group, required: true },
  { key: `${who}_szuletesi_nev`, label: `${label} születési neve`, group },
  { key: `${who}_anyja_neve`, label: `${label} anyja neve`, group, required: true },
  { key: `${who}_szuletes`, label: `${label} születési helye, ideje`, group, required: true },
  { key: `${who}_lakcim`, label: `${label} lakcíme`, group, required: true },
  { key: `${who}_okmany`, label: `${label} személyi okmánya`, group, required: true, hint: "Az ügyfél pénzmosás elleni azonosításából jön." },
];

const property: ContractField[] = [
  { key: "ingatlan_cim", label: "Az ingatlan címe", group: "Ingatlan", required: true },
  { key: "helyrajzi_szam", label: "Helyrajzi szám", group: "Ingatlan", required: true, hint: "A tulajdoni lapról." },
  { key: "ingatlan_jelleg", label: "Megnevezés (pl. lakás)", group: "Ingatlan", required: true },
  { key: "alapterulet", label: "Alapterület (m²)", group: "Ingatlan", required: true },
  { key: "tulajdoni_hanyad", label: "Tulajdoni hányad", group: "Ingatlan", required: true, hint: "Pl. 1/1" },
  { key: "terhek", label: "Terhek a tulajdoni lapon", group: "Ingatlan", hint: "Pl. tehermentes, vagy a jelzálogjog jogosultja" },
];

const office: ContractField[] = [
  { key: "iroda_nev", label: "Az iroda neve", group: "Iroda", required: true },
  { key: "iroda_szekhely", label: "Az iroda székhelye", group: "Iroda", required: true },
  { key: "iroda_cegjegyzekszam", label: "Cégjegyzékszám", group: "Iroda", required: true },
  { key: "ugynok_nev", label: "Az ingatlanos neve", group: "Iroda", required: true },
  { key: "ugynok_telefon", label: "Az ingatlanos telefonszáma", group: "Iroda" },
];

const signing: ContractField[] = [
  { key: "kelt_helyseg", label: "Aláírás helye", group: "Egyéb", required: true },
  { key: "datum", label: "Kelt", group: "Egyéb", required: true },
];

const signatures = (left: string, right: string) => `
Kelt: {kelt_helyseg}, {datum}

..............................................
${left}

..............................................
${right}`;

const DRAFT_NOTE = "*Tervezet – aláírás előtt ellenőrizze a felek adatait és a feltételeket. Szükség esetén kérje ügyvéd segítségét.*";

export const CONTRACT_KINDS: Record<
  ContractKind,
  { label: string; short: string; from: "deal" | "property" | "client_property"; fields: ContractField[]; body: string; note?: string }
> = {
  megbizasi: {
    label: "Megbízási szerződés (eladó)",
    short: "Az eladó megbízza az irodát az ingatlan értékesítésével.",
    from: "property",
    fields: [
      ...party("elado", "Megbízó (eladó)"),
      ...property,
      { key: "iranyar", label: "Irányár", group: "Pénzügyek", required: true },
      { key: "jutalek_szazalek", label: "Sikerdíj (%)", group: "Pénzügyek", required: true, hint: "A vételár százaléka" },
      { key: "megbizas_tipusa", label: "A megbízás jellege", group: "Egyéb", required: true, options: ["kizárólagos", "nem kizárólagos"] },
      { key: "megbizas_idotartam", label: "Időtartam", group: "Egyéb", required: true, hint: "Pl. 6 hónap" },
      ...office,
      ...signing,
    ],
    body: `# Megbízási szerződés
## ingatlan értékesítésére

amely létrejött egyrészről **{elado_nev}** (születési név: {elado_szuletesi_nev}, anyja neve: {elado_anyja_neve}, született: {elado_szuletes}, lakcím: {elado_lakcim}, személyi okmány: {elado_okmany}) mint **Megbízó**,

másrészről **{iroda_nev}** (székhely: {iroda_szekhely}, cégjegyzékszám: {iroda_cegjegyzekszam}, képviseli: {ugynok_nev}) mint **Megbízott**

között az alábbi feltételekkel:

## 1. A megbízás tárgya
A Megbízó megbízza a Megbízottat a tulajdonában álló alábbi ingatlan értékesítésének közvetítésével:
- **Cím:** {ingatlan_cim}
- **Helyrajzi szám:** {helyrajzi_szam}
- **Megnevezés:** {ingatlan_jelleg}, alapterülete {alapterulet} m²
- **A Megbízó tulajdoni hányada:** {tulajdoni_hanyad}
- **Terhek:** {terhek}

[[AI: írj két-három mondatos, tárgyszerű leírást az ingatlanról a megadott adatokból (jelleg, alapterület, szobák, elhelyezkedés). Ne állíts olyat, ami nincs az adatok között.]]

## 2. Az irányár
A Megbízó az ingatlan irányárát **{iranyar_szoveg}** összegben határozza meg. Ettől eltérő vételárú ajánlat elfogadásáról a Megbízó dönt.

## 3. A megbízás jellege és időtartama
A megbízás **{megbizas_tipusa}**, időtartama a jelen szerződés aláírásától számított **{megbizas_idotartam}**. Kizárólagos megbízás esetén a Megbízó a megbízás időtartama alatt más közvetítőt nem bíz meg, és a Megbízott által felkutatott vevővel közvetlenül nem köt szerződést.

## 4. A Megbízott feladatai
- az ingatlan hirdetése, bemutatása az érdeklődőknek,
- a vevők felkutatása és a megtekintések megszervezése,
- közreműködés az ajánlatok egyeztetésében és a szerződéskötés előkészítésében,
- a jogszabályokban előírt ügyfél-azonosítás elvégzése.

## 5. Sikerdíj
A Megbízottat sikeres értékesítés esetén a végleges vételár **{jutalek_szazalek}%**-ának megfelelő sikerdíj illeti meg, amely az adásvételi szerződés aláírásakor esedékes. Sikeres az értékesítés, ha a Megbízó a Megbízott által közvetített vevővel – a megbízás tartama alatt vagy azt követő 12 hónapon belül – adásvételi szerződést köt.

## 6. Egyéb rendelkezések
A Megbízó kijelenti, hogy az ingatlan per-, teher- és igénymentességére vonatkozó tájékoztatása a valóságnak megfelel. A felek adataikat a vonatkozó adatvédelmi szabályok szerint kezelik. A szerződésben nem szabályozott kérdésekben a Polgári Törvénykönyv rendelkezései az irányadók.

A felek a szerződést elolvasás és értelmezés után, mint akaratukkal mindenben megegyezőt, jóváhagyólag aláírják.
${signatures("Megbízó", "Megbízott")}

${DRAFT_NOTE}`,
  },

  megtekintesi: {
    label: "Megtekintési nyilatkozat",
    short: "A vevő igazolja, hogy az ingatlant az iroda közvetítésével látta – a sikerdíj védelme.",
    from: "client_property",
    fields: [
      { key: "vevo_nev", label: "Az érdeklődő neve", group: "Felek", required: true },
      { key: "vevo_lakcim", label: "Az érdeklődő lakcíme", group: "Felek" },
      { key: "vevo_telefon", label: "Az érdeklődő telefonszáma", group: "Felek" },
      { key: "ingatlan_cim", label: "Az ingatlan címe", group: "Ingatlan", required: true },
      { key: "iranyar", label: "Irányár", group: "Pénzügyek" },
      { key: "megtekintes_datum", label: "A megtekintés ideje", group: "Egyéb", required: true },
      { key: "iroda_nev", label: "Az iroda neve", group: "Iroda", required: true },
      { key: "ugynok_nev", label: "Az ingatlanos neve", group: "Iroda", required: true },
      ...signing,
    ],
    body: `# Megtekintési nyilatkozat

Alulírott **{vevo_nev}** (lakcím: {vevo_lakcim}, telefon: {vevo_telefon}) kijelentem, hogy az alábbi ingatlant **{megtekintes_datum}** időpontban a(z) **{iroda_nev}** közvetítésével, {ugynok_nev} ingatlanos kíséretében megtekintettem:

- **Cím:** {ingatlan_cim}
- **Irányár:** {iranyar_szoveg}

Tudomásul veszem, hogy az ingatlanról a fenti iroda közvetítésével szereztem tudomást. Amennyiben a megtekintéstől számított 12 hónapon belül az ingatlanra – közvetlenül vagy más közvetítő útján – adásvételi szerződést kötök, a közvetítő irodát a megbízó által vállalt sikerdíj, ennek hiányában a vételár 3%-a + ÁFA összegű díj illeti meg.

Kijelentem, hogy az ingatlanra vonatkozó információkat bizalmasan kezelem.
${signatures("Érdeklődő", "Ingatlanos")}

${DRAFT_NOTE}`,
  },

  foglalasi: {
    label: "Foglalási megállapodás",
    short: "A vevő foglalót ad, a felek rögzítik a vételárat és a határidőket.",
    from: "deal",
    fields: [
      ...party("elado", "Eladó"),
      ...party("vevo", "Vevő"),
      ...property,
      { key: "vetelar", label: "Vételár", group: "Pénzügyek", required: true },
      { key: "foglalo", label: "Foglaló", group: "Pénzügyek", required: true },
      { key: "foglalo_hatarido", label: "A foglaló megfizetésének határideje", group: "Pénzügyek", required: true },
      { key: "fizetesi_mod", label: "Fizetés módja", group: "Pénzügyek", hint: "Pl. banki átutalás, részben hitelből" },
      { key: "szerzodes_datum", label: "Az adásvételi szerződés megkötésének határideje", group: "Egyéb", required: true },
      { key: "birtokbaadas", label: "Birtokbaadás", group: "Egyéb" },
      ...office,
      ...signing,
    ],
    body: `# Foglalási megállapodás

amely létrejött egyrészről **{elado_nev}** (születési név: {elado_szuletesi_nev}, anyja neve: {elado_anyja_neve}, született: {elado_szuletes}, lakcím: {elado_lakcim}, személyi okmány: {elado_okmany}) mint **Eladó**,

másrészről **{vevo_nev}** (születési név: {vevo_szuletesi_nev}, anyja neve: {vevo_anyja_neve}, született: {vevo_szuletes}, lakcím: {vevo_lakcim}, személyi okmány: {vevo_okmany}) mint **Vevő**

között, a(z) {iroda_nev} közvetítésével, az alábbi feltételekkel:

## 1. Az ingatlan
- **Cím:** {ingatlan_cim}
- **Helyrajzi szám:** {helyrajzi_szam}
- **Megnevezés:** {ingatlan_jelleg}, alapterülete {alapterulet} m²
- **Az Eladó tulajdoni hányada:** {tulajdoni_hanyad}
- **Terhek:** {terhek}

## 2. A vételár
A felek az ingatlan vételárát **{vetelar_szoveg}** összegben határozzák meg. Fizetés módja: {fizetesi_mod}.

## 3. A foglaló
A Vevő **{foglalo_szoveg}** foglalót fizet az Eladónak legkésőbb **{foglalo_hatarido}** napjáig. A foglaló a vételárba beszámít. Ha a szerződés teljesítése olyan okból hiúsul meg, amelyért a Vevő felelős, a foglalót elveszti; ha az Eladó felelős, a foglaló kétszeresét köteles visszafizetni (Ptk. 6:185. §).

## 4. Az adásvételi szerződés
A felek vállalják, hogy az adásvételi szerződést legkésőbb **{szerzodes_datum}** napjáig megkötik, ügyvédi ellenjegyzéssel. A birtokbaadás tervezett időpontja: {birtokbaadas}.

[[AI: foglald össze egy rövid bekezdésben a felek által egyeztetett különleges feltételeket az ügylet jegyzeteiből és ajánlataiból (pl. bútorok, határidők, finanszírozás). Ha nincs ilyen, írd: „A felek további különleges feltételt nem kötöttek ki.”]]

## 5. Záró rendelkezések
Az Eladó kijelenti, hogy az ingatlan a fenti terheken kívül per-, teher- és igénymentes. A megállapodásban nem szabályozott kérdésekben a Polgári Törvénykönyv rendelkezései az irányadók.
${signatures("Eladó", "Vevő")}

${DRAFT_NOTE}`,
  },

  adasveteli: {
    label: "Adásvételi szerződés – tervezet ügyvédnek",
    short: "A felek és a feltételek összeszedve, hogy az ügyvéd gyorsan elkészíthesse és ellenjegyezhesse.",
    from: "deal",
    fields: [
      ...party("elado", "Eladó"),
      ...party("vevo", "Vevő"),
      ...property,
      { key: "vetelar", label: "Vételár", group: "Pénzügyek", required: true },
      { key: "foglalo", label: "Már megfizetett foglaló", group: "Pénzügyek" },
      { key: "fizetesi_mod", label: "Fizetés módja", group: "Pénzügyek", required: true, hint: "Pl. önerő átutalással, a fennmaradó rész bankhitelből" },
      { key: "birtokbaadas", label: "Birtokbaadás", group: "Egyéb", required: true },
      { key: "ugyved", label: "Ellenjegyző ügyvéd", group: "Egyéb", hint: "Név, iroda" },
      ...office,
      ...signing,
    ],
    note: "Ingatlan-adásvételi szerződést a földhivatali bejegyzéshez ügyvéd ellenjegyez: ez a tervezet neki készül.",
    body: `# Adásvételi szerződés – tervezet

*Az ügyvéd részére előkészítve. Ellenjegyző ügyvéd: {ugyved}.*

## Eladó
**{elado_nev}** – születési név: {elado_szuletesi_nev}, anyja neve: {elado_anyja_neve}, született: {elado_szuletes}, lakcím: {elado_lakcim}, személyi okmány: {elado_okmany}

## Vevő
**{vevo_nev}** – születési név: {vevo_szuletesi_nev}, anyja neve: {vevo_anyja_neve}, született: {vevo_szuletes}, lakcím: {vevo_lakcim}, személyi okmány: {vevo_okmany}

## Az ingatlan
- **Cím:** {ingatlan_cim}
- **Helyrajzi szám:** {helyrajzi_szam}
- **Megnevezés:** {ingatlan_jelleg}, {alapterulet} m²
- **Az Eladó tulajdoni hányada:** {tulajdoni_hanyad}
- **Terhek:** {terhek}

## Vételár és fizetés
- **Vételár:** {vetelar_szoveg}
- **Megfizetett foglaló:** {foglalo_szoveg}
- **Fizetés módja:** {fizetesi_mod}

## Birtokbaadás
{birtokbaadas}

## Egyéb egyeztetett feltételek
[[AI: sorold fel röviden, tárgyszerűen az ügylet jegyzeteiből és ajánlataiból kiderülő megállapodásokat, amelyeket az ügyvédnek a szerződésbe kell foglalnia. Ne találj ki semmit; ha nincs ilyen, írd: „Nincs további egyeztetett feltétel.”]]

## Közvetítő
{iroda_nev} ({iroda_szekhely}, {iroda_cegjegyzekszam}), ügyintéző: {ugynok_nev}, {ugynok_telefon}

Kelt: {kelt_helyseg}, {datum}

${DRAFT_NOTE}`,
  },

  berleti: {
    label: "Lakásbérleti szerződés",
    short: "Bérbeadó és bérlő között, kaucióval és bérleti díjjal.",
    from: "deal",
    fields: [
      ...party("elado", "Bérbeadó"),
      ...party("vevo", "Bérlő"),
      ...property,
      { key: "berleti_dij", label: "Havi bérleti díj", group: "Pénzügyek", required: true },
      { key: "kaucio", label: "Kaució", group: "Pénzügyek", required: true },
      { key: "berlet_kezdete", label: "A bérlet kezdete", group: "Egyéb", required: true },
      { key: "berlet_idotartam", label: "A bérlet időtartama", group: "Egyéb", required: true, hint: "Pl. 1 év, vagy határozatlan" },
      { key: "rezsi", label: "Rezsi fizetése", group: "Pénzügyek", hint: "Pl. a közüzemi díjakat a Bérlő fizeti" },
      ...office,
      ...signing,
    ],
    body: `# Lakásbérleti szerződés

amely létrejött egyrészről **{elado_nev}** (anyja neve: {elado_anyja_neve}, született: {elado_szuletes}, lakcím: {elado_lakcim}, személyi okmány: {elado_okmany}) mint **Bérbeadó**,

másrészről **{vevo_nev}** (anyja neve: {vevo_anyja_neve}, született: {vevo_szuletes}, lakcím: {vevo_lakcim}, személyi okmány: {vevo_okmany}) mint **Bérlő**

között az alábbi feltételekkel:

## 1. A bérlemény
- **Cím:** {ingatlan_cim}, helyrajzi szám: {helyrajzi_szam}
- **Megnevezés:** {ingatlan_jelleg}, {alapterulet} m²

## 2. A bérlet ideje
A bérlet **{berlet_kezdete}** napjával kezdődik, időtartama: **{berlet_idotartam}**.

## 3. Bérleti díj és kaució
- **Havi bérleti díj:** {berleti_dij_szoveg}, minden hónap 5. napjáig előre fizetendő.
- **Kaució:** {kaucio_szoveg}, amelyet a Bérbeadó a bérlet végén – az esetleges tartozások és károk levonásával – visszafizet.
- **Rezsi:** {rezsi}

## 4. A felek jogai és kötelezettségei
A Bérlő a lakást rendeltetésszerűen használja, albérletbe a Bérbeadó írásbeli hozzájárulása nélkül nem adja. A Bérbeadó a lakás rendeltetésszerű használatra alkalmas állapotáról gondoskodik. A lakás átadásakor a felek átadás-átvételi jegyzőkönyvet vesznek fel.

[[AI: ha a jegyzetekből vagy ajánlatokból kiderül különleges megállapodás (háziállat, bútorozottság, felmondási idő), foglald össze egy rövid bekezdésben; ha nincs, írd: „A felek további különleges feltételt nem kötöttek ki.”]]

## 5. Záró rendelkezések
A szerződésben nem szabályozott kérdésekben a Polgári Törvénykönyv és a lakások bérletére vonatkozó szabályok az irányadók.
${signatures("Bérbeadó", "Bérlő")}

${DRAFT_NOTE}`,
  },

  atadas: {
    label: "Birtokbaadási jegyzőkönyv",
    short: "Az ingatlan átadása: mérőóra-állások, kulcsok, állapot.",
    from: "deal",
    fields: [
      { key: "elado_nev", label: "Átadó neve", group: "Felek", required: true },
      { key: "vevo_nev", label: "Átvevő neve", group: "Felek", required: true },
      { key: "ingatlan_cim", label: "Az ingatlan címe", group: "Ingatlan", required: true },
      { key: "helyrajzi_szam", label: "Helyrajzi szám", group: "Ingatlan" },
      { key: "villany_ora", label: "Villanyóra állása (kWh)", group: "Egyéb", required: true },
      { key: "gaz_ora", label: "Gázóra állása (m³)", group: "Egyéb" },
      { key: "viz_ora", label: "Vízóra állása (m³)", group: "Egyéb", required: true },
      { key: "kulcsok", label: "Átadott kulcsok", group: "Egyéb", required: true, hint: "Pl. 3 db bejárati, 2 db kapu" },
      { key: "allapot", label: "Állapot, észrevételek", group: "Egyéb" },
      ...signing,
    ],
    body: `# Birtokbaadási jegyzőkönyv

Készült **{datum}** napján, {kelt_helyseg} helyszínen, az alábbi ingatlan birtokbaadásáról:

- **Cím:** {ingatlan_cim}
- **Helyrajzi szám:** {helyrajzi_szam}

**Átadó:** {elado_nev}
**Átvevő:** {vevo_nev}

## Mérőórák állása
- **Villany:** {villany_ora} kWh
- **Gáz:** {gaz_ora} m³
- **Víz:** {viz_ora} m³

## Átadott kulcsok
{kulcsok}

## Az ingatlan állapota
{allapot}

A felek a közüzemi szolgáltatók felé az átírást a fenti óraállásokkal kezdeményezik. Az Átvevő az ingatlant a fenti állapotban átvette.
${signatures("Átadó", "Átvevő")}`,
  },
};

export const CONTRACT_ORDER: ContractKind[] = ["megbizasi", "megtekintesi", "foglalasi", "adasveteli", "berleti", "atadas"];
export const isContractKind = (k: unknown): k is ContractKind => typeof k === "string" && k in CONTRACT_KINDS;

/** Which contracts fit a record: a listing (agency), a deal (the rest; lease only for rentals), a client with a listing (viewing). */
export function kindsFor(from: "deal" | "property" | "client", opts: { rent?: boolean } = {}): ContractKind[] {
  if (from === "property") return ["megbizasi", "megtekintesi"];
  if (from === "client") return ["megtekintesi"];
  return opts.rent ? ["berleti", "atadas"] : ["foglalasi", "adasveteli", "atadas"];
}

/** The fields still empty among the required ones. */
/** A field an office's own text adds (from the AI's reading of its contract, or typed by hand). */
export type CustomField = { key: string; label: string };

/** Every field any contract knows, for labelling the fields of an office's own text. */
export const FIELD_CATALOG: ContractField[] = (() => {
  const seen = new Map<string, ContractField>();
  for (const k of CONTRACT_ORDER) for (const f of CONTRACT_KINDS[k].fields) if (!seen.has(f.key)) seen.set(f.key, { ...f, required: false });
  return [...seen.values()];
})();

/** The {fields} a text uses ("vetelar_szoveg" counts as "vetelar"). */
export function bodyKeys(body: string): string[] {
  return [...new Set([...body.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1].replace(/_szoveg$/, "")))];
}

const humanize = (key: string) => {
  const s = key.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * The fields a draft asks for: the ones its text uses. The contract's own
 * fields keep their label, group and "required"; a field from another
 * contract is optional; a new one is labelled from the office's list.
 */
export function fieldsFor(kind: ContractKind, body: string, custom: CustomField[] = []): ContractField[] {
  const used = bodyKeys(body);
  const own = new Map(CONTRACT_KINDS[kind].fields.map((f) => [f.key, f]));
  const known = new Map(FIELD_CATALOG.map((f) => [f.key, f]));
  const labels = new Map(custom.map((c) => [c.key, c.label]));
  const inOrder = CONTRACT_KINDS[kind].fields.filter((f) => used.includes(f.key));
  const rest = used.filter((k) => !own.has(k)).map((key): ContractField => known.get(key) ?? { key, label: labels.get(key) || humanize(key), group: "Egyéb" });
  return [...inOrder, ...rest];
}

export function missingFields(kind: ContractKind, values: Record<string, string>, body: string = CONTRACT_KINDS[kind].body, custom: CustomField[] = []): ContractField[] {
  return fieldsFor(kind, body, custom).filter((f) => f.required && !values[f.key]?.trim());
}
