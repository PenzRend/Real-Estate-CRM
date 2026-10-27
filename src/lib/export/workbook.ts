import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/i18n/format";
import {
  clientStatusLabels,
  clientTypeLabels,
  interactionTypeLabels,
  listingTypeLabels,
  propertyStatusLabels,
  propertyTypeLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/i18n/labels";
import { createClient } from "@/lib/supabase/server";
import { outcomeLabels, statusLabels as viewingStatusLabels } from "@/lib/viewings/logic";
import { buildXlsx, type Cell, type Sheet } from "./xlsx";

type Row = Record<string, unknown>;

const PAGE = 1000;
// Excel's limit for one cell.
const MAX_CELL = 32_000;

/** Every row of one table in the workspace, page by page (the API returns at most 1000 at once). */
async function all(table: string, columns: string, organizationId: string, order: string): Promise<Row[]> {
  const supabase = await createClient();
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("organization_id", organizationId)
      .order(order)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`export ${table} failed: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

const label = (map: Record<string, string>, key: unknown) => (typeof key === "string" ? (map[key] ?? key) : null);
const num = (v: unknown): Cell => (v == null || v === "" ? null : Number(v));
const text = (v: unknown): Cell => (typeof v === "string" ? v.slice(0, MAX_CELL) : null);
const list = (v: unknown, map?: Record<string, string>): Cell => (Array.isArray(v) && v.length ? v.map((x) => (map ? (label(map, x) ?? x) : x)).join(", ") : null);
const yes = (v: unknown): Cell => (v === true ? "Igen" : null);

/** The workspace's records as an Excel workbook: one sheet per kind, labels in Hungarian. */
export async function exportWorkbook(user: CurrentUser): Promise<Uint8Array> {
  const org = user.organization.id;
  const tz = user.timezone;
  const dt = (v: unknown): Cell => (typeof v === "string" ? formatDateTime(v, tz) : null);
  const d = (v: unknown): Cell => (typeof v === "string" ? formatDate(v, tz) : null);

  const [clients, properties, tasks, interactions, viewings] = await Promise.all([
    all(
      "clients",
      "id, full_name, client_type, status, phone, email, budget_min, budget_max, budget_currency, preferred_locations, preferred_property_types, min_rooms, min_bedrooms, min_area_sqm, max_area_sqm, desired_move_date, other_requirements, notes, lead_source, last_contacted_at, next_follow_up_at, created_at, archived_at",
      org,
      "full_name",
    ),
    all(
      "properties",
      "id, title, reference_number, property_type, status, listing_type, price, currency, city, district, address, postal_code, area_sqm, room_count, bedroom_count, bathroom_count, floor, condition, has_balcony, has_garden, has_parking, energy_rating, owner_client_id, description, internal_notes, listing_source, created_at, archived_at",
      org,
      "title",
    ),
    all("tasks", "id, title, description, status, priority, due_at, completed_at, client_id, property_id, created_at", org, "created_at"),
    all("interactions", "id, interaction_type, occurred_at, client_id, property_id, summary, outcome, notes, source", org, "occurred_at"),
    all("viewings", "id, starts_at, duration_minutes, client_id, property_id, location, status, interest, feedback, notes", org, "starts_at"),
  ]);

  const clientName = new Map(clients.map((c) => [c.id, c.full_name as string]));
  const propertyName = new Map(properties.map((p) => [p.id, p.title as string]));
  const nameOf = (map: Map<unknown, string>, id: unknown): Cell => (id ? (map.get(id) ?? null) : null);

  const sheets: Sheet[] = [
    {
      name: "Ügyfelek",
      widths: [26, 14, 16, 16, 28, 14, 14, 9, 28, 20, 10, 12, 12, 12, 12, 30, 40, 16, 18, 20, 12, 12],
      rows: [
        [
          "Név",
          "Típus",
          "Állapot",
          "Telefon",
          "E-mail",
          "Keret min.",
          "Keret max.",
          "Pénznem",
          "Helyszínek",
          "Ingatlantípus",
          "Min. szoba",
          "Min. hálószoba",
          "Alapterület min. (m²)",
          "Alapterület max. (m²)",
          "Költözés",
          "Egyéb igények",
          "Megjegyzés",
          "Forrás",
          "Utolsó kapcsolat",
          "Következő utánkövetés",
          "Létrehozva",
          "Archiválva",
        ],
        ...clients.map((c) => [
          text(c.full_name),
          label(clientTypeLabels, c.client_type),
          label(clientStatusLabels, c.status),
          text(c.phone),
          text(c.email),
          num(c.budget_min),
          num(c.budget_max),
          text(c.budget_currency),
          list(c.preferred_locations),
          list(c.preferred_property_types, propertyTypeLabels),
          num(c.min_rooms),
          num(c.min_bedrooms),
          num(c.min_area_sqm),
          num(c.max_area_sqm),
          d(c.desired_move_date),
          text(c.other_requirements),
          text(c.notes),
          text(c.lead_source),
          dt(c.last_contacted_at),
          dt(c.next_follow_up_at),
          d(c.created_at),
          d(c.archived_at),
        ]),
      ],
    },
    {
      name: "Ingatlanok",
      widths: [36, 12, 12, 14, 10, 14, 9, 14, 14, 28, 10, 12, 8, 10, 10, 8, 16, 8, 8, 8, 10, 24, 50, 40, 30, 12, 12],
      rows: [
        [
          "Megnevezés",
          "Azonosító",
          "Típus",
          "Állapot",
          "Hirdetés",
          "Ár",
          "Pénznem",
          "Város",
          "Kerület",
          "Cím",
          "Irányítószám",
          "Alapterület (m²)",
          "Szobák",
          "Hálószobák",
          "Fürdőszobák",
          "Emelet",
          "Műszaki állapot",
          "Erkély",
          "Kert",
          "Parkolás",
          "Energetika",
          "Tulajdonos",
          "Leírás",
          "Belső megjegyzés",
          "Forrás",
          "Létrehozva",
          "Archiválva",
        ],
        ...properties.map((p) => [
          text(p.title),
          text(p.reference_number),
          label(propertyTypeLabels, p.property_type),
          label(propertyStatusLabels, p.status),
          label(listingTypeLabels, p.listing_type),
          num(p.price),
          text(p.currency),
          text(p.city),
          text(p.district),
          text(p.address),
          text(p.postal_code),
          num(p.area_sqm),
          num(p.room_count),
          num(p.bedroom_count),
          num(p.bathroom_count),
          text(p.floor),
          text(p.condition),
          yes(p.has_balcony),
          yes(p.has_garden),
          yes(p.has_parking),
          text(p.energy_rating),
          nameOf(clientName, p.owner_client_id),
          text(p.description),
          text(p.internal_notes),
          text(p.listing_source),
          d(p.created_at),
          d(p.archived_at),
        ]),
      ],
    },
    {
      name: "Feladatok",
      widths: [40, 40, 12, 12, 18, 24, 30, 18, 12],
      rows: [
        ["Feladat", "Leírás", "Állapot", "Prioritás", "Határidő", "Ügyfél", "Ingatlan", "Elvégezve", "Létrehozva"],
        ...tasks.map((t) => [
          text(t.title),
          text(t.description),
          label(taskStatusLabels, t.status),
          label(taskPriorityLabels, t.priority),
          dt(t.due_at),
          nameOf(clientName, t.client_id),
          nameOf(propertyName, t.property_id),
          dt(t.completed_at),
          d(t.created_at),
        ]),
      ],
    },
    {
      name: "Előzmények",
      widths: [18, 14, 24, 30, 50, 40, 60, 10],
      rows: [
        ["Időpont", "Típus", "Ügyfél", "Ingatlan", "Összefoglaló", "Eredmény", "Teljes jegyzet", "AI-val"],
        ...interactions.map((i) => [
          dt(i.occurred_at),
          label(interactionTypeLabels, i.interaction_type),
          nameOf(clientName, i.client_id),
          nameOf(propertyName, i.property_id),
          text(i.summary),
          text(i.outcome),
          i.notes !== i.summary ? text(i.notes) : null,
          i.source === "ai_assisted" ? "Igen" : null,
        ]),
      ],
    },
    {
      name: "Megtekintések",
      widths: [18, 10, 24, 30, 28, 14, 20, 40, 40],
      rows: [
        ["Időpont", "Hossz (perc)", "Ügyfél", "Ingatlan", "Helyszín", "Állapot", "Visszajelzés", "Visszajelzés szövege", "Megjegyzés"],
        ...viewings.map((v) => [
          dt(v.starts_at),
          num(v.duration_minutes),
          nameOf(clientName, v.client_id),
          nameOf(propertyName, v.property_id),
          text(v.location),
          label(viewingStatusLabels, v.status),
          v.status === "no_show" ? outcomeLabels.no_show : label(outcomeLabels, v.interest),
          text(v.feedback),
          text(v.notes),
        ]),
      ],
    },
  ];

  return buildXlsx(sheets);
}
