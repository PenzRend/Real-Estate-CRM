import "server-only";
import { after } from "next/server";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth";
import { onEvent } from "@/lib/automation/events";
import { createDraft } from "@/lib/contracts/data";
import { CONTRACT_KINDS, CONTRACT_ORDER, type ContractKind } from "@/lib/contracts/kinds";
import { insertTasks, saveManualInteraction } from "@/lib/db/activity";
import { listDeals, moveDeal } from "@/lib/deals/data";
import { DEAL_STAGES, stageLabels, type DealStage } from "@/lib/deals/logic";
import { zonedLocalToUtc } from "@/lib/i18n/timezone";
import { decryptToken, encryptToken, isMailCryptoConfigured } from "@/lib/mail/crypto";
import { createClient } from "@/lib/supabase/server";
import { bookViewing } from "@/lib/viewings/data";
import type { SourceRegistry } from "./tools";

// What the assistant may do, not only read. Everything runs as the signed-in
// user (RLS) in their workspace, like the screens do.
//   - Inside Flavio and easy to undo: done at once (a task, a note, a
//     follow-up date, a client, a contract draft for review, an email put in
//     the outbox for approval, opening a page).
//   - Anything that reaches other people (booking a viewing can send the
//     office's automatic emails; moving a deal can too): the assistant only
//     prepares it, and the agent presses "Jóváhagyás" in the chat.
// Nothing is ever sent by the assistant itself.

export type Confirmation = { label: string; detail: string; token: string };
/** What the chat needs after the answer: a page to open, steps to confirm, and the refs of what was done (for an answer if the AI stops halfway). */
export type ActionOutcome = { navigate: string | null; confirmations: Confirmation[]; changed: boolean; done: string[] };
type Ctx = { user: CurrentUser; sources: SourceRegistry; now: Date; outcome: ActionOutcome };

const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "must be an id returned by another tool");
const LOCAL_DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const LOCAL_TIME = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "YYYY-MM-DDTHH:mm (Budapest)");
const kinds = CONTRACT_ORDER as [ContractKind, ...ContractKind[]];

/** What a client is looking for: the same fields as the client form's "Keresési igények". */
const needsShape = {
  budget_min_million_huf: z.number().positive().optional(),
  budget_max_million_huf: z.number().positive().optional(),
  locations: z.array(z.string().max(100)).max(10).optional().describe("Cities, districts or areas, e.g. ['Budapest XI. kerület', 'Budaörs']."),
  property_types: z.array(z.enum(["apartment", "house", "plot", "commercial", "other"])).max(5).optional(),
  min_rooms: z.number().min(0).max(50).optional(),
  min_area_sqm: z.number().min(0).max(100000).optional(),
  max_area_sqm: z.number().min(0).max(100000).optional(),
  move_by: LOCAL_DAY.optional().describe("When they want to move in / buy by."),
  other_requirements: z.string().max(1000).optional().describe("Other wishes in a few words: balcony, lift, parking, quiet street…"),
};

