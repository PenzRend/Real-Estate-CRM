"use server";

import { getCurrentUser } from "@/lib/auth";
import { pushConfig, pushToUser, removeSubscription, saveSubscription } from "@/lib/push/server";

export async function savePushAction(sub: { endpoint: string; p256dh: string; auth: string; device: string | null }) {
  const user = await getCurrentUser();
  if (!pushConfig()) return { ok: false as const, error: "Az értesítések most nem érhetők el." };
  return saveSubscription(user, {
    endpoint: String(sub.endpoint ?? ""),
    p256dh: String(sub.p256dh ?? ""),
    auth: String(sub.auth ?? ""),
    device: typeof sub.device === "string" ? sub.device : null,
  });
}

export async function removePushAction(endpoint: string) {
  const user = await getCurrentUser();
  await removeSubscription(user, String(endpoint ?? ""));
}

/** "Próba": a notification to every device of the agent, to see that it arrives. */
export async function testPushAction() {
  const user = await getCurrentUser();
  const sent = await pushToUser(user.id, {
    title: "Flavio értesítés",
    body: "Így jelez a Flavio, ha új érdeklődés vagy ügyféllevél érkezik.",
    url: "/dashboard",
    tag: "test",
  });
  return sent ? { ok: true as const, sent } : { ok: false as const, error: "Nincs bekapcsolt eszköz, vagy nem sikerült elküldeni." };
}
