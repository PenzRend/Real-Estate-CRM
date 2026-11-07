import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { sendMessage } from "@/lib/chat/data";
import { createClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/team";

// "Átadás kollégának": the client goes to a colleague (they become its agent),
// the hand-over is noted on the client's timeline, and the colleague gets a
// direct message with the client's card and the note (and so a notification).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handOffClient(user: CurrentUser, clientId: string, toUserId: string, note: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (!UUID.test(clientId) || !UUID.test(toUserId) || toUserId === user.id) return { ok: false, error: "Válassz egy kollégát." };
  const { members } = await listTeam(user);
  const to = members.find((m) => m.userId === toUserId);
  if (!to) return { ok: false, error: "Ez a kolléga már nem tagja a munkaterületnek." };
  const supabase = await createClient();
  const { data: client, error } = await supabase
    .from("clients")
    .update({ assigned_to: toUserId })
    .eq("id", clientId)
    .eq("organization_id", user.organization.id)
    .select("full_name")
    .maybeSingle();
  if (error || !client) return { ok: false, error: "Az átadás nem sikerült. Próbáld újra." };
  const text = note.trim().slice(0, 2000);
  await supabase.from("interactions").insert({
    organization_id: user.organization.id,
    client_id: clientId,
    interaction_type: "note",
    summary: `Átadva ${to.name} részére${text ? `: ${text}` : "."}`.slice(0, 1000),
    source: "manual",
  });
  await sendMessage(user, toUserId, text ? `Átadtam neked: ${text}` : "Átadtam neked ezt az ügyfelet.", { kind: "client", id: clientId });
  return { ok: true, name: to.name };
}
