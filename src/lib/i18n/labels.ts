// Hungarian UI labels for the enumerations defined in the database schema.
// Keys must match the check constraints in supabase/migrations.

export const clientTypeLabels = {
  buyer: "Vevő",
  seller: "Eladó",
  owner: "Tulajdonos",
  investor: "Befektető",
  tenant: "Bérlő",
  other: "Egyéb",
} as const;

export const clientStatusLabels = {
  new_lead: "Új érdeklődő",
  contacted: "Megkeresve",
  qualified: "Minősítve",
  active: "Aktív",
  negotiation: "Tárgyalás",
  converted: "Lezárva",
  lost: "Elveszett",
  archived: "Archivált",
} as const;

export const propertyTypeLabels = {
  apartment: "Lakás",
  house: "Ház",
  plot: "Telek",
  commercial: "Üzlethelyiség",
  other: "Egyéb",
} as const;

export const propertyStatusLabels = {
  draft: "Piszkozat",
  active: "Aktív",
  reserved: "Foglalt",
  under_negotiation: "Tárgyalás alatt",
  sold: "Eladva",
  rented: "Kiadva",
  inactive: "Inaktív",
} as const;

export const listingTypeLabels = {
  sale: "Eladó",
  rent: "Kiadó",
} as const;

export const currencyLabels = {
  HUF: "Ft",
  EUR: "EUR",
} as const;

export const interactionTypeLabels = {
  call: "Telefonhívás",
  email: "E-mail",
  meeting: "Találkozó",
  viewing: "Megtekintés",
  note: "Jegyzet",
  other: "Egyéb",
} as const;

export const taskStatusLabels = {
  todo: "Teendő",
  in_progress: "Folyamatban",
  completed: "Kész",
  cancelled: "Törölve",
} as const;

export const taskPriorityLabels = {
  low: "Alacsony",
  normal: "Normál",
  high: "Magas",
  urgent: "Sürgős",
} as const;

export type ClientStatus = keyof typeof clientStatusLabels;
export type PropertyStatus = keyof typeof propertyStatusLabels;
export type TaskPriority = keyof typeof taskPriorityLabels;
export type InteractionType = keyof typeof interactionTypeLabels;
