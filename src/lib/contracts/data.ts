import "server-only";
import { z } from "zod";
import { llmConfig } from "@/lib/ai/config";
import { structuredCall } from "@/lib/ai/structured";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { getIdentification } from "@/lib/aml/data";
import { ID_DOCUMENTS } from "@/lib/aml/identification";
import type { CurrentUser } from "@/lib/auth";
import { DOCUMENTS_BUCKET } from "@/lib/documents/data";
import { propertyTypeLabels } from "@/lib/i18n/labels";
import { decryptToken, encryptToken, isMailCryptoConfigured } from "@/lib/mail/crypto";
import { linkDocument } from "@/lib/office-docs/links";
import { aiInstructions } from "@/lib/office-docs/template-render";
import { db } from "@/lib/supabase/db";
import { contractChecks, type Check } from "./checks";
import { CONTRACT_KINDS, fieldsFor, isContractKind, type ContractField, type ContractKind, type CustomField } from "./kinds";
import { contractDocx, contractHtml, contractText } from "./render";
import { officeTemplate } from "./templates";

// Contract drafts: values gathered from the deal, listing and clients (with
// the parties' details from their anti-money-laundering identification), the
// [[AI: …]] paragraphs written once when the draft is made, the agent's own
// additions stored encrypted, and approval into a Word file in Dokumentumok.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const longDate = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${v.slice(0, 10)}T00:00:00Z`)) : "";
const dateTime = (v: string) => new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" }).format(new Date(v));
const num = (v: unknown) => (v == null ? "" : String(Math.round(Number(v))));

// What an agent types once and is offered again on the next contract.
const REMEMBERED = ["iroda_szekhely", "iroda_cegjegyzekszam", "ugynok_telefon", "kelt_helyseg", "jutalek_szazalek", "megbizas_tipusa", "megbizas_idotartam"];
// Never sent to the AI.
const PERSONAL = /_(szuletesi_nev|anyja_neve|szuletes|lakcim|okmany)$/;

export type Refs = { dealId?: string | null; propertyId?: string | null; clientId?: string | null };

/** A party's contract details: from their identification when there is one, else what the client record has. */
async function partyValues(user: CurrentUser, who: "elado" | "vevo", clientId: string | null | undefined): Promise<Record<string, string>> {
  if (!clientId || !UUID.test(clientId)) return {};
  const supabase = await db();
  const [{ data: client }, ident] = await Promise.all([
    supabase.from("clients").select("full_name, phone, email").eq("id", clientId).eq("organization_id", user.organization.id).maybeSingle(),
    getIdentification(user, clientId).catch(() => null),
  ]);
  const out: Record<string, string> = { [`${who}_nev`]: client?.full_name ?? "", [`${who}_telefon`]: client?.phone ?? "" };
  if (ident?.kind === "person") {
    const d = ident.data;
    Object.assign(out, {
      [`${who}_nev`]: d.full_name,
      [`${who}_szuletesi_nev`]: d.birth_name || d.full_name,
      [`${who}_anyja_neve`]: d.mother_name,
      [`${who}_szuletes`]: `${d.birth_place}, ${longDate(d.birth_date)}`,
      [`${who}_lakcim`]: d.address,
      [`${who}_okmany`]: `${ID_DOCUMENTS[d.document_type]}, ${d.document_number}`,
    });
  } else if (ident?.kind === "company") {
    const d = ident.data;
    Object.assign(out, {
      [`${who}_nev`]: `${d.company_name} (cégjegyzékszám: ${d.registration_number}, képviseli: ${d.representative_name})`,
      [`${who}_szuletesi_nev`]: "–",
      [`${who}_anyja_neve`]: "–",
      [`${who}_szuletes`]: "–",
      [`${who}_lakcim`]: d.seat,
      [`${who}_okmany`]: d.representative_document || "–",
    });
  }
  return out;
}

