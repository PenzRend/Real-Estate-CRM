// SYNTHETIC SAMPLE DATA — for the design preview only. Not real people or
// listings, and never used by the real CRM pages.
import type { ClientDetail, DashboardData, PropertyListItem } from "@/lib/types/view-models";

const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number, hour: number, minute = 0) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setUTCHours(hour - 1, minute, 0, 0); // ≈ Budapest local time (CET)
  return d.toISOString();
};

const peter = { id: "sample-client-1", name: "Minta Péter" };
const eszter = { id: "sample-client-2", name: "Minta Eszter" };
const gabor = { id: "sample-client-3", name: "Minta Gábor" };

export const sampleProperties: PropertyListItem[] = [
  {
    id: "sample-property-1",
    title: "Világos 2 hálós lakás erkéllyel",
    propertyType: "apartment",
    status: "active",
    city: "Budapest",
    district: "XI. kerület",
    price: 79_000_000,
    currency: "HUF",
    areaSqm: 64,
    roomCount: 3,
    createdAt: at(-1, 10),
  },
  {
    id: "sample-property-2",
    title: "Felújítandó családi ház nagy kerttel",
    propertyType: "house",
    status: "under_negotiation",
    city: "Budaörs",
    district: null,
    price: 124_500_000,
    currency: "HUF",
    areaSqm: 142,
    roomCount: 5,
    createdAt: at(-3, 14),
  },
  {
    id: "sample-property-3",
    title: "Újépítésű garzon, mélygarázzsal",
    propertyType: "apartment",
    status: "reserved",
    city: "Budapest",
    district: "XIII. kerület",
    price: 52_900_000,
    currency: "HUF",
    areaSqm: 34,
    roomCount: 1,
    createdAt: at(-6, 9),
  },
];

export const sampleDashboard: DashboardData = {
  userFirstName: "Anna",
  tasksToday: [
    { id: "t1", title: "Visszahívni: megfelelő ingatlanok küldése", dueAt: at(0, 10), priority: "high", client: peter, property: null },
    { id: "t2", title: "Megtekintés visszaigazolása", dueAt: at(0, 14, 30), priority: "normal", client: eszter, property: { id: "sample-property-1", name: "Világos 2 hálós lakás" } },
    { id: "t3", title: "Energetikai tanúsítvány bekérése a tulajdonostól", dueAt: at(0, 16), priority: "normal", client: gabor, property: null },
  ],
  overdue: [
    { id: "t4", title: "Ajánlat továbbítása a vevőnek", dueAt: at(-2, 11), priority: "urgent", client: eszter, property: { id: "sample-property-2", name: "Családi ház, Budaörs" } },
  ],
  activity: [
    { id: "a1", type: "call", occurredAt: at(0, 9, 15), summary: "2 hálós lakást keres a XI. kerületben, kb. 80 M Ft-ig, 3 hónapon belül költözne.", client: peter },
    { id: "a2", type: "viewing", occurredAt: at(-1, 17), summary: "Tetszett az elrendezés, a parkolás kérdéses. Párjával még egyszer megnézné.", client: eszter },
    { id: "a3", type: "email", occurredAt: at(-2, 8, 40), summary: "Elküldte az alaprajzot és a közös költség összegét.", client: gabor },
  ],
  recentProperties: sampleProperties,
  recentClients: [
    { id: peter.id, fullName: peter.name, phone: "+36 30 000 0001", email: null, clientType: "buyer", status: "active", budgetMin: 70_000_000, budgetMax: 85_000_000, preferredLocations: ["Budapest XI."], nextFollowUpAt: at(5, 10), updatedAt: at(0, 9) },
    { id: eszter.id, fullName: eszter.name, phone: null, email: "eszter@example.test", clientType: "buyer", status: "negotiation", budgetMin: null, budgetMax: 130_000_000, preferredLocations: ["Budaörs", "Budakeszi"], nextFollowUpAt: at(-2, 11), updatedAt: at(-1, 18) },
    { id: gabor.id, fullName: gabor.name, phone: "+36 20 000 0003", email: null, clientType: "seller", status: "qualified", budgetMin: null, budgetMax: null, preferredLocations: [], nextFollowUpAt: null, updatedAt: at(-2, 9) },
  ],
  suggestions: [
    { id: "s1", title: "Küldd el Péternek a XI. kerületi lakást", reason: "A legutóbbi hívásban megfelelő ingatlanokat kért, és az új hirdetés minden feltételének megfelel.", client: peter },
    { id: "s2", title: "Keresd meg Esztert az ajánlat ügyében", reason: "Az ajánlat továbbítása 2 napja lejárt, és azóta nincs rögzített kapcsolattartás.", client: eszter },
  ],
  counts: { activeClients: 24, activeProperties: 11 },
};

export const sampleClient: ClientDetail = {
  ...sampleDashboard.recentClients[0],
  lastContactedAt: at(0, 9, 15),
  notes: "Párjával együtt döntenek. Hétköznap 17 óra után érhető el.",
  createdAt: at(-20, 12),
  leadSource: "Ajánlás",
  requirements: {
    propertyTypes: ["apartment"],
    minRooms: 3,
    minBedrooms: 2,
    minAreaSqm: 55,
    maxAreaSqm: null,
    condition: null,
    desiredMoveDate: new Date(Date.now() + 90 * day).toISOString().slice(0, 10),
    other: "Erkély előny, földszint nem jó.",
  },
  aiSummary: {
    text: "Péter aktívan keres 2 hálószobás lakást a XI. kerületben, kb. 70–85 M Ft-os keretből, 3 hónapon belüli költözéssel. Eddig egy ingatlanról beszéltetek. A következő lépés: megfelelő ajánlatok küldése és visszahívás pénteken.",
    generatedAt: at(0, 9, 20),
  },
  interactions: [
    { id: "i1", type: "call", occurredAt: at(0, 9, 15), summary: "2 hálós lakást keres a XI. kerületben, kb. 80 M Ft-ig, 3 hónapon belül költözne.", outcome: "Megfelelő ingatlanokat küldök, pénteken visszahívom.", notes: null, client: peter, property: null },
    { id: "i2", type: "viewing", occurredAt: at(-6, 16), summary: "Megnézte a XIII. kerületi garzont — túl kicsi, de az elhelyezkedés tetszett.", outcome: null, notes: null, client: peter, property: { id: "sample-property-3", name: "Újépítésű garzon" } },
    { id: "i3", type: "note", occurredAt: at(-20, 12), summary: "Ajánlás alapján jelentkezett, első telefonos egyeztetés.", outcome: null, notes: null, client: peter, property: null },
  ],
  tasks: sampleDashboard.tasksToday.slice(0, 1),
  relatedProperties: [{ ...sampleProperties[0], relation: "interested" }],
};
