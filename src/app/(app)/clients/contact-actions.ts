"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { CALL_OUTCOMES, type CallOutcome } from "@/lib/contact";
import { insertInteraction, insertTasks, touchClient } from "@/lib/db/activity";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNELS = { call: "Hívás", whatsapp: "WhatsApp-hívás", viber: "Viber-hívás" } as const;

/**
 * "Hogy ment?" after a one-tap call: the call goes on the client's timeline,
 * the last contact moves, and a follow-up (if chosen) becomes a task and the
 * client's next follow-up date.
 */
export async function logCallAction(input: { clientId: string; outcome: string; note: string; followUpDays: number | null; channel: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID.test(input.clientId) || !(input.outcome in CALL_OUTCOMES)) return { ok: false, error: "Ismeretlen ügyfél." };
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, full_name").eq("id", input.clientId).eq("organization_id", user.organization.id).maybeSingle();
  if (!client) return { ok: false, error: "Ismeretlen ügyfél." };

  const outcome = CALL_OUTCOMES[input.outcome as CallOutcome];
  const channel = CHANNELS[input.channel as keyof typeof CHANNELS] ?? CHANNELS.call;
  const note = input.note.trim().slice(0, 2000) || null;
  const days = input.followUpDays != null && Number.isInteger(input.followUpDays) && input.followUpDays >= 0 && input.followUpDays <= 60 ? input.followUpDays : null;
  const now = new Date();
  // A follow-up lands at 9:00 (Budapest) on its day, like other reminders.
  const followUpDay = days != null ? utcToZonedLocal(new Date(now.getTime() + days * 86_400_000).toISOString()).slice(0, 10) : null;
  const followUpAt = followUpDay ? zonedLocalToUtc(`${followUpDay}T09:00`) : null;
  const followUp = followUpAt ? new Date(followUpAt) : null;

  try {
    const interactionId = await insertInteraction(user, {
      client_id: client.id,
      property_id: null,
      interaction_type: "call",
      occurred_at: now.toISOString(),
      summary: outcome.summary.replace("Hívás", channel),
      notes: note,
      outcome: outcome.label,
      follow_up_required: followUp != null,
      source: "manual",
    });
    if (followUp) {
      await insertTasks(user, [
        {
          title: (input.outcome === "talked" ? `Utánkövetés: ${client.full_name}` : `Visszahívni: ${client.full_name}`).slice(0, 300),
          due_at: followUp.toISOString(),
          client_id: client.id,
          property_id: null,
          interaction_id: interactionId,
          source: "manual",
        },
      ]);
    }
    await touchClient(user, client.id, now.toISOString(), followUp ? followUp.toISOString() : undefined);
  } catch {
    return { ok: false, error: "A hívást nem sikerült rögzíteni. Próbáld újra." };
  }
  refresh();
  return { ok: true };
}
