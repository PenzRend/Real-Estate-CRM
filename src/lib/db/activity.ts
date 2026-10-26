import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { startOfZonedDay } from "@/lib/i18n/timezone";
import type { InteractionType, TaskPriority } from "@/lib/i18n/labels";
import { searchTerm } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import type { Ref, TaskItem } from "@/lib/types/view-models";
import type { CaptureSave, ClientUpdates } from "@/lib/validation/activity";

export class SaveError extends Error {
  constructor(
    message: string,
    /** Safe to show to the user (Hungarian). */
    readonly userMessage: string,
  ) {
    super(message);
  }
}

const FAILED = "A mentés nem sikerült. Próbáld újra; ha a hiba megmarad, szólj nekünk.";

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export type Option = { id: string; name: string; detail?: string | null; reference?: string | null };

export async function listClientOptions(user: CurrentUser): Promise<Option[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, phone")
    .eq("organization_id", user.organization.id)
    .is("archived_at", null)
    .order("full_name")
    .limit(1000);
  if (error) throw new Error(`Failed to list clients: ${error.message}`);
  return (data ?? []).map((c) => ({ id: c.id, name: c.full_name, detail: c.phone }));
}

export async function listPropertyOptions(user: CurrentUser): Promise<Option[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, title, city, district, reference_number")
    .eq("organization_id", user.organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Failed to list properties: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.title,
    detail: [p.city, p.district].filter(Boolean).join(", ") || null,
    reference: p.reference_number,
  }));
}

/** The client's current values, shown next to what the AI extracted. */
export type ClientSnapshot = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_locations: string[];
  preferred_property_types: string[];
  min_rooms: number | null;
  min_bedrooms: number | null;
  min_area_sqm: number | null;
  max_area_sqm: number | null;
  desired_move_date: string | null;
  other_requirements: string | null;
  next_follow_up_at: string | null;
};

const SNAPSHOT_COLUMNS =
  "id, full_name, phone, email, budget_min, budget_max, preferred_locations, preferred_property_types, min_rooms, min_bedrooms, min_area_sqm, max_area_sqm, desired_move_date, other_requirements, next_follow_up_at";

const num = (v: unknown) => (v == null ? null : Number(v));
function toSnapshot(r: ClientSnapshot): ClientSnapshot {
  return {
    ...r,
    budget_min: num(r.budget_min),
    budget_max: num(r.budget_max),
    min_rooms: num(r.min_rooms),
    min_area_sqm: num(r.min_area_sqm),
    max_area_sqm: num(r.max_area_sqm),
    preferred_locations: r.preferred_locations ?? [],
    preferred_property_types: r.preferred_property_types ?? [],
  };
}

/**
 * Existing clients the note might be about: exact phone/email matches first,
 * then name matches. Limited to the user's workspace and active clients.
 */
