// The placeholders a Word template can use, e.g. "{vevo_nev}" or
// "{ingatlan_cim}". Pure, so it is tested; fill.ts loads the records and
// puts the values into the document. Unknown or empty fields become "".

export type FillRecords = {
  buyer: { full_name: string; phone: string | null; email: string | null } | null;
  seller: { full_name: string; phone: string | null; email: string | null } | null;
  property: {
    title: string;
    address: string | null;
    city: string | null;
    district: string | null;
    postal_code: string | null;
    price: number | null;
    area_sqm: number | null;
    room_count: number | null;
    reference_number: string | null;
  } | null;
  deal: { agreed_price: number | null; deposit_amount: number | null; deposit_due: string | null; contract_on: string | null; handover_on: string | null; commission: number | null } | null;
  agent: { name: string; email: string; phone?: string | null };
  office: string;
  today: string;
};

export const FIELD_HELP: { key: string; label: string }[] = [
  { key: "vevo_nev", label: "Vevő (vagy az ügyfél) neve" },
  { key: "vevo_telefon", label: "Vevő telefonszáma" },
  { key: "vevo_email", label: "Vevő e-mail-címe" },
  { key: "elado_nev", label: "Eladó (tulajdonos) neve" },
  { key: "elado_telefon", label: "Eladó telefonszáma" },
  { key: "ingatlan_cim", label: "Ingatlan teljes címe" },
  { key: "ingatlan_megnevezes", label: "Ingatlan hirdetési címe" },
  { key: "ingatlan_azonosito", label: "Saját azonosító" },
  { key: "ingatlan_ar", label: "Irányár" },
  { key: "alapterulet", label: "Alapterület (m²)" },
  { key: "szobak", label: "Szobák száma" },
  { key: "vetelar", label: "Megállapodott vételár" },
  { key: "foglalo", label: "Foglaló összege" },
  { key: "foglalo_hatarido", label: "Foglaló határideje" },
  { key: "szerzodes_datum", label: "Adásvételi dátuma" },
  { key: "birtokbaadas", label: "Birtokbaadás dátuma" },
  { key: "jutalek", label: "Jutalék" },
  { key: "ugynok_nev", label: "Az ingatlanos neve" },
  { key: "ugynok_email", label: "Az ingatlanos e-mail-címe" },
  { key: "iroda", label: "Az iroda neve" },
  { key: "datum", label: "A mai dátum" },
];

const money = (v: number | null | undefined) => (v == null ? "" : `${new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(Math.round(v)).replace(/ /g, " ")} Ft`);
const date = (v: string | null | undefined) => (v ? new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${v.slice(0, 10)}T00:00:00Z`)) : "");

export function templateValues(r: FillRecords): Record<string, string> {
  const p = r.property;
  const address = p ? [[p.postal_code, p.city].filter(Boolean).join(" "), p.district, p.address].filter(Boolean).join(", ") : "";
  return {
    vevo_nev: r.buyer?.full_name ?? "",
    vevo_telefon: r.buyer?.phone ?? "",
    vevo_email: r.buyer?.email ?? "",
    elado_nev: r.seller?.full_name ?? "",
    elado_telefon: r.seller?.phone ?? "",
    ingatlan_cim: address,
    ingatlan_megnevezes: p?.title ?? "",
    ingatlan_azonosito: p?.reference_number ?? "",
    ingatlan_ar: money(p?.price),
    alapterulet: p?.area_sqm == null ? "" : String(p.area_sqm).replace(".", ","),
    szobak: p?.room_count == null ? "" : String(p.room_count).replace(".", ","),
    vetelar: money(r.deal?.agreed_price),
    foglalo: money(r.deal?.deposit_amount),
    foglalo_hatarido: date(r.deal?.deposit_due),
    szerzodes_datum: date(r.deal?.contract_on),
    birtokbaadas: date(r.deal?.handover_on),
    jutalek: money(r.deal?.commission),
    ugynok_nev: r.agent.name,
    ugynok_email: r.agent.email,
    iroda: r.office,
    datum: date(r.today),
  };
}