/** The values the records give for a contract (the agent's additions go on top). */
export async function gatherValues(user: CurrentUser, kind: ContractKind, refs: Refs): Promise<{ values: Record<string, string>; context: string }> {
  const supabase = await db();
  const org = user.organization.id;
  let { propertyId, clientId } = refs;
  let sellerId: string | null = null;
  const values: Record<string, string> = {};
  const context: string[] = [];

  if (refs.dealId && UUID.test(refs.dealId)) {
    const { data: d } = await supabase
      .from("deals")
      .select("property_id, buyer_client_id, seller_client_id, agreed_price, deposit_amount, deposit_due, contract_on, handover_on, commission_percent, notes")
      .eq("id", refs.dealId)
      .eq("organization_id", org)
      .maybeSingle();
    if (d) {
      propertyId = d.property_id;
      clientId = d.buyer_client_id ?? clientId;
      sellerId = d.seller_client_id;
      Object.assign(values, {
        vetelar: num(d.agreed_price),
        foglalo: num(d.deposit_amount),
        foglalo_hatarido: longDate(d.deposit_due),
        szerzodes_datum: longDate(d.contract_on),
        birtokbaadas: longDate(d.handover_on),
        berleti_dij: num(d.agreed_price),
        kaucio: num(d.deposit_amount),
        berlet_kezdete: longDate(d.handover_on),
        jutalek_szazalek: d.commission_percent == null ? "" : String(d.commission_percent),
      });
      if (d.notes) context.push(`Az ügylet jegyzetei: ${d.notes}`);
      const { data: offers } = await supabase.from("deal_offers").select("amount, made_by, status, note").eq("deal_id", refs.dealId).eq("organization_id", org).order("made_on");
      for (const o of offers ?? []) context.push(`Ajánlat (${o.made_by === "buyer" ? "vevő" : "eladó"}, ${o.status}): ${num(o.amount)} Ft${o.note ? ` – ${o.note}` : ""}`);
    }
  }

  if (propertyId && UUID.test(propertyId)) {
    const { data: p } = await supabase
      .from("properties")
      .select("title, property_type, listing_type, address, city, district, postal_code, price, area_sqm, room_count, owner_client_id, description")
      .eq("id", propertyId)
      .eq("organization_id", org)
      .maybeSingle();
    if (p) {
      sellerId = sellerId ?? p.owner_client_id;
      Object.assign(values, {
        ingatlan_cim: [[p.postal_code, p.city].filter(Boolean).join(" "), p.district, p.address].filter(Boolean).join(", "),
        ingatlan_jelleg: propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]?.toLowerCase() ?? "",
        alapterulet: p.area_sqm == null ? "" : String(Number(p.area_sqm)).replace(".", ","),
        iranyar: num(p.price),
        kelt_helyseg: p.city ?? "",
      });
      if (!values.vetelar) values.vetelar = num(p.price);
      if (!values.berleti_dij && p.listing_type === "rent") values.berleti_dij = num(p.price);
      context.push(`Ingatlan: ${p.title}; ${values.ingatlan_jelleg}; ${values.alapterulet} m²; ${p.room_count ?? "?"} szoba; ${values.ingatlan_cim}.`);
      if (p.description) context.push(`Hirdetés: ${String(p.description).slice(0, 1500)}`);
    }
  }

  if (kind === "megtekintesi" && clientId && propertyId) {
    const { data: v } = await supabase
      .from("viewings")
      .select("starts_at")
      .eq("organization_id", org)
      .eq("client_id", clientId)
      .eq("property_id", propertyId)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (v) values.megtekintes_datum = dateTime(v.starts_at);
  }

  const [seller, buyer] = await Promise.all([partyValues(user, "elado", sellerId), partyValues(user, "vevo", clientId)]);
  Object.assign(values, seller, buyer);
  if (kind === "megbizasi" && !values.elado_nev && clientId) Object.assign(values, await partyValues(user, "elado", clientId));

  Object.assign(values, {
    iroda_nev: user.organization.name,
    ugynok_nev: user.fullName ?? user.email,
    datum: longDate(new Date().toISOString()),
  });
  if (!values.kelt_helyseg) values.kelt_helyseg = "Budapest";
  return { values, context: context.join("\n") };
}