export async function findClientCandidates(
  user: CurrentUser,
  hint: { full_name: string | null; phone: string | null; email: string | null },
  preferredId?: string | null,
): Promise<ClientSnapshot[]> {
  const supabase = await createClient();
  const base = () =>
    supabase.from("clients").select(SNAPSHOT_COLUMNS).eq("organization_id", user.organization.id).is("archived_at", null);

  const queries = [];
  if (preferredId) queries.push(base().eq("id", preferredId).limit(1));
  const digits = hint.phone?.replace(/\D/g, "") ?? "";
  // Match on the last 9 digits so "+36 30 …" and "06 30 …" find each other.
  if (digits.length >= 7) queries.push(base().like("phone_digits", `%${digits.slice(-9)}%`).limit(3));
  if (hint.email) queries.push(base().ilike("email", hint.email).limit(3));
  const name = hint.full_name ? searchTerm(hint.full_name) : "";
  if (name) {
    // Each word must appear: "Péter" finds "Kovács Péter"; "Kovács Péter" does not find "Nagy Péter".
    let q = base();
    for (const word of name.split(" ").filter((w) => w.length >= 2).slice(0, 4)) q = q.ilike("search_text", `%${word}%`);
    queries.push(q.order("updated_at", { ascending: false }).limit(5));
  }

  const results = await Promise.all(queries);
  const seen = new Map<string, ClientSnapshot>();
  for (const r of results) {
    if (r.error) throw new Error(`Failed to find clients: ${r.error.message}`);
    for (const row of (r.data ?? []) as ClientSnapshot[]) if (!seen.has(row.id)) seen.set(row.id, toSnapshot(row));
  }
  return [...seen.values()].slice(0, 6);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function assertInWorkspace(user: CurrentUser, table: "clients" | "properties", id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("organization_id", user.organization.id)
    .maybeSingle();
  if (error) throw new SaveError(`Lookup failed: ${error.code}`, FAILED);
  if (!data) {
    throw new SaveError(
      `${table} ${id} not in workspace`,
      table === "clients" ? "A kiválasztott ügyfél nem található." : "A kiválasztott ingatlan nem található.",
    );
  }
}

/** Moves last_contacted_at forward (never back) and optionally sets the next follow-up. */
async function touchClient(user: CurrentUser, clientId: string, occurredAt: string, nextFollowUpAt?: string | null) {
  const supabase = await createClient();
  const patch: Record<string, string | null> = {};
  const { data } = await supabase.from("clients").select("last_contacted_at").eq("id", clientId).maybeSingle();
  if (!data?.last_contacted_at || data.last_contacted_at < occurredAt) patch.last_contacted_at = occurredAt;
  if (nextFollowUpAt !== undefined) patch.next_follow_up_at = nextFollowUpAt;
  if (!Object.keys(patch).length) return;
  const { error } = await supabase.from("clients").update(patch).eq("id", clientId).eq("organization_id", user.organization.id);
  if (error) throw new SaveError(`Client update failed: ${error.code}`, FAILED);
}

export async function insertInteraction(
  user: CurrentUser,
  i: {
    client_id: string | null;
    property_id: string | null;
    interaction_type: InteractionType;
    occurred_at: string;
    summary: string;
    notes: string | null;
    outcome: string | null;
    follow_up_required: boolean;
    source: "manual" | "ai_assisted";
  },
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interactions")
    .insert({ ...i, organization_id: user.organization.id })
    .select("id")
    .single();
  if (error || !data) throw new SaveError(`Interaction insert failed: ${error?.code}`, FAILED);
  return data.id as string;
}

export async function insertTasks(
  user: CurrentUser,
  tasks: {
    title: string;
    description?: string | null;
    due_at: string | null;
    priority?: TaskPriority;
    client_id: string | null;
    property_id: string | null;
    interaction_id?: string | null;
    source: "manual" | "ai_suggestion";
  }[],
) {
  if (!tasks.length) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .insert(tasks.map((t) => ({ priority: "normal", ...t, organization_id: user.organization.id })));
  if (error) throw new SaveError(`Task insert failed: ${error.code}`, FAILED);
}

/** Manual interaction from the form. */
export async function saveManualInteraction(
  user: CurrentUser,
  input: {
    client_id: string | null;
    property_id: string | null;
    interaction_type: InteractionType;
    occurred_at: string;
    summary: string;
    notes: string | null;
    outcome: string | null;
    next_follow_up_at: string | null;
    task_title: string | null;
  },
) {
  if (input.client_id) await assertInWorkspace(user, "clients", input.client_id);
  if (input.property_id) await assertInWorkspace(user, "properties", input.property_id);

  const interactionId = await insertInteraction(user, {
    client_id: input.client_id,
    property_id: input.property_id,
    interaction_type: input.interaction_type,
    occurred_at: input.occurred_at,
    summary: input.summary,
    notes: input.notes,
    outcome: input.outcome,
    follow_up_required: Boolean(input.next_follow_up_at || input.task_title),
    source: "manual",
  });
  if (input.client_id) {
    await touchClient(user, input.client_id, input.occurred_at, input.next_follow_up_at ?? undefined);
  }
  if (input.task_title) {
    await insertTasks(user, [
      {
        title: input.task_title,
        due_at: input.next_follow_up_at,
        client_id: input.client_id,
        property_id: input.property_id,
        interaction_id: interactionId,
        source: "manual",
      },
    ]);
  }
  return { interactionId, clientId: input.client_id };
}

/**
 * Saves what the agent confirmed on the review screen. Only fields present in
 * `updates` are written to the client; nothing the agent unticked is changed.
 */
export async function saveCapture(user: CurrentUser, c: CaptureSave) {
  const supabase = await createClient();
  if (c.property_id) await assertInWorkspace(user, "properties", c.property_id);

  let clientId: string;
  const updates: ClientUpdates = c.updates;
  if (c.client.mode === "existing") {
    clientId = c.client.id;
    await assertInWorkspace(user, "clients", clientId);
    if (Object.keys(updates).length) {
      const { error } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", clientId)
        .eq("organization_id", user.organization.id);
      if (error) throw new SaveError(`Client update failed: ${error.code}`, FAILED);
    }
  } else {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        ...updates,
        full_name: c.client.full_name,
        client_type: c.client.client_type,
        status: "contacted",
        lead_source: "AI-rögzítés",
        organization_id: user.organization.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new SaveError(`Client insert failed: ${error?.code}`, FAILED);
    clientId = data.id;
  }

  const interactionId = await insertInteraction(user, {
    client_id: clientId,
    property_id: c.property_id,
    interaction_type: c.interaction_type,
    occurred_at: c.occurred_at,
    summary: c.summary,
    notes: c.transcript,
    outcome: c.outcome,
    follow_up_required: Boolean(c.next_follow_up_at || c.tasks.length),
    source: "ai_assisted",
  });
  await touchClient(user, clientId, c.occurred_at, c.next_follow_up_at ?? undefined);
  if (c.email_id) {
    // RLS limits this to the user's own imported emails.
    const { error } = await supabase
      .from("emails")
      .update({ status: "processed", interaction_id: interactionId, client_id: clientId })
      .eq("id", c.email_id)
      .eq("user_id", user.id);
    if (error) console.error("email status update failed", error.code);
  }
  await insertTasks(
    user,
    c.tasks.map((t) => ({
      title: t.title,
      due_at: t.due_at,
      client_id: clientId,
      property_id: c.property_id,
      interaction_id: interactionId,
      source: "ai_suggestion" as const,
    })),
  );
  return { clientId, interactionId };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskView = "today" | "overdue" | "upcoming" | "completed";
export type TaskListEntry = TaskItem & { status: string; completedAt: string | null; source: string };

export async function listTasks(user: CurrentUser, view: TaskView, now: Date): Promise<TaskListEntry[]> {
  const supabase = await createClient();
  const today = startOfZonedDay(now, user.timezone).toISOString();
  const tomorrow = startOfZonedDay(now, user.timezone, 1).toISOString();
  let q = supabase
    .from("tasks")
    .select("id, title, due_at, priority, status, completed_at, source, client_id, property_id")
    .eq("organization_id", user.organization.id);

  if (view === "completed") {
    q = q.eq("status", "completed").order("completed_at", { ascending: false });
  } else {
    q = q.in("status", ["todo", "in_progress"]);
    if (view === "today") q = q.gte("due_at", today).lt("due_at", tomorrow).order("due_at");
    if (view === "overdue") q = q.lt("due_at", today).order("due_at");
    // Upcoming also holds tasks without a date, after the dated ones.
    if (view === "upcoming") q = q.or(`due_at.gte.${tomorrow},due_at.is.null`).order("due_at", { nullsFirst: false });
  }
  const { data, error } = await q.limit(200);
  if (error) throw new Error(`Failed to list tasks: ${error.message}`);

  const clientIds = [...new Set((data ?? []).map((t) => t.client_id).filter(Boolean))] as string[];
  const propertyIds = [...new Set((data ?? []).map((t) => t.property_id).filter(Boolean))] as string[];
  const [clients, properties] = await Promise.all([
    clientIds.length ? supabase.from("clients").select("id, full_name").in("id", clientIds) : { data: [] as { id: string; full_name: string }[] },
    propertyIds.length ? supabase.from("properties").select("id, title").in("id", propertyIds) : { data: [] as { id: string; title: string }[] },
  ]);
  const clientRef = new Map((clients.data ?? []).map((c): [string, Ref] => [c.id, { id: c.id, name: c.full_name }]));
  const propertyRef = new Map((properties.data ?? []).map((p): [string, Ref] => [p.id, { id: p.id, name: p.title }]));

  return (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.due_at,
    priority: t.priority,
    status: t.status,
    completedAt: t.completed_at,
    source: t.source,
    client: t.client_id ? (clientRef.get(t.client_id) ?? null) : null,
    property: t.property_id ? (propertyRef.get(t.property_id) ?? null) : null,
  }));
}

export async function setTaskStatus(user: CurrentUser, id: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update(done ? { status: "completed", completed_at: new Date().toISOString() } : { status: "todo", completed_at: null })
    .eq("id", id)
    .eq("organization_id", user.organization.id);
  if (error) throw new SaveError(`Task status update failed: ${error.code}`, FAILED);
}
