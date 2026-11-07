import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/db";

// Email rules: what to send, when, and whether it goes by itself or waits
// for the agent's OK. The text uses the document creator's fields ({vevo_nev},
// {keresztnev}, {ingatlan_cim}…) and may hold [[AI: …]] paragraphs.

export const EMAIL_TRIGGERS = ["manual", "client_created", "viewing_booked", "viewing_completed", "deal_created", "deal_won", "no_contact"] as const;
export type EmailTrigger = (typeof EMAIL_TRIGGERS)[number];
export const emailTriggerLabels: Record<EmailTrigger, string> = {
  manual: "Csak kézzel",
  client_created: "Új ügyfél érkezésekor",
  viewing_booked: "Megtekintés foglalásakor",
  viewing_completed: "Megtekintés után",
  deal_created: "Ügylet indulásakor",
  deal_won: "Sikeres lezáráskor",
  no_contact: "Ha egy ügyféllel régóta nem beszéltünk",
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger: EmailTrigger;
  delayMinutes: number;
  noContactDays: number | null;
  mode: "auto" | "approve";
  active: boolean;
  canEdit: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isTrigger = (t: unknown): t is EmailTrigger => (EMAIL_TRIGGERS as readonly string[]).includes(t as string);

export async function listEmailTemplates(user: CurrentUser): Promise<EmailTemplate[]> {
  const supabase = await db();
  const { data } = await supabase
    .from("email_templates")
    .select("id, name, subject, body, trigger, delay_minutes, no_contact_days, mode, active, created_by")
    .eq("organization_id", user.organization.id)
    .order("name");
  const manager = user.organization.role !== "member";
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    body: t.body,
    trigger: isTrigger(t.trigger) ? t.trigger : "manual",
    delayMinutes: t.delay_minutes,
    noContactDays: t.no_contact_days,
    mode: t.mode === "auto" ? "auto" : "approve",
    active: t.active,
    canEdit: manager || t.created_by === user.id,
  }));
}

export type EmailTemplateInput = { name: string; subject: string; body: string; trigger: string; delayMinutes: number; noContactDays: number | null; mode: string; active: boolean };

export async function saveEmailTemplate(user: CurrentUser, id: string | null, input: EmailTemplateInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Adj nevet a levélsablonnak." };
  if (!input.subject.trim()) return { ok: false, error: "Adj tárgyat a levélnek." };
  const trigger = isTrigger(input.trigger) ? input.trigger : "manual";
  const row = {
    name,
    subject: input.subject.trim().slice(0, 300),
    body: input.body.slice(0, 20_000),
    trigger,
    delay_minutes: Math.max(0, Math.min(43_200, Math.round(Number(input.delayMinutes) || 0))),
    no_contact_days: trigger === "no_contact" ? Math.max(1, Math.min(365, Math.round(Number(input.noContactDays) || 14))) : null,
    mode: input.mode === "auto" ? "auto" : "approve",
    active: Boolean(input.active),
  };
  const supabase = await db();
  if (id) {
    if (!UUID.test(id)) return { ok: false, error: "Ismeretlen sablon." };
    const { data, error } = await supabase.from("email_templates").update(row).eq("id", id).eq("organization_id", user.organization.id).select("id");
    if (error || !data?.length) return { ok: false, error: "Ezt a sablont a létrehozója vagy egy admin módosíthatja." };
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("email_templates").insert({ ...row, organization_id: user.organization.id }).select("id").single();
  if (error || !data) return { ok: false, error: "A sablont nem sikerült menteni." };
  return { ok: true, id: data.id };
}

export async function deleteEmailTemplate(user: CurrentUser, id: string) {
  if (!UUID.test(id)) return;
  const supabase = await db();
  await supabase.from("email_templates").delete().eq("id", id).eq("organization_id", user.organization.id);
}

/** Ready-made rules to start from (switched off, to look over first). */
export const EMAIL_STARTERS: Omit<EmailTemplateInput, "active">[] = [
  {
    name: "Üdvözlő levél új ügyfélnek",
    trigger: "client_created",
    delayMinutes: 10,
    noContactDays: null,
    mode: "approve",
    subject: "Köszönöm a megkeresését – {ugynok_nev}, {iroda}",
    body: `Kedves {keresztnev}!

Köszönöm, hogy megkeresett. [[AI: írj két mondatot arról, hogyan segítek neki: ha ismert, utalj a keresett területre vagy a keretre. Ne ígérj konkrét ingatlant.]]

Ha bármi kérdése van, hívjon nyugodtan, vagy válaszoljon erre a levélre.

Üdvözlettel,
{ugynok_nev}
{iroda}`,
  },
  {
    name: "Megtekintés visszaigazolása",
    trigger: "viewing_booked",
    delayMinutes: 0,
    noContactDays: null,
    mode: "auto",
    subject: "Megtekintés: {ingatlan_megnevezes}",
    body: `Kedves {keresztnev}!

Visszaigazolom a megtekintést: **{megtekintes_ideje}**, {ingatlan_cim}.

Ha közbejönne valami, kérem, jelezze. A megtekintés előtti napon emlékeztetőt is küldök.

Üdvözlettel,
{ugynok_nev}`,
  },
  {
    name: "Köszönet a megtekintés után",
    trigger: "viewing_completed",
    delayMinutes: 120,
    noContactDays: null,
    mode: "approve",
    subject: "Köszönöm, hogy megnézte – {ingatlan_megnevezes}",
    body: `Kedves {keresztnev}!

Köszönöm, hogy ma megnézte a(z) {ingatlan_megnevezes} ingatlant. [[AI: írj egy rövid, barátságos mondatot, amely a megtekintés visszajelzésére utal, ha van; különben kérdezd meg, milyen benyomása volt.]]

Ha további kérdése van, vagy szeretne még egyszer körülnézni, szívesen segítek.

Üdvözlettel,
{ugynok_nev}`,
  },
  {
    name: "Gratuláció sikeres vásárláshoz",
    trigger: "deal_won",
    delayMinutes: 60,
    noContactDays: null,
    mode: "approve",
    subject: "Gratulálok az új otthonához!",
    body: `Kedves {keresztnev}!

Szívből gratulálok! Öröm volt végigkísérni Önt a(z) {ingatlan_cim} megvásárlásában.

Ha elégedett volt a munkámmal, sokat segítene egy rövid ajánlás ismerőseinek – és ha a jövőben ingatlant adna el vagy venne, keressen bizalommal.

Üdvözlettel,
{ugynok_nev}
{iroda}`,
  },
  {
    name: "Utánkövetés, ha régen beszéltünk",
    trigger: "no_contact",
    delayMinutes: 0,
    noContactDays: 21,
    mode: "approve",
    subject: "Hogy áll a keresés?",
    body: `Kedves {keresztnev}!

Régen beszéltünk, ezért gondoltam, érdeklődöm: aktuális még a keresés? [[AI: írj egy rövid mondatot, amely a keresett ingatlanra utal, ha ismert.]]

Ha változott valami az elképzeléseiben, írjon nyugodtan – újra átnézem a kínálatot.

Üdvözlettel,
{ugynok_nev}`,
  },
];
