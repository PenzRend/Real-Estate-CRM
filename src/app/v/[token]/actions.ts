"use server";

import { refresh } from "next/cache";
import { hashSecretToken, SECRET_TOKEN } from "@/lib/secret-token";
import { pushToUser } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asBackgroundJob } from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/server";

/**
 * The client's answer on the reminder page (no sign-in: the secret link is
 * the key). Recorded on the viewing and the client's timeline; the agent gets
 * a notification on their devices.
 */
export async function respondAction(token: string, response: "confirmed" | "declined", form: FormData) {
  if (!SECRET_TOKEN.test(token) || (response !== "confirmed" && response !== "declined")) return;
  const note = String(form.get("note") ?? "").trim().slice(0, 500);
  const supabase = await createClient();
  const hash = hashSecretToken(token);
  const { data: agentId, error } = await supabase.rpc("respond_to_viewing", { p_token_hash: hash, p_response: response, p_note: note });
  if (error) console.error("viewing response failed", error.code);
  if (agentId) {
    const { data: rows } = await supabase.rpc("viewing_for_client", { p_token_hash: hash });
    const v = rows?.[0];
    const admin = createAdminClient();
    if (admin && v) {
      const when = new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" }).format(new Date(v.starts_at));
      await asBackgroundJob(admin, () =>
        pushToUser(agentId as string, {
          title: response === "confirmed" ? `${v.client_name} jön a megtekintésre` : `${v.client_name} nem tud jönni`,
          body: `${v.property_title}, ${when}${note ? ` – „${note}”` : ""}`,
          url: "/dashboard",
          tag: `viewing-${hash.slice(0, 12)}`,
        }),
      ).catch(() => 0);
    }
  }
  refresh();
}