export const actionSchemas = {
  search_deals: z.object({
    query: z.string().max(100).optional().describe("Buyer's or seller's name, or the listing's title, address or reference number (e.g. TESZT-001), in base form."),
    status: z.enum(["open", "won", "lost"]).optional().describe("Leave out to search all, open ones first."),
  }),
  create_task: z.object({
    title: z.string().min(2).max(200).describe("Short, in Hungarian, starting with a verb: 'Visszahívni Kiss Annát'."),
    due: z.union([LOCAL_DAY, LOCAL_TIME]).optional().describe("Budapest date and time YYYY-MM-DDTHH:mm whenever the agent says a time ('10-re' → T10:00, 'délután 3' → T15:00); date only (YYYY-MM-DD, means 9:00) if no time was said. Days from the context's day table."),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    client_id: UUID.optional(),
    property_id: UUID.optional(),
  }),
  add_note: z.object({
    client_id: UUID,
    property_id: UUID.optional(),
    type: z.enum(["call", "email", "meeting", "viewing", "note", "other"]).default("note"),
    summary: z.string().min(2).max(2000).describe("What happened, in Hungarian, as the agent said it."),
    follow_up: LOCAL_DAY.optional().describe("Next follow-up day, if the agent gave one."),
  }),
  set_follow_up: z.object({ client_id: UUID, date: LOCAL_DAY }),
  create_client: z.object({
    full_name: z.string().min(2).max(200),
    client_type: z.enum(["buyer", "seller", "owner", "investor", "tenant", "other"]).default("buyer"),
    phone: z.string().max(40).optional(),
    email: z.string().email().max(200).optional(),
    ...needsShape,
    note: z.string().max(2000).optional().describe("Anything else the agent said about them."),
  }),
  update_client: z.object({
    client_id: UUID,
    phone: z.string().max(40).optional(),
    email: z.string().email().max(200).optional(),
    client_type: z.enum(["buyer", "seller", "owner", "investor", "tenant", "other"]).optional(),
    status: z.enum(["new_lead", "contacted", "qualified", "active", "negotiation", "converted", "lost"]).optional(),
    ...needsShape,
    add_locations: z.boolean().default(true).describe("true: add the locations to the ones already saved; false: replace them."),
  }),
  create_contract: z
    .object({
      kind: z.enum(kinds),
      deal_id: UUID.optional(),
      property_id: UUID.optional(),
      client_id: UUID.optional(),
    })
    .refine((v) => v.deal_id || v.property_id || v.client_id, "Give a deal_id, property_id or client_id."),
  draft_email: z.object({
    client_id: UUID,
    subject: z.string().min(2).max(300),
    body: z.string().min(2).max(10_000).describe("The whole email in Hungarian (formal 'Ön'), with greeting and the agent's name as signature."),
    property_id: UUID.optional(),
  }),
  book_viewing: z.object({
    client_id: UUID,
    property_id: UUID,
    start: LOCAL_TIME,
    duration_minutes: z.number().int().min(15).max(240).default(60),
  }),
  move_deal: z.object({ deal_id: UUID, stage: z.enum(DEAL_STAGES) }),
  open_page: z.object({
    href: z
      .string()
      .regex(/^\/(dashboard|clients|properties|deals|tasks|calendar|inbox|messages|documents|contracts|office|settings|assistant)(\/[\w\-/?=&.]*)?$/, "an in-app path such as /clients/<id>")
      .describe("A page from a tool result (its href) or a screen: /clients, /deals, /tasks, /calendar, /contracts, /documents, /inbox/automation…"),
  }),
} as const;

export type ActionName = keyof typeof actionSchemas;

export const actionDescriptions: Record<ActionName, string> = {
  search_deals: "Find deals (ügyletek) by buyer, seller or listing: stage, agreed price, deposit and dates. Needed before create_contract or move_deal for a deal.",
  create_task: "DOES IT: creates a task for the agent (optionally for a client or listing).",
  add_note: "DOES IT: logs a call, meeting, email or note on a client's timeline (like 'Rögzítés'), optionally with the next follow-up day.",
  set_follow_up: "DOES IT: sets when to contact a client next.",
  create_client: "DOES IT: adds a new client with what is known: contact details and what they are looking for. Search first with search_clients so you don't create a duplicate.",
  update_client: "DOES IT: saves new details about an existing client: phone, email, type, status, and what they are looking for (budget, locations, property types, rooms, size, move date, other wishes). Only the fields you pass change.",
  create_contract: `DOES IT: drafts a contract for the agent to review and approve (never final). Kinds: ${CONTRACT_ORDER.map((k) => `${k} = ${CONTRACT_KINDS[k].label}`).join("; ")}. foglalasi, adasveteli and atadas take a deal_id; megbizasi a property_id; megtekintesi a client_id and a property_id; berleti a deal_id.`,
  draft_email: "DOES IT: writes an email to a client and puts it in 'Kimenő levelek' for the agent to read and approve. It is NOT sent until the agent approves it there.",
  book_viewing: "PREPARES (the agent confirms with a button): a viewing for a client at a listing. Booking may send the office's automatic emails, so it waits for the agent.",
  move_deal: `PREPARES (the agent confirms with a button): moves a deal to a stage: ${DEAL_STAGES.map((s) => `${s} = ${stageLabels[s]}`).join(", ")}.`,
  open_page: "Opens a page for the agent (after the answer is shown). Use when the agent asks to open, show or go to something.",
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const millions = (n: number | undefined) => (n == null ? null : Math.round(n * 1_000_000));
const dueAt = (due: string | undefined) => (due ? zonedLocalToUtc(due.length === 10 ? `${due}T09:00` : due) : null);

async function clientName(user: CurrentUser, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("full_name, email").eq("id", id).eq("organization_id", user.organization.id).maybeSingle();
  return data;
}

async function propertyTitle(user: CurrentUser, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("properties").select("title").eq("id", id).eq("organization_id", user.organization.id).maybeSingle();
  return (data?.title as string | undefined) ?? null;
}

// --- Confirmations: the prepared step travels sealed to the browser and back. ---

const sealedSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("book_viewing"), args: actionSchemas.book_viewing }),
  z.object({ type: z.literal("move_deal"), args: actionSchemas.move_deal }),
]);
type Sealed = z.infer<typeof sealedSchema> & { user: string; org: string; exp: number };

