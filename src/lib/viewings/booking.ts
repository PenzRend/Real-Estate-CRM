import "server-only";
import type { MailProvider } from "@/lib/mail/provider";
import type { CurrentUser } from "@/lib/auth";
import { findMentionedProperty } from "@/lib/away/logic";
import type { Option } from "@/lib/db/activity";
import { getMailbox } from "@/lib/mail/sync";
import { createClient } from "@/lib/supabase/server";
import { cleanProposedTimes, defaultSlot } from "./logic";

// What the booking dialog starts from: the client (or the inquirer to save as
// one), the listing the conversation is about, the times the client proposed,
// and whether the agent's Google Calendar can be used.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PropertyOption = Option & { location: string | null };

export type BookingPrep = {
  client: { id: string; name: string; email: string | null } | null;
  /** The email's sender, to save as a new client, when they aren't one yet. */
  inquirer: { name: string; email: string | null; phone: string | null } | null;
  clients: (Option & { email: string | null })[];
  properties: PropertyOption[];
  propertyId: string | null;
  /** Budapest wall-clock times; the first is preselected. */
  times: string[];
  /** The times came from the client's email. */
  timesFromEmail: boolean;
  calendar: { connected: boolean; allowed: boolean; email: string | null; provider: MailProvider | null };
};

type AiViewing = { requested?: boolean; times?: unknown; name?: unknown; phone?: unknown };

export async function prepareBooking(user: CurrentUser, p: { clientId?: string | null; propertyId?: string | null; emailId?: string | null }, now: Date): Promise<BookingPrep> {
  const supabase = await createClient();
  const org = user.organization.id;
  const [mailbox, propertyRows, clients, email] = await Promise.all([
    getMailbox(user),
    supabase
      .from("properties")
      .select("id, title, city, district, address, reference_number, status")
      .eq("organization_id", org)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    p.clientId
      ? Promise.resolve({ data: [] as { id: string; full_name: string; phone: string | null; email: string | null }[] })
      : supabase.from("clients").select("id, full_name, phone, email").eq("organization_id", org).is("archived_at", null).order("full_name").limit(1000),
    p.emailId && UUID.test(p.emailId)
      ? supabase
          .from("emails")
          .select("id, from_name, from_email, reply_to_email, subject, body_text, snippet, portal, client_id, draft_to, ai_viewing")
          .eq("id", p.emailId)
          .eq("user_id", user.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const properties: PropertyOption[] = (propertyRows.data ?? []).map((r) => ({
    id: r.id,
    name: r.title,
    detail: [r.city, r.district].filter(Boolean).join(", ") || null,
    reference: r.reference_number,
    location: [r.city, r.district, r.address].filter(Boolean).join(", ") || null,
  }));

  const clientId = p.clientId ?? email?.client_id ?? null;
  const { data: client } = clientId && UUID.test(clientId)
    ? await supabase.from("clients").select("id, full_name, email").eq("id", clientId).eq("organization_id", org).maybeSingle()
    : { data: null };

  // The listing: given, named in the email, or the one last discussed with the client.
  let propertyId = p.propertyId && properties.some((x) => x.id === p.propertyId) ? p.propertyId : null;
  if (!propertyId && email) propertyId = findMentionedProperty(`${email.subject ?? ""}\n${email.body_text ?? email.snippet ?? ""}`, properties)?.id ?? null;
  if (!propertyId && client) {
    const { data: last } = await supabase
      .from("interactions")
      .select("property_id")
      .eq("organization_id", org)
      .eq("client_id", client.id)
      .not("property_id", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.property_id && properties.some((x) => x.id === last.property_id)) propertyId = last.property_id;
  }

  const ai = (email?.ai_viewing ?? null) as AiViewing | null;
  const proposed = cleanProposedTimes(ai?.times, now);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  const inquirer =
    !client && email
      ? {
          name: str(ai?.name) ?? (email.portal ? null : str(email.from_name)) ?? "",
          email: email.draft_to ?? email.reply_to_email ?? (email.portal ? null : email.from_email),
          phone: str(ai?.phone),
        }
      : null;

  return {
    client: client ? { id: client.id, name: client.full_name, email: client.email } : null,
    inquirer: inquirer && (inquirer.name || inquirer.email) ? { ...inquirer, name: inquirer.name } : null,
    clients: (clients.data ?? []).map((c) => ({ id: c.id, name: c.full_name, detail: c.phone ?? c.email, email: c.email })),
    properties,
    propertyId,
    times: proposed.length ? proposed : [defaultSlot(now)],
    timesFromEmail: proposed.length > 0,
    calendar: {
      connected: Boolean(mailbox && mailbox.status !== "revoked"),
      allowed: Boolean(mailbox && mailbox.status !== "revoked" && mailbox.can_calendar),
      email: mailbox?.email_address ?? null,
      provider: mailbox?.provider ?? null,
    },
  };
}
