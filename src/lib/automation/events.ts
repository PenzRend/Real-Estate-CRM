import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createDraft } from "@/lib/contracts/data";
import { enqueueForEvent } from "@/lib/email-auto/outbox";
import { runAutomaticTemplates } from "@/lib/office-docs/templates";
import { db } from "@/lib/supabase/db";

// One place for what happens by itself after something happens in Flavio:
// contract drafts to review, documents from templates, emails to send.
// Called after the response (next/server after()), so saving stays fast;
// a failure is logged and never undoes the agent's action.

export type FlavioEvent =
  | { type: "client_created"; clientId: string }
  | { type: "listing_created"; propertyId: string }
  | { type: "viewing_booked"; viewingId: string; clientId: string; propertyId: string; startsAt: string }
  | { type: "viewing_completed"; viewingId: string; clientId: string; propertyId: string; feedback: string | null }
  | { type: "deal_created"; dealId: string }
  | { type: "deal_won"; dealId: string }
  | { type: "deal_handover"; dealId: string };

const safely = async (what: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    console.error(`automation ${what} failed`, e instanceof Error ? e.message : e);
  }
};

async function dealInfo(user: CurrentUser, dealId: string) {
  const supabase = await db();
  const { data } = await supabase.from("deals").select("buyer_client_id, property_id").eq("id", dealId).eq("organization_id", user.organization.id).maybeSingle();
  if (!data) return null;
  const { data: p } = await supabase.from("properties").select("listing_type").eq("id", data.property_id).maybeSingle();
  return { buyerId: data.buyer_client_id as string | null, propertyId: data.property_id as string, rent: p?.listing_type === "rent" };
}

export async function onEvent(user: CurrentUser, e: FlavioEvent) {
  switch (e.type) {
    case "client_created":
      await safely("templates", () => runAutomaticTemplates(user, "client_created", { kind: "client", id: e.clientId }));
      await safely("email", () => enqueueForEvent(user, "client_created", { clientId: e.clientId }, `client:${e.clientId}`));
      break;
    case "listing_created":
      await safely("contract", () => createDraft(user, "megbizasi", { propertyId: e.propertyId }, "auto"));
      break;
    case "viewing_booked":
      await safely("contract", () => createDraft(user, "megtekintesi", { clientId: e.clientId, propertyId: e.propertyId }, "auto"));
      await safely("email", () => enqueueForEvent(user, "viewing_booked", { clientId: e.clientId, propertyId: e.propertyId, viewingAt: e.startsAt }, `viewing:${e.viewingId}`));
      break;
    case "viewing_completed":
      await safely("email", () => enqueueForEvent(user, "viewing_completed", { clientId: e.clientId, propertyId: e.propertyId, feedback: e.feedback }, `viewing-done:${e.viewingId}`));
      break;
    case "deal_created": {
      const d = await dealInfo(user, e.dealId);
      await safely("contract", () => createDraft(user, d?.rent ? "berleti" : "foglalasi", { dealId: e.dealId }, "auto"));
      await safely("templates", () => runAutomaticTemplates(user, "deal_created", { kind: "deal", id: e.dealId }));
      if (d?.buyerId) await safely("email", () => enqueueForEvent(user, "deal_created", { clientId: d.buyerId!, dealId: e.dealId }, `deal:${e.dealId}`));
      break;
    }
    case "deal_won": {
      const d = await dealInfo(user, e.dealId);
      if (d?.buyerId) await safely("email", () => enqueueForEvent(user, "deal_won", { clientId: d.buyerId!, dealId: e.dealId }, `deal-won:${e.dealId}`));
      break;
    }
    case "deal_handover":
      await safely("contract", () => createDraft(user, "atadas", { dealId: e.dealId }, "auto"));
      break;
  }
}