function seal(user: CurrentUser, step: z.infer<typeof sealedSchema>, now: Date) {
  const payload: Sealed = { ...step, user: user.id, org: user.organization.id, exp: now.getTime() + 2 * 3600_000 };
  return encryptToken(JSON.stringify(payload));
}

/** The agent pressed "Jóváhagyás": run the prepared step, if it is theirs and still fresh. */
export async function runConfirmation(user: CurrentUser, token: string, now: Date): Promise<{ ok: true; message: string; href: string | null } | { ok: false; error: string }> {
  let raw: Sealed;
  try {
    raw = JSON.parse(decryptToken(token)) as Sealed;
  } catch {
    return { ok: false, error: "Ez a jóváhagyás már nem érvényes. Kérd újra az asszisztenstől." };
  }
  const step = sealedSchema.safeParse(raw);
  if (!step.success || raw.user !== user.id || raw.org !== user.organization.id || raw.exp < now.getTime()) return { ok: false, error: "Ez a jóváhagyás már nem érvényes. Kérd újra az asszisztenstől." };

  if (step.data.type === "book_viewing") {
    const a = step.data.args;
    const r = await bookViewing(
      user,
      { clientId: a.client_id, newClient: null, propertyId: a.property_id, start: a.start, durationMinutes: a.duration_minutes, location: null, notes: null, addToCalendar: true, inviteClient: false, emailId: null },
      now,
    );
    if (!r.ok) return r;
    after(() => onEvent(user, { type: "viewing_booked", viewingId: r.viewingId, clientId: r.clientId, propertyId: a.property_id, startsAt: r.startsAt }));
    return { ok: true, message: "Megtekintés lefoglalva.", href: "/calendar" };
  }
  const a = step.data.args;
  const r = await moveDeal(user, a.deal_id, a.stage);
  if (!r.ok) return { ok: false, error: r.error };
  if (a.stage === "handover") after(() => onEvent(user, { type: "deal_handover", dealId: a.deal_id }));
  if (a.stage === "closed") after(() => onEvent(user, { type: "deal_won", dealId: a.deal_id }));
  return { ok: true, message: `Ügylet áthelyezve: ${stageLabels[a.stage]}.`, href: `/deals/${a.deal_id}` };
}

// --- The tools ---

const statusLabels = { open: "folyamatban", won: "sikeresen lezárva", lost: "elveszett" } as const;

async function searchDeals(ctx: Ctx, a: z.infer<typeof actionSchemas.search_deals>) {
  const statuses = a.status ? [a.status] : (["open", "won", "lost"] as const);
  const deals = (await Promise.all(statuses.map(async (st) => (await listDeals(ctx.user, st)).map((d) => ({ ...d, statusKey: st }))))).flat();
  // The listing's reference number and address, which the deal list doesn't carry.
  const supabase = await createClient();
  const ids = [...new Set(deals.map((d) => d.property.id))];
  const { data: props } = ids.length
    ? await supabase.from("properties").select("id, reference_number, address, city, district").in("id", ids)
    : { data: [] as { id: string; reference_number: string | null; address: string | null; city: string | null; district: string | null }[] };
  const where = new Map((props ?? []).map((p) => [p.id as string, [p.reference_number, p.address, p.city, p.district].filter(Boolean).join(" ")]));
  const words = fold(a.query ?? "").split(/\s+/).filter(Boolean);
  const hits = deals.filter((d) => {
    const hay = fold([d.property.name, where.get(d.property.id), d.buyer?.name, d.seller?.name].filter(Boolean).join(" "));
    return words.every((w) => hay.includes(w));
  });
  return {
    deals: hits.slice(0, 15).map((d) => ({
      ref: ctx.sources.add("deal", d.id, `${d.property.name}${d.buyer ? ` – ${d.buyer.name}` : ""}`, `/deals/${d.id}`),
      deal_id: d.id,
      status: statusLabels[d.statusKey],
      stage: stageLabels[d.stage as DealStage] ?? d.stage,
      listing: d.property.name,
      property_id: d.property.id,
      buyer: d.buyer?.name ?? null,
      buyer_client_id: d.buyer?.id ?? null,
      seller: d.seller?.name ?? null,
      agreed_price_huf: d.agreed_price,
      deposit_huf: d.deposit_amount,
      handover_on: d.handover_on,
    })),
  };
}

