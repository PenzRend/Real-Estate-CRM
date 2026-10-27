import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Ref } from "@/lib/types/view-models";

export type EmailStatus = "new" | "processed" | "ignored";

export type EmailItem = {
  id: string;
  direction: "incoming" | "outgoing";
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[];
  subject: string | null;
  snippet: string | null;
  receivedAt: string;
  portal: string | null;
  client: Ref | null;
  status: EmailStatus;
  interactionId: string | null;
};

export type EmailDetail = EmailItem & { bodyText: string | null };

const COLUMNS =
  "id, direction, from_email, from_name, to_emails, subject, snippet, received_at, portal, client_id, status, interaction_id";

type Row = {
  id: string;
  direction: "incoming" | "outgoing";
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  subject: string | null;
  snippet: string | null;
  received_at: string;
  portal: string | null;
  client_id: string | null;
  status: EmailStatus;
  interaction_id: string | null;
  body_text?: string | null;
};

async function clientRefs(ids: string[]) {
  if (!ids.length) return new Map<string, Ref>();
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((c): [string, Ref] => [c.id, { id: c.id, name: c.full_name }]));
}

function toItem(r: Row, clients: Map<string, Ref>): EmailItem {
  return {
    id: r.id,
    direction: r.direction,
    fromEmail: r.from_email,
    fromName: r.from_name,
    toEmails: r.to_emails ?? [],
    subject: r.subject,
    snippet: r.snippet,
    receivedAt: r.received_at,
    portal: r.portal,
    client: r.client_id ? (clients.get(r.client_id) ?? null) : null,
    status: r.status,
    interactionId: r.interaction_id,
  };
}

export async function listEmails(user: CurrentUser, status: EmailStatus): Promise<EmailItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("emails")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .eq("status", status)
    .order("received_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Failed to list emails: ${error.message}`);
  const rows = (data ?? []) as Row[];
  const clients = await clientRefs([...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[]);
  return rows.map((r) => toItem(r, clients));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getEmail(user: CurrentUser, id: string): Promise<EmailDetail | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("emails").select(`${COLUMNS}, body_text`).eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(`Failed to load email: ${error.message}`);
  if (!data) return null;
  const row = data as Row;
  const clients = await clientRefs(row.client_id ? [row.client_id] : []);
  return { ...toItem(row, clients), bodyText: row.body_text ?? null };
}

export async function setEmailStatus(user: CurrentUser, id: string, status: EmailStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("emails").update({ status }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(`Failed to update email: ${error.code}`);
}

/** The text handed to AI capture: who, when, subject, then the message. */
export function emailAsNote(e: EmailDetail) {
  const sender = e.fromName ? `${e.fromName} <${e.fromEmail}>` : (e.fromEmail ?? "ismeretlen");
  const when = new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Budapest" }).format(new Date(e.receivedAt));
  return [
    `E-mail (${e.direction === "incoming" ? "bejövő" : "kimenő"}), ${when}`,
    `Feladó: ${sender}`,
    e.direction === "outgoing" && e.toEmails.length ? `Címzett: ${e.toEmails.join(", ")}` : null,
    e.portal ? `Portál: ${e.portal}` : null,
    `Tárgy: ${e.subject ?? "(nincs tárgy)"}`,
    "",
    e.bodyText || e.snippet || "",
  ]
    .filter((l) => l !== null)
    .join("\n");
}
