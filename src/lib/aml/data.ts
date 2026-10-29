import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { decryptToken, encryptToken } from "@/lib/mail/crypto";
import { db } from "@/lib/supabase/db";
import { companySchema, personSchema, retainUntil, type CompanyData, type IdentificationSummary, type PersonData } from "./identification";

// Client identifications: the data encrypted with the server's key (like
// mailbox passwords), the summary in the open for statuses and warnings.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Identification = IdentificationSummary & ({ kind: "person"; data: PersonData } | { kind: "company"; data: CompanyData }) & { updatedAt: string };

export async function getIdentification(user: CurrentUser, clientId: string): Promise<Identification | null> {
  if (!UUID.test(clientId)) return null;
  const supabase = await db();
  const { data } = await supabase
    .from("client_identifications")
    .select("kind, data_enc, pep, document_expires_on, verified_on, updated_at")
    .eq("client_id", clientId)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (!data) return null;
  let fields: unknown;
  try {
    fields = JSON.parse(decryptToken(data.data_enc));
  } catch {
    return null;
  }
  const base = { pep: data.pep, documentExpiresOn: data.document_expires_on, verifiedOn: data.verified_on, updatedAt: data.updated_at };
  return data.kind === "company" ? { ...base, kind: "company", data: fields as CompanyData } : { ...base, kind: "person", data: fields as PersonData };
}

/** The summaries of several clients (for warnings on a deal). */
export async function identificationSummaries(user: CurrentUser, clientIds: string[]): Promise<Map<string, IdentificationSummary>> {
  const ids = clientIds.filter((id) => UUID.test(id));
  if (!ids.length) return new Map();
  const supabase = await db();
  const { data } = await supabase.from("client_identifications").select("client_id, kind, pep, document_expires_on, verified_on").in("client_id", ids).eq("organization_id", user.organization.id);
  return new Map((data ?? []).map((r) => [r.client_id as string, { kind: r.kind, pep: r.pep, documentExpiresOn: r.document_expires_on, verifiedOn: r.verified_on }]));
}

export type SaveResult = { ok: true } | { ok: false; errors: Record<string, string> };

export async function saveIdentification(user: CurrentUser, clientId: string, kind: "person" | "company", input: Record<string, unknown>): Promise<SaveResult> {
  if (!UUID.test(clientId)) return { ok: false, errors: { form: "Ismeretlen ügyfél." } };
  const parsed = kind === "company" ? companySchema.safeParse(input) : personSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const d = parsed.data;
  const supabase = await db();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).eq("organization_id", user.organization.id).maybeSingle();
  if (!client) return { ok: false, errors: { form: "Ismeretlen ügyfél." } };
  const row = {
    organization_id: user.organization.id,
    client_id: clientId,
    kind,
    data_enc: encryptToken(JSON.stringify(d)),
    pep: d.pep === "yes",
    risk: d.pep === "yes" ? "high" : "normal",
    document_expires_on: "document_expires_on" in d && d.document_expires_on ? d.document_expires_on : null,
    verified_on: new Date().toISOString().slice(0, 10),
  };
  const { data: existing } = await supabase.from("client_identifications").select("id").eq("client_id", clientId).maybeSingle();
  const { error } = existing
    ? await supabase.from("client_identifications").update(row).eq("id", existing.id)
    : await supabase.from("client_identifications").insert(row);
  if (error) {
    console.error("identification save failed", error.code);
    return { ok: false, errors: { form: "A mentés nem sikerült. Próbáld újra." } };
  }
  return { ok: true };
}

/** Until when the client must be kept under the Pmt. (8 years from the identification or the last deal), or null without one. */
export async function retentionFor(user: CurrentUser, clientId: string): Promise<string | null> {
  const supabase = await db();
  const { data: ident } = await supabase.from("client_identifications").select("verified_on").eq("client_id", clientId).eq("organization_id", user.organization.id).maybeSingle();
  if (!ident) return null;
  const { data: deals } = await supabase
    .from("deals")
    .select("closed_at, updated_at")
    .eq("organization_id", user.organization.id)
    .or(`buyer_client_id.eq.${clientId},seller_client_id.eq.${clientId}`)
    .order("updated_at", { ascending: false })
    .limit(1);
  const last = deals?.[0] ? ((deals[0].closed_at as string | null) ?? (deals[0].updated_at as string)).slice(0, 10) : null;
  return retainUntil(ident.verified_on, last);
}
