// Customer due diligence (ügyfél-átvilágítás) under the Hungarian AML act
// (2017. évi LIII. törvény, Pmt.): the data to record for a private person or
// a company, and whether a client's identification is in order. Pure.

import { z } from "zod";

// Optional fields may be left out of the form altogether (e.g. the PEP role when "Nem").
const text = (max: number) => z.string().trim().max(max).default("");
const required = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max);
const date = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Adj meg dátumot."), z.literal("")]).default("");

export const ID_DOCUMENTS = { id_card: "Személyazonosító igazolvány", passport: "Útlevél", driving_licence: "Kártya formátumú vezetői engedély" } as const;

export const personSchema = z.object({
  full_name: required(200, "Add meg a nevet."),
  birth_name: text(200),
  mother_name: required(200, "Add meg az anyja születési nevét."),
  birth_place: required(200, "Add meg a születési helyet."),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Add meg a születési dátumot."),
  nationality: required(100, "Add meg az állampolgárságot."),
  address: required(300, "Add meg a lakcímet."),
  document_type: z.enum(Object.keys(ID_DOCUMENTS) as [keyof typeof ID_DOCUMENTS, ...(keyof typeof ID_DOCUMENTS)[]]),
  document_number: required(50, "Add meg az okmány számát."),
  document_expires_on: date,
  address_card_number: text(50),
  pep: z.enum(["no", "yes"]),
  pep_role: text(300),
  source_of_funds: text(1000),
  purpose: required(300, "Add meg az üzleti kapcsolat célját."),
  notes: text(2000),
});
export type PersonData = z.infer<typeof personSchema>;

export const companySchema = z.object({
  company_name: required(300, "Add meg a cég nevét."),
  registration_number: required(50, "Add meg a cégjegyzékszámot."),
  tax_number: text(50),
  seat: required(300, "Add meg a székhelyet."),
  representative_name: required(200, "Add meg a képviselő nevét."),
  representative_document: text(100),
  beneficial_owners: required(2000, "Add meg a tényleges tulajdonos(oka)t: név, születési idő, lakcím, tulajdoni hányad."),
  pep: z.enum(["no", "yes"]),
  pep_role: text(300),
  source_of_funds: text(1000),
  purpose: required(300, "Add meg az üzleti kapcsolat célját."),
  notes: text(2000),
});
export type CompanyData = z.infer<typeof companySchema>;

export type IdentificationSummary = { kind: "person" | "company"; pep: boolean; documentExpiresOn: string | null; verifiedOn: string };

export type IdentificationStatus = { state: "missing" | "ok" | "expiring" | "expired"; label: string };

/** Whether a client's identification is in order today: missing, done, or its ID document expired (or expires within 60 days). */
export function identificationStatus(s: IdentificationSummary | null, today: string): IdentificationStatus {
  if (!s) return { state: "missing", label: "Nincs azonosítva" };
  if (s.documentExpiresOn && s.documentExpiresOn < today) return { state: "expired", label: "Lejárt okmány – frissítsd" };
  if (s.documentExpiresOn) {
    const soon = new Date(`${today}T00:00:00Z`);
    soon.setUTCDate(soon.getUTCDate() + 60);
    if (s.documentExpiresOn <= soon.toISOString().slice(0, 10)) return { state: "expiring", label: "Az okmány hamarosan lejár" };
  }
  return { state: "ok", label: `Azonosítva${s.pep ? " · kiemelt közszereplő" : ""}` };
}

/** The Pmt.'s 8 years: until this day the identification (and so the client) must be kept. */
export function retainUntil(verifiedOn: string, lastBusinessOn: string | null): string {
  const from = lastBusinessOn && lastBusinessOn > verifiedOn ? lastBusinessOn : verifiedOn;
  const d = new Date(`${from.slice(0, 10)}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 8);
  return d.toISOString().slice(0, 10);
}