/** What the agent typed into their last contract that is worth offering again (office details, usual terms). */
async function remembered(user: CurrentUser): Promise<Record<string, string>> {
  const supabase = await db();
  const { data } = await supabase
    .from("contract_drafts")
    .select("extra_enc")
    .eq("organization_id", user.organization.id)
    .eq("created_by", user.id)
    .not("extra_enc", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const extra = decryptExtra(data?.extra_enc ?? null);
  return Object.fromEntries(REMEMBERED.filter((k) => extra[k]).map((k) => [k, extra[k]]));
}

function decryptExtra(sealed: string | null): Record<string, string> {
  if (!sealed) return {};
  try {
    return JSON.parse(decryptToken(sealed)) as Record<string, string>;
  } catch {
    return {};
  }
}

const aiSchema = z.object({ paragraphs: z.array(z.string()) });

/** The draft's [[AI: …]] paragraphs, from non-personal facts only; without AI they stay as notes to fill in by hand. */
async function writeParagraphs(user: CurrentUser, body: string, values: Record<string, string>, context: string): Promise<string> {
  const instructions = aiInstructions(body);
  if (!instructions.length) return body;
  let texts: string[] | null = null;
  if (llmConfig() && !(await aiLimitMessage(user))) {
    const facts = Object.fromEntries(Object.entries(values).filter(([k, v]) => v && !PERSONAL.test(k)));
    try {
      const r = await structuredCall(
        aiSchema,
        "You draft parts of Hungarian real estate contracts for an agent to review. Write formal, precise Hungarian contract language. Use only the facts and notes given; never invent amounts, dates, names, conditions or promises. When the notes contain nothing for an instruction, use the fallback sentence it gives. Return one paragraph per instruction, in order, as plain text with no Markdown, no headings and no signature.",
        `Facts:\n${JSON.stringify(facts, null, 1)}\n\nNotes:\n${context || "(nincs)"}\n\nInstructions:\n${instructions.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
        { maxTokens: 2500, failMessage: "" },
      );
      await logAiUsage(user, { status: "success", operation: "assistant", model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
      texts = r.data.paragraphs;
    } catch {
      texts = null;
    }
  }
  let n = 0;
  return body.replace(/\[\[\s*AI\s*:\s*([\s\S]*?)\]\]/gi, (_, instruction: string) => {
    const t = texts?.[n++]?.trim();
    return t || `*[Kitöltendő: ${instruction.trim()}]*`;
  });
}

const titleFor = (kind: ContractKind, values: Record<string, string>) =>
  `${CONTRACT_KINDS[kind].label}${values.ingatlan_cim ? ` – ${values.ingatlan_cim}` : values.vevo_nev ? ` – ${values.vevo_nev}` : ""}`.slice(0, 300);

export async function createDraft(user: CurrentUser, kind: string, refs: Refs, origin: "manual" | "auto" = "manual"): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isContractKind(kind)) return { ok: false, error: "Ismeretlen szerződéstípus." };
  if (!isMailCryptoConfigured()) return { ok: false, error: "A szerződések titkosításához hiányzik a szerver kulcsa (MAIL_TOKEN_KEY)." };
  const clean = (v: string | null | undefined) => (v && UUID.test(v) ? v : null);
  const r = { dealId: clean(refs.dealId), propertyId: clean(refs.propertyId), clientId: clean(refs.clientId) };
  if (!r.dealId && !r.propertyId && !r.clientId) return { ok: false, error: "Válassz ügyletet, ingatlant vagy ügyfelet." };
  const { values, context } = await gatherValues(user, kind, r);
  const memory = await remembered(user);
  // The office's own wording when it has one, Flavio's otherwise.
  const own = await officeTemplate(user, kind);
  const body = await writeParagraphs(user, own?.body ?? CONTRACT_KINDS[kind].body, { ...memory, ...values }, context);
  const supabase = await db();
  // A deal's draft also belongs to its listing and buyer, so it shows on their pages.
  let propertyId = r.propertyId;
  let clientId = r.clientId;
  if (r.dealId) {
    const { data: d } = await supabase.from("deals").select("property_id, buyer_client_id").eq("id", r.dealId).eq("organization_id", user.organization.id).maybeSingle();
    propertyId = propertyId ?? d?.property_id ?? null;
    clientId = clientId ?? d?.buyer_client_id ?? null;
  }
  const { data, error } = await supabase
    .from("contract_drafts")
    .insert({
      organization_id: user.organization.id,
      created_by: user.id,
      kind,
      title: titleFor(kind, values),
      deal_id: r.dealId,
      property_id: propertyId,
      client_id: clientId,
      origin,
      body,
      extra_enc: Object.keys(memory).length ? encryptToken(JSON.stringify(memory)) : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("contract draft failed", error?.code);
    return { ok: false, error: "A tervezetet nem sikerült létrehozni." };
  }
  return { ok: true, id: data.id };
}

export type DraftView = {
  id: string;
  kind: ContractKind;
  label: string;
  title: string;
  status: "draft" | "approved";
  origin: "manual" | "auto";
  body: string;
  /** The records' values with the agent's additions on top. */
  values: Record<string, string>;
  /** What the agent typed (so the form shows what came from them). */
  extra: Record<string, string>;
  fields: ContractField[];
  /** Labels of the fields the office's own text adds. */
  customFields: CustomField[];
  missing: string[];
  checks: Check[];
  html: string;
  note: string | null;
  refs: { dealId: string | null; propertyId: string | null; clientId: string | null };
  documentId: string | null;
  updatedAt: string;
};

export async function getDraft(user: CurrentUser, id: string): Promise<DraftView | null> {
  if (!UUID.test(id)) return null;
  const supabase = await db();
  const { data: d } = await supabase
    .from("contract_drafts")
    .select("id, kind, title, status, origin, body, extra_enc, deal_id, property_id, client_id, document_id, updated_at")
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (!d || !isContractKind(d.kind)) return null;
  const kind = d.kind;
  const { values: base } = await gatherValues(user, kind, { dealId: d.deal_id, propertyId: d.deal_id ? null : d.property_id, clientId: d.deal_id ? null : d.client_id });
  const extra = decryptExtra(d.extra_enc);
  const values = { ...base, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v?.trim())) };
  const customFields = (await officeTemplate(user, kind))?.customFields ?? [];
  const fields = fieldsFor(kind, d.body, customFields);
  return {
    id: d.id,
    kind,
    label: CONTRACT_KINDS[kind].label,
    title: d.title,
    status: d.status,
    origin: d.origin,
    body: d.body,
    values,
    extra,
    fields,
    customFields,
    missing: fields.filter((f) => f.required && !values[f.key]?.trim()).map((f) => f.key),
    checks: contractChecks(kind, values),
    html: contractHtml(kind, d.body, values, customFields),
    note: CONTRACT_KINDS[kind].note ?? null,
    refs: { dealId: d.deal_id, propertyId: d.property_id, clientId: d.client_id },
    documentId: d.document_id,
    updatedAt: d.updated_at,
  };
}

/** The agent's edits: the text and the values they typed (kept encrypted). An approved draft goes back to draft. */
export async function saveDraft(user: CurrentUser, id: string, input: { body?: string; extra?: Record<string, string>; title?: string }) {
  if (!UUID.test(id)) return { ok: false as const, error: "Ismeretlen tervezet." };
  const patch: Record<string, unknown> = { status: "draft" };
  if (input.body != null) patch.body = input.body.slice(0, 200_000);
  if (input.title?.trim()) patch.title = input.title.trim().slice(0, 300);
  if (input.extra) {
    const clean = Object.fromEntries(
      Object.entries(input.extra)
        .filter(([k, v]) => /^[a-z_]{2,40}$/.test(k) && typeof v === "string")
        .map(([k, v]) => [k, v.slice(0, 2000)]),
    );
    patch.extra_enc = encryptToken(JSON.stringify(clean));
  }
  const supabase = await db();
  const { error } = await supabase.from("contract_drafts").update(patch).eq("id", id).eq("organization_id", user.organization.id);
  if (error) return { ok: false as const, error: "A mentés nem sikerült." };
  return { ok: true as const };
}

/** The contracts folder in Dokumentumok, made the first time. */
async function contractsFolder(user: CurrentUser): Promise<string | null> {
  const supabase = await db();
  const { data } = await supabase.from("office_document_folders").select("id").eq("organization_id", user.organization.id).eq("name", "Szerződések").maybeSingle();
  if (data) return data.id;
  const { data: made } = await supabase.from("office_document_folders").insert({ organization_id: user.organization.id, name: "Szerződések", created_by: user.id }).select("id").single();
  return made?.id ?? null;
}

/** Approval: every required field filled; the Word file goes into Dokumentumok → Szerződések, linked to the deal, listing and client. */
export async function approveDraft(user: CurrentUser, id: string): Promise<{ ok: true; documentId: string } | { ok: false; error: string }> {
  const draft = await getDraft(user, id);
  if (!draft) return { ok: false, error: "Ismeretlen tervezet." };
  if (draft.missing.length) return { ok: false, error: `Még hiányzik: ${draft.fields.filter((f) => draft.missing.includes(f.key)).map((f) => f.label).join(", ")}.` };
  if (draft.checks.some((c) => c.level === "error")) return { ok: false, error: "Előbb javítsd a pirossal jelölt hibát." };
  const docx = contractDocx(draft.kind, draft.body, draft.values, draft.customFields);
  const supabase = await db();
  const safe = draft.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .slice(0, 100);
  const path = `${user.organization.id}/office/${crypto.randomUUID()}-${safe}.docx`;
  const up = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, docx, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });
  if (up.error) return { ok: false, error: "A dokumentumot nem sikerült elmenteni." };
  const { data: doc, error } = await supabase
    .from("office_documents")
    .insert({
      organization_id: user.organization.id,
      folder_id: await contractsFolder(user),
      title: draft.title,
      storage_path: path,
      file_name: `${draft.title.replace(/[\\/:*?"<>|]+/g, " ")}.docx`,
      size_bytes: docx.length,
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    .select("id")
    .single();
  if (error || !doc) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    return { ok: false, error: "A dokumentumot nem sikerült elmenteni." };
  }
  if (draft.refs.dealId) await linkDocument(user, doc.id, "deal", draft.refs.dealId, "template");
  if (draft.refs.propertyId) await linkDocument(user, doc.id, "property", draft.refs.propertyId, "template");
  if (draft.refs.clientId) await linkDocument(user, doc.id, "client", draft.refs.clientId, "template");
  await supabase
    .from("contract_drafts")
    .update({ status: "approved", document_id: doc.id, approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", user.organization.id);
  return { ok: true, documentId: doc.id };
}

export async function deleteDraft(user: CurrentUser, id: string) {
  if (!UUID.test(id)) return;
  const supabase = await db();
  await supabase.from("contract_drafts").delete().eq("id", id).eq("organization_id", user.organization.id);
}

export type DraftListItem = { id: string; kind: ContractKind; label: string; title: string; status: "draft" | "approved"; origin: "manual" | "auto"; createdAt: string };

export async function listDrafts(user: CurrentUser, filter: Refs & { status?: "draft" | "approved" } = {}): Promise<DraftListItem[]> {
  const supabase = await db();
  let q = supabase.from("contract_drafts").select("id, kind, title, status, origin, created_at").eq("organization_id", user.organization.id);
  if (filter.dealId) q = q.eq("deal_id", filter.dealId);
  if (filter.propertyId) q = q.eq("property_id", filter.propertyId);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q.order("created_at", { ascending: false }).limit(100);
  return (data ?? []).filter((d) => isContractKind(d.kind)).map((d) => ({ id: d.id, kind: d.kind as ContractKind, label: CONTRACT_KINDS[d.kind as ContractKind].label, title: d.title, status: d.status, origin: d.origin, createdAt: d.created_at }));
}

const reviewSchema = z.object({ issues: z.array(z.object({ level: z.enum(["error", "warning", "ok"]), text: z.string() })) });

/** The AI reads the draft (personal details masked) and lists what looks wrong or missing. */
export async function aiReview(user: CurrentUser, id: string): Promise<{ ok: true; issues: Check[] } | { ok: false; error: string }> {
  const draft = await getDraft(user, id);
  if (!draft) return { ok: false, error: "Ismeretlen tervezet." };
  if (!llmConfig()) return { ok: false, error: "Az AI most nem érhető el." };
  const limit = await aiLimitMessage(user);
  if (limit) return { ok: false, error: limit };
  const masked = Object.fromEntries(Object.entries(draft.values).map(([k, v]) => [k, PERSONAL.test(k) && v ? "[megadva]" : v]));
  try {
    const r = await structuredCall(
      reviewSchema,
      "You review a Hungarian real estate contract draft prepared by an agent, as a careful colleague (not as a lawyer). List concrete problems: inconsistent amounts or dates, contradictions, missing essentials for this kind of contract under Hungarian practice (e.g. parcel number, ownership share, deposit terms, handover), unclear wording. Personal details are masked as [megadva]; do not flag them. Write each issue as one short Hungarian sentence. If everything looks fine, return one item with level ok. At most 8 items.",
      `Szerződés: ${draft.label}\n\nAdatok:\n${JSON.stringify(masked, null, 1)}\n\nSzöveg:\n${contractText(draft.kind, draft.body, masked, "final").slice(0, 20_000)}`,
      { maxTokens: 1500, failMessage: "" },
    );
    await logAiUsage(user, { status: "success", operation: "assistant", model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    return { ok: true, issues: r.data.issues.map((i) => ({ level: i.level === "error" ? "error" : "warning", text: i.level === "ok" ? `✓ ${i.text}` : i.text })) };
  } catch {
    return { ok: false, error: "Az AI-ellenőrzés most nem sikerült. Próbáld újra." };
  }
}