async function createTask(ctx: Ctx, a: z.infer<typeof actionSchemas.create_task>) {
  await insertTasks(ctx.user, [{ title: a.title, due_at: dueAt(a.due), priority: a.priority, client_id: a.client_id ?? null, property_id: a.property_id ?? null, source: "manual" }]);
  ctx.outcome.changed = true;
  return { done: true, ref: ctx.sources.add("task", `new:${a.title}`, a.title, "/tasks") };
}

async function addNote(ctx: Ctx, a: z.infer<typeof actionSchemas.add_note>) {
  const client = await clientName(ctx.user, a.client_id);
  if (!client) return { error: "Unknown client." };
  await saveManualInteraction(ctx.user, {
    client_id: a.client_id,
    property_id: a.property_id ?? null,
    interaction_type: a.type,
    occurred_at: ctx.now.toISOString(),
    summary: a.summary,
    notes: null,
    outcome: null,
    next_follow_up_at: a.follow_up ? dueAt(a.follow_up) : null,
    task_title: null,
  });
  ctx.outcome.changed = true;
  return { done: true, ref: ctx.sources.add("client", a.client_id, client.full_name as string, `/clients/${a.client_id}`) };
}

async function setFollowUp(ctx: Ctx, a: z.infer<typeof actionSchemas.set_follow_up>) {
  const client = await clientName(ctx.user, a.client_id);
  if (!client) return { error: "Unknown client." };
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ next_follow_up_at: dueAt(a.date) }).eq("id", a.client_id).eq("organization_id", ctx.user.organization.id);
  if (error) return { error: "Could not save." };
  ctx.outcome.changed = true;
  return { done: true, ref: ctx.sources.add("client", a.client_id, client.full_name as string, `/clients/${a.client_id}`) };
}

async function createClientRecord(ctx: Ctx, a: z.infer<typeof actionSchemas.create_client>) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: ctx.user.organization.id,
      full_name: a.full_name.trim(),
      client_type: a.client_type,
      status: "new_lead",
      phone: a.phone ?? null,
      email: a.email ?? null,
      ...needsColumns(a),
      preferred_locations: a.locations ?? [],
      notes: a.note ?? null,
      lead_source: "AI-asszisztens",
      assigned_to: ctx.user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the client (check the budget: min must not exceed max)." };
  const id = data.id as string;
  after(() => onEvent(ctx.user, { type: "client_created", clientId: id }));
  ctx.outcome.changed = true;
  return { done: true, ref: ctx.sources.add("client", id, a.full_name, `/clients/${id}`) };
}

type Needs = { [K in keyof typeof needsShape]?: z.infer<(typeof needsShape)[K]> };

/** The needs the agent gave, as client columns; fields not given are left out (unchanged). */
function needsColumns(a: Needs) {
  const out: Record<string, unknown> = {};
  if (a.budget_min_million_huf != null) out.budget_min = millions(a.budget_min_million_huf);
  if (a.budget_max_million_huf != null) out.budget_max = millions(a.budget_max_million_huf);
  if (a.property_types?.length) out.preferred_property_types = a.property_types;
  if (a.min_rooms != null) out.min_rooms = a.min_rooms;
  if (a.min_area_sqm != null) out.min_area_sqm = a.min_area_sqm;
  if (a.max_area_sqm != null) out.max_area_sqm = a.max_area_sqm;
  if (a.move_by) out.desired_move_date = a.move_by;
  if (a.other_requirements) out.other_requirements = a.other_requirements;
  return out;
}

async function updateClientRecord(ctx: Ctx, a: z.infer<typeof actionSchemas.update_client>) {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("clients")
    .select("full_name, preferred_locations, other_requirements, budget_min, budget_max")
    .eq("id", a.client_id)
    .eq("organization_id", ctx.user.organization.id)
    .maybeSingle();
  if (!current) return { error: "Unknown client." };
  const changes: Record<string, unknown> = { ...needsColumns(a) };
  if (a.phone) changes.phone = a.phone;
  if (a.email) changes.email = a.email;
  if (a.client_type) changes.client_type = a.client_type;
  if (a.status) changes.status = a.status;
  if (a.locations?.length) {
    const before = (current.preferred_locations as string[] | null) ?? [];
    changes.preferred_locations = a.add_locations ? [...new Set([...before, ...a.locations])].slice(0, 20) : a.locations;
  }
  if (a.other_requirements && current.other_requirements && a.other_requirements !== current.other_requirements) {
    changes.other_requirements = `${current.other_requirements}; ${a.other_requirements}`.slice(0, 2000);
  }
  // A new maximum below the saved minimum (or the other way) replaces the stale end.
  const min = (changes.budget_min ?? current.budget_min) as number | null;
  const max = (changes.budget_max ?? current.budget_max) as number | null;
  if (min != null && max != null && Number(min) > Number(max)) {
    if ("budget_max" in changes) changes.budget_min = null;
    else changes.budget_max = null;
  }
  if (!Object.keys(changes).length) return { done: false, note: "Nothing to change." };
  const { error } = await supabase.from("clients").update(changes).eq("id", a.client_id).eq("organization_id", ctx.user.organization.id);
  if (error) return { error: "Could not save (check that the minimums are not above the maximums)." };
  ctx.outcome.changed = true;
  return { done: true, saved: Object.keys(changes), ref: ctx.sources.add("client", a.client_id, current.full_name as string, `/clients/${a.client_id}`) };
}

