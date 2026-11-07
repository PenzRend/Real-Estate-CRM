import "server-only";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { CurrentUser } from "@/lib/auth";
import { commission } from "@/lib/deals/logic";
import { DOCUMENTS_BUCKET } from "@/lib/documents/data";
import { utcToZonedLocal } from "@/lib/i18n/timezone";
import { createClient } from "@/lib/supabase/server";
import { templateValues, type FillRecords } from "./fields";

// "Kitöltés": a Word template from Dokumentumok, with {placeholders} filled
// from a deal (its buyer, seller and listing), or a client and/or a listing.
// The result is downloaded as a new .docx; the template is not changed.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: unknown) => (v == null ? null : Number(v));

export type FillChoice = { clientId?: string | null; propertyId?: string | null; dealId?: string | null };

async function records(user: CurrentUser, choice: FillChoice): Promise<FillRecords> {
  const supabase = await createClient();
  const org = user.organization.id;
  const client = async (id: string | null | undefined) => {
    if (!id || !UUID.test(id)) return null;
    const { data } = await supabase.from("clients").select("full_name, phone, email").eq("organization_id", org).eq("id", id).maybeSingle();
    return data ?? null;
  };
  let deal: FillRecords["deal"] = null;
  let buyerId = choice.clientId ?? null;
  let sellerId: string | null = null;
  let propertyId = choice.propertyId ?? null;
  if (choice.dealId && UUID.test(choice.dealId)) {
    const { data: d } = await supabase
      .from("deals")
      .select("property_id, buyer_client_id, seller_client_id, agreed_price, deposit_amount, deposit_due, contract_on, handover_on, commission_percent, commission_amount")
      .eq("organization_id", org)
      .eq("id", choice.dealId)
      .maybeSingle();
    if (d) {
      deal = {
        agreed_price: num(d.agreed_price),
        deposit_amount: num(d.deposit_amount),
        deposit_due: d.deposit_due,
        contract_on: d.contract_on,
        handover_on: d.handover_on,
        commission: commission({ agreed_price: num(d.agreed_price), commission_percent: num(d.commission_percent), commission_amount: num(d.commission_amount) }),
      };
      buyerId = d.buyer_client_id ?? buyerId;
      sellerId = d.seller_client_id;
      propertyId = d.property_id ?? propertyId;
    }
  }
  const { data: property } =
    propertyId && UUID.test(propertyId)
      ? await supabase
          .from("properties")
          .select("title, address, city, district, postal_code, price, area_sqm, room_count, reference_number, owner_client_id")
          .eq("organization_id", org)
          .eq("id", propertyId)
          .maybeSingle()
      : { data: null };
  const [buyer, seller] = await Promise.all([client(buyerId), client(sellerId ?? property?.owner_client_id)]);
  return {
    buyer,
    seller,
    property: property
      ? { ...property, price: num(property.price), area_sqm: num(property.area_sqm), room_count: num(property.room_count) }
      : null,
    deal,
    agent: { name: user.fullName ?? user.email, email: user.email },
    office: user.organization.name,
    today: utcToZonedLocal(new Date().toISOString()).slice(0, 10),
  };
}

export async function fillTemplate(user: CurrentUser, documentId: string, choice: FillChoice): Promise<{ ok: true; fileName: string; base64: string } | { ok: false; error: string }> {
  if (!UUID.test(documentId)) return { ok: false, error: "Ismeretlen sablon." };
  if (!choice.clientId && !choice.propertyId && !choice.dealId) return { ok: false, error: "Válassz ügyfelet, ingatlant vagy ügyletet." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("office_documents").select("title, file_name, storage_path").eq("organization_id", user.organization.id).eq("id", documentId).maybeSingle();
  if (!doc || !/\.docx$/i.test(doc.file_name)) return { ok: false, error: "Csak Word (.docx) sablon tölthető ki." };
  const { data: file } = await supabase.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
  if (!file) return { ok: false, error: "A sablont nem sikerült megnyitni." };
  const r = await records(user, choice);
  let out: Buffer;
  try {
    const doc_ = new Docxtemplater(new PizZip(Buffer.from(await file.arrayBuffer())), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
    doc_.render(templateValues(r));
    out = doc_.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  } catch (error) {
    console.error("template fill failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "A sablon nem tölthető ki: ellenőrizd, hogy a mezők {kapcsos zárójelben} vannak, pl. {vevo_nev}." };
  }
  const who = r.buyer?.full_name ?? r.property?.title ?? "kitöltve";
  const fileName = `${doc.title} – ${who}.docx`.replace(/[\\/:*?"<>|]+/g, " ");
  return { ok: true, fileName, base64: out.toString("base64") };
}
