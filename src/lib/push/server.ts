import "server-only";
import webpush from "web-push";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/db";

// Web push: Flavio's notifications on the agent's phone or computer, even
// when Flavio isn't open. Each device subscribes once (Settings →
// Értesítések); a device the push service no longer knows is forgotten.

export type PushMessage = {
  title: string;
  body: string;
  /** The page the notification opens. */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag?: string;
};

export function pushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:info@flavio.hu" };
}

const SUBSCRIPTION = /^https:\/\/[^\s]+$/;

export async function saveSubscription(user: CurrentUser, s: { endpoint: string; p256dh: string; auth: string; device: string | null }) {
  if (!SUBSCRIPTION.test(s.endpoint) || s.endpoint.length > 2000 || !s.p256dh || s.p256dh.length > 200 || !s.auth || s.auth.length > 100) {
    return { ok: false as const, error: "Érvénytelen eszköz." };
  }
  const supabase = await db();
  // An endpoint belongs to one browser; re-subscribing (or another account on it) takes it over.
  await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ user_id: user.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, device: s.device?.slice(0, 200) ?? null });
  if (error) {
    console.error("push subscription save failed", error.code);
    return { ok: false as const, error: "Az értesítéseket nem sikerült bekapcsolni." };
  }
  return { ok: true as const };
}

export async function removeSubscription(user: CurrentUser, endpoint: string) {
  const supabase = await db();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
}

/** Sends to every device of the user; returns how many got it. */
export async function pushToUser(userId: string, message: PushMessage): Promise<number> {
  const config = pushConfig();
  if (!config) return 0;
  const supabase = await db();
  const { data: devices } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId).limit(20);
  if (!devices?.length) return 0;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const payload = JSON.stringify({ title: message.title.slice(0, 120), body: message.body.slice(0, 300), url: message.url, tag: message.tag });
  let sent = 0;
  await Promise.all(
    devices.map(async (d) => {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 6 * 3600, urgency: "high" });
        sent++;
        await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", d.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // Gone or unknown at the push service: the device unsubscribed or was reset.
        if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("id", d.id);
        else console.error("push send failed", status ?? (error instanceof Error ? error.message : error));
      }
    }),
  );
  return sent;
}
