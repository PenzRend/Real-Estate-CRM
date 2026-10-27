"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { AiError } from "@/lib/ai/extract";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import { insertTasks } from "@/lib/db/activity";
import { sendNewEmail } from "@/lib/mail/send";
import { getMailbox } from "@/lib/mail/sync";
import { draftOffer } from "@/lib/offers/draft";
import { ensureShare } from "@/lib/shares/data";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOLLOW_UP_DAYS = 2;

export type OfferPrep =
  | {
      ok: true;
      to: string;
      subject: string;
      body: string;
      link: string;
      clientName: string;
      propertyTitle: string;
      /** Gmail is connected; canSend: it may send from here. */
      mailbox: { email: string; canSend: boolean } | null;
    }
  | { ok: false; error: string };

async function names(propertyId: string, clientId: string) {
  const supabase = await createClient();
  const [{ data: property }, { data: client }] = await Promise.all([
    supabase.from("properties").select("title").eq("id", propertyId).maybeSingle(),
    supabase.from("clients").select("full_name, email").eq("id", clientId).maybeSingle(),
  ]);
  return { propertyTitle: property?.title ?? "ingatlan", clientName: client?.full_name ?? "ügyfél", clientEmail: client?.email ?? "" };
}

/** Makes sure the listing has a share link, and drafts the offer email for review. */
export async function prepareOfferAction(propertyId: string, clientId: string): Promise<OfferPrep> {
  if (!UUID.test(propertyId) || !UUID.test(clientId)) return { ok: false, error: "Ismeretlen ingatlan vagy ügyfél." };
  const user = await getCurrentUser();
  const limit = await aiLimitMessage(user);
  if (limit) return { ok: false, error: limit };
  try {
    const [share, n, mailbox] = await Promise.all([ensureShare(user, propertyId), names(propertyId, clientId), getMailbox(user)]);
    const draft = await draftOffer(user, propertyId, clientId, share.url, new Date());
    await logAiUsage(user, { status: "success", operation: "next_actions", model: draft.model, inputTokens: draft.inputTokens, outputTokens: draft.outputTokens });
    return {
      ok: true,
      to: n.clientEmail,
      subject: draft.subject,
      body: draft.body,
      link: share.url,
      clientName: n.clientName,
      propertyTitle: n.propertyTitle,
      mailbox: mailbox && mailbox.status !== "revoked" ? { email: mailbox.email_address, canSend: mailbox.can_send } : null,
    };
  } catch (error) {
    if (error instanceof AiError) {
      await logAiUsage(user, { status: "error", operation: "next_actions" });
      return { ok: false, error: error.userMessage };
    }
    throw error;
  }
}

/** The pair counts as offered: no longer suggested. */
async function markOffered(organizationId: string, propertyId: string, clientId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("property_client_matches")
    .upsert({ organization_id: organizationId, property_id: propertyId, client_id: clientId, status: "task_created" }, { onConflict: "property_id,client_id" });
  if (error) console.error("mark offered failed", error.code);
}

const sendSchema = z.object({ to: z.string().max(2000), subject: z.string().max(1000), body: z.string().max(20_000) });

/** Sends the reviewed offer from the agent's Gmail; logs it and sets a follow-up. */
export async function sendOfferAction(propertyId: string, clientId: string, input: unknown) {
  if (!UUID.test(propertyId) || !UUID.test(clientId)) return { ok: false as const, error: "Ismeretlen ingatlan vagy ügyfél." };
  const user = await getCurrentUser();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Hiányos levél." };
  const n = await names(propertyId, clientId);
  const r = await sendNewEmail(
    user,
    { ...parsed.data, clientId, propertyId, followUpDays: FOLLOW_UP_DAYS, taskTitle: `Ajánlat utánkövetése: ${n.propertyTitle} → ${n.clientName}` },
    new Date(),
  );
  if (r.ok) {
    await markOffered(user.organization.id, propertyId, clientId);
    refresh();
  }
  return r;
}

/** Sent outside the CRM (copied or opened in Gmail): keep the old "Ajánlani" task so it isn't forgotten. */
export async function offerTaskAction(propertyId: string, clientId: string) {
  if (!UUID.test(propertyId) || !UUID.test(clientId)) throw new Error("Invalid match ids");
  const user = await getCurrentUser();
  const n = await names(propertyId, clientId);
  await markOffered(user.organization.id, propertyId, clientId);
  await insertTasks(user, [
    { title: `Ajánlani: ${n.propertyTitle} → ${n.clientName}`, due_at: null, priority: "normal", client_id: clientId, property_id: propertyId, source: "ai_suggestion" },
  ]);
  refresh();
}
