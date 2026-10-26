// What the AI extracts from a call note, voice memo or pasted text. Every field
// is required and nullable so the model must say "not mentioned" explicitly
// instead of guessing; post-processing drops anything malformed.
import { z } from "zod";

const clientTypes = ["buyer", "seller", "owner", "investor", "tenant", "other"] as const;
const propertyTypes = ["apartment", "house", "plot", "commercial", "other"] as const;
const interactionTypes = ["call", "email", "meeting", "viewing", "note", "other"] as const;

export const captureExtractionSchema = z.object({
  interaction_type: z.enum(interactionTypes),
  summary: z.string(),
  client: z.object({
    full_name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    client_type: z.enum(clientTypes).nullable(),
  }),
  requirements: z.object({
    budget_min: z.number().nullable(),
    budget_max: z.number().nullable(),
    budget_is_approximate: z.boolean(),
    locations: z.array(z.string()),
    property_types: z.array(z.enum(propertyTypes)),
    min_rooms: z.number().nullable(),
    min_bedrooms: z.number().nullable(),
    min_area_sqm: z.number().nullable(),
    max_area_sqm: z.number().nullable(),
    desired_move_date: z.string().nullable(),
    other: z.string().nullable(),
  }),
  important_dates: z.array(z.object({ date: z.string(), description: z.string() })),
  decisions: z.array(z.string()),
  open_questions: z.array(z.string()),
  promised_actions: z.array(z.string()),
  tasks: z.array(z.object({ title: z.string(), due_date: z.string().nullable(), due_time: z.string().nullable() })),
  follow_up_date: z.string().nullable(),
  follow_up_time: z.string().nullable(),
  outcome: z.string().nullable(),
});

export type CaptureExtraction = z.infer<typeof captureExtractionSchema>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const date = (v: string | null) => (v && DATE.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const time = (v: string | null) => (v && TIME.test(v) ? v : null);
const positive = (v: number | null) => (v != null && Number.isFinite(v) && v > 0 ? v : null);
const text = (v: string | null) => (v && v.trim() ? v.trim() : null);

/**
 * Normalizes a schema-valid extraction: drops malformed dates and numbers,
 * trims text, removes duplicates and fixes an inverted budget range.
 */
export function cleanExtraction(x: CaptureExtraction): CaptureExtraction {
  let { budget_min, budget_max } = x.requirements;
  budget_min = positive(budget_min);
  budget_max = positive(budget_max);
  if (budget_min != null && budget_max != null && budget_min > budget_max) [budget_min, budget_max] = [budget_max, budget_min];
  let { min_area_sqm, max_area_sqm } = x.requirements;
  min_area_sqm = positive(min_area_sqm);
  max_area_sqm = positive(max_area_sqm);
  if (min_area_sqm != null && max_area_sqm != null && min_area_sqm > max_area_sqm) [min_area_sqm, max_area_sqm] = [max_area_sqm, min_area_sqm];

  const strings = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];

  return {
    interaction_type: x.interaction_type,
    summary: x.summary.trim(),
    client: {
      full_name: text(x.client.full_name),
      phone: text(x.client.phone),
      email: text(x.client.email)?.toLowerCase() ?? null,
      client_type: x.client.client_type,
    },
    requirements: {
      budget_min,
      budget_max,
      budget_is_approximate: x.requirements.budget_is_approximate,
      locations: strings(x.requirements.locations),
      property_types: [...new Set(x.requirements.property_types)],
      min_rooms: positive(x.requirements.min_rooms),
      min_bedrooms: positive(x.requirements.min_bedrooms),
      min_area_sqm,
      max_area_sqm,
      desired_move_date: date(x.requirements.desired_move_date),
      other: text(x.requirements.other),
    },
    important_dates: x.important_dates
      .map((d) => ({ date: date(d.date), description: d.description.trim() }))
      .filter((d): d is { date: string; description: string } => d.date != null && d.description.length > 0),
    decisions: strings(x.decisions),
    open_questions: strings(x.open_questions),
    promised_actions: strings(x.promised_actions),
    tasks: x.tasks
      .map((t) => ({ title: t.title.trim(), due_date: date(t.due_date), due_time: date(t.due_date) ? time(t.due_time) : null }))
      .filter((t) => t.title.length > 0),
    follow_up_date: date(x.follow_up_date),
    follow_up_time: date(x.follow_up_date) ? time(x.follow_up_time) : null,
    outcome: text(x.outcome),
  };
}