async function createContract(ctx: Ctx, a: z.infer<typeof actionSchemas.create_contract>) {
  const r = await createDraft(ctx.user, a.kind, { dealId: a.deal_id ?? null, propertyId: a.property_id ?? null, clientId: a.client_id ?? null });
  if (!r.ok) return { error: r.error };
  ctx.outcome.changed = true;
  return { done: true, note: "A draft to review; missing fields are marked on its page.", ref: ctx.sources.add("contract", r.id, CONTRACT_KINDS[a.kind].label, `/contracts/${r.id}`) };
}

async function draftEmail(ctx: Ctx, a: z.infer<typeof actionSchemas.draft_email>) {
  const client = await clientName(ctx.user, a.client_id);
  if (!client) return { error: "Unknown client." };
  if (!client.email) return { error: "This client has no email address in Flavio." };
  const supabase = await createClient();
  const { error } = await supabase.from("email_outbox").insert({
    organization_id: ctx.user.organization.id,
    user_id: ctx.user.id,
    client_id: a.client_id,
    property_id: a.property_id ?? null,
    event_key: `assistant:${crypto.randomUUID()}`,
    to_email: client.email,
    subject: a.subject,
    body: a.body,
    status: "awaiting_approval",
    scheduled_at: ctx.now.toISOString(),
  });
  if (error) return { error: "Could not save the email." };
  ctx.outcome.changed = true;
  return { done: true, sent: false, ref: ctx.sources.add("page", "outbox", "Kimenő levelek – jóváhagyásra vár", "/inbox/automation") };
}

async function prepareViewing(ctx: Ctx, a: z.infer<typeof actionSchemas.book_viewing>) {
  const [client, title] = await Promise.all([clientName(ctx.user, a.client_id), propertyTitle(ctx.user, a.property_id)]);
  if (!client || !title) return { error: "Unknown client or listing." };
  if (!isMailCryptoConfigured()) return { error: "Confirmations are not available on this server." };
  const when = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" }).format(new Date(zonedLocalToUtc(a.start) ?? a.start));
  ctx.outcome.confirmations.push({ label: "Megtekintés foglalása", detail: `${client.full_name} · ${title} · ${when}, ${a.duration_minutes} perc`, token: seal(ctx.user, { type: "book_viewing", args: a }, ctx.now) });
  return { prepared: true, waiting_for: "the agent's 'Jóváhagyás' button below the answer" };
}

async function prepareMove(ctx: Ctx, a: z.infer<typeof actionSchemas.move_deal>) {
  if (!isMailCryptoConfigured()) return { error: "Confirmations are not available on this server." };
  const deal = (await listDeals(ctx.user, "open")).find((d) => d.id === a.deal_id);
  if (!deal) return { error: "Unknown or closed deal." };
  ctx.outcome.confirmations.push({
    label: `Ügylet áthelyezése: ${stageLabels[a.stage]}`,
    detail: `${deal.property.name}${deal.buyer ? ` – ${deal.buyer.name}` : ""} · most: ${stageLabels[deal.stage as DealStage] ?? deal.stage}`,
    token: seal(ctx.user, { type: "move_deal", args: a }, ctx.now),
  });
  return { prepared: true, waiting_for: "the agent's 'Jóváhagyás' button below the answer" };
}

async function openPage(ctx: Ctx, a: z.infer<typeof actionSchemas.open_page>) {
  ctx.outcome.navigate = a.href;
  return { opening: a.href };
}

export const actionHandlers: { [K in ActionName]: (ctx: Ctx, args: z.infer<(typeof actionSchemas)[K]>) => Promise<unknown> } = {
  search_deals: searchDeals,
  create_task: createTask,
  add_note: addNote,
  set_follow_up: setFollowUp,
  create_client: createClientRecord,
  update_client: updateClientRecord,
  create_contract: createContract,
  draft_email: draftEmail,
  book_viewing: prepareViewing,
  move_deal: prepareMove,
  open_page: openPage,
};
