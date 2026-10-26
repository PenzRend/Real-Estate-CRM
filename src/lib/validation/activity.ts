// Validation for interactions, tasks and the reviewed result of an AI capture.
// Shared by the client (form state) and the server (authoritative check).
import { z } from "zod";
import { zonedLocalToUtc } from "@/lib/i18n/timezone";
import {
  clientTypeLabels,
  interactionTypeLabels,
  propertyTypeLabels,
  taskPriorityLabels,
} from "@/lib/i18n/labels";
import { fieldErrors, keys, optionalText } from "./common";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const optionalId = z.preprocess(
  (v) => (typeof v === "string" && v ? v : null),
  z.string().regex(UUID, "Válassz a listából.").nullable(),
);

/** "2026-10-30T10:00" in Budapest → UTC ISO; empty → null. */
const localDateTime = (message = "Érvénytelen időpont.") =>
  z.preprocess(
    (v) => (typeof v === "string" && v ? (zonedLocalToUtc(v) ?? "invalid") : null),
    z.iso.datetime({ error: message }).nullable(),
  );

// ---------------------------------------------------------------------------
// Manual interaction
// ---------------------------------------------------------------------------

export const interactionFormSchema = z
  .object({
    client_id: optionalId,
    property_id: optionalId,
    interaction_type: z.enum(keys(interactionTypeLabels), { error: "Válassz típust." }),
    occurred_at: z.preprocess(
      (v) => (typeof v === "string" && v ? (zonedLocalToUtc(v) ?? "invalid") : "missing"),
      z.iso.datetime({ error: "Add meg az időpontot." }),
    ),
    summary: z.string().trim().min(1, "Írj egy rövid összefoglalót.").max(1000),
    notes: optionalText(20_000),
    outcome: optionalText(2000),
    next_follow_up_at: localDateTime(),
    task_title: optionalText(300),
  })
  .refine((v) => v.client_id || v.property_id, {
    path: ["client_id"],
    message: "Válassz ügyfelet vagy ingatlant.",
  });

export type InteractionInput = z.infer<typeof interactionFormSchema>;
export type InteractionFieldErrors = Partial<Record<keyof InteractionInput, string>>;

export function parseInteractionForm(formData: FormData) {
  const result = interactionFormSchema.safeParse(Object.fromEntries(formData.entries()));
  if (result.success) return { ok: true as const, data: result.data };
  return { ok: false as const, errors: fieldErrors<keyof InteractionInput>(result.error.issues) as InteractionFieldErrors };
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "Adj címet a feladatnak.").max(300),
  description: optionalText(5000),
  due_at: localDateTime(),
  priority: z.enum(keys(taskPriorityLabels), { error: "Válassz prioritást." }),
  client_id: optionalId,
  property_id: optionalId,
});

export type TaskInput = z.infer<typeof taskFormSchema>;
export type TaskFieldErrors = Partial<Record<keyof TaskInput, string>>;

export function parseTaskForm(formData: FormData) {
  const result = taskFormSchema.safeParse(Object.fromEntries(formData.entries()));
  if (result.success) return { ok: true as const, data: result.data };
  return { ok: false as const, errors: fieldErrors<keyof TaskInput>(result.error.issues) as TaskFieldErrors };
}

// ---------------------------------------------------------------------------
// Reviewed AI capture: what the agent confirmed on the review screen
// ---------------------------------------------------------------------------

const money = z.number().min(0).max(1e12);
const nullableText = (max: number) => z.string().trim().max(max).nullable();

/** Only the client fields the agent ticked are present; absent keys are left untouched. */
export const clientUpdatesSchema = z
  .object({
    budget_min: money.nullable(),
    budget_max: money.nullable(),
    preferred_locations: z.array(z.string().trim().min(1).max(100)).max(20),
    preferred_property_types: z.array(z.enum(keys(propertyTypeLabels))).max(5),
    min_rooms: z.number().min(0).max(50).nullable(),
    min_bedrooms: z.number().int().min(0).max(50).nullable(),
    min_area_sqm: z.number().min(0).max(100_000).nullable(),
    max_area_sqm: z.number().min(0).max(100_000).nullable(),
    desired_move_date: z.iso.date().nullable(),
    other_requirements: nullableText(2000),
    phone: z.string().trim().max(50).nullable(),
    email: z.email().max(320).nullable(),
  })
  .partial()
  .refine((u) => u.budget_min == null || u.budget_max == null || u.budget_min <= u.budget_max, {
    message: "A maximum költségkeret nem lehet kisebb a minimumnál.",
  });

export const captureSaveSchema = z.object({
  transcript: z.string().trim().min(1).max(20_000),
  interaction_type: z.enum(keys(interactionTypeLabels)),
  occurred_at: z.iso.datetime(),
  summary: z.string().trim().min(1, "Az összefoglaló nem lehet üres.").max(1000),
  outcome: nullableText(2000),
  property_id: z.string().regex(UUID).nullable(),
  client: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("existing"), id: z.string().regex(UUID) }),
    z.object({
      mode: z.literal("new"),
      full_name: z.string().trim().min(1, "Add meg az ügyfél nevét.").max(200),
      client_type: z.enum(keys(clientTypeLabels)),
    }),
  ]),
  updates: clientUpdatesSchema,
  next_follow_up_at: z.iso.datetime().nullable(),
  tasks: z
    .array(z.object({ title: z.string().trim().min(1).max(300), due_at: z.iso.datetime().nullable() }))
    .max(10),
});

export type CaptureSave = z.infer<typeof captureSaveSchema>;
export type ClientUpdates = z.infer<typeof clientUpdatesSchema>;

