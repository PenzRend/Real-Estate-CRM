import "server-only";
import { randomInt } from "node:crypto";
import type { CurrentUser } from "@/lib/auth";
import { dayStart, monthStart } from "@/lib/ai/usage";
import { createAdminClient } from "@/lib/supabase/admin";

// The platform admin: whoever runs the pilot, named by address in ADMIN_EMAILS
// on the server. Not a workspace role; it sees every workspace's totals and
// makes sign-up codes. Reads go through the service key, after this check.

export function isPlatformAdmin(user: CurrentUser) {
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(user.email.toLowerCase());
}

export type SignupCode = {
  id: string;
  code: string;
  note: string | null;
  email: string | null;
  createdAt: string;
  expiresAt: string;
  status: "open" | "used" | "revoked" | "expired";
  usedAt: string | null;
  usedBy: string | null;
};

export type WorkspaceUsage = {
  id: string;
  name: string;
  isPersonal: boolean;
  ownerEmail: string | null;
  members: number;
  createdAt: string;
  lastActivityAt: string | null;
  limit: number | null;
  calls: number;
  dailyLimit: number | null;
  today: number;
  tokens: number;
  clients: number;
  properties: number;
  interactions: number;
  viewings: number;
  deals: number;
  tasksOpen: number;
  mailboxes: number;
  storageBytes: number;
};

export type Overview = {
  users: number;
  users_confirmed: number;
  signups_7d: number;
  signups_30d: number;
  active_1d: number;
  active_7d: number;
  active_30d: number;
  workspaces: number;
  teams: number;
  ai_calls: number;
  ai_errors: number;
  ai_tokens: number;
  clients: number;
  properties: number;
  interactions: number;
  viewings: number;
  deals: number;
  tasks_open: number;
  created_month: number;
  mailboxes: number;
  mailboxes_broken: number;
  push_devices: number;
  phone_keys: number;
  feedback_7d: number;
  codes_open: number;
  codes_used: number;
};

export type DailyRow = { day: string; signups: number; ai_calls: number; ai_errors: number; records: number };

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  confirmed: boolean;
  lastSeenAt: string | null;
  workspaces: string | null;
  role: string | null;
  aiCalls: number;
  clients: number;
  properties: number;
  interactions: number;
  viewings: number;
  mailboxes: number;
  pushDevices: number;
  signupCode: string | null;
};

export type AiBreakdownRow = { operation: string; model: string; status: string; calls: number; inputTokens: number; outputTokens: number };

export type SystemStatus = {
  dbBytes: number;
  storageBytes: number;
  storageFiles: number;
  lastMailSync: string | null;
  mailboxes: { email: string; provider: string; status: string; lastError: string | null; lastSyncedAt: string | null; owner: string | null }[];
  outbox: Record<string, number>;
  outboxFailed: { subject: string | null; error: string | null; at: string; owner: string | null }[];
  reportsFailed: number;
  calendarErrors: { kind: string; error: string; owner: string | null }[];
};

export type FeedbackItem = { id: string; kind: string; message: string; page: string | null; userAgent: string | null; createdAt: string; email: string | null };

// No 0/O, 1/I/L: codes are read off a screen and typed in.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const newSignupCode = () => `${part()}-${part()}`;

/**
 * Whether the service key works: "missing" when unset, "invalid" when Supabase
 * refuses it (a wrong or deleted key; background jobs fail the same way).
 */
export async function serviceKeyStatus(): Promise<"ok" | "missing" | "invalid"> {
  const admin = createAdminClient();
  if (!admin) return "missing";
  const { error, status } = await admin.from("organizations").select("id", { head: true, count: "exact" });
  if (!error) return "ok";
  console.error("service key check failed", status, error.message);
  return status === 401 || status === 403 ? "invalid" : "ok";
}

/** Profile emails by user id, for lists that name who did something. */
async function emailsById(admin: NonNullable<ReturnType<typeof createAdminClient>>, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  const { data } = unique.length ? await admin.from("profiles").select("id, email").in("id", unique) : { data: [] };
  return new Map((data ?? []).map((p) => [p.id as string, p.email as string]));
}

export async function listSignupCodes(): Promise<SignupCode[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("signup_codes")
    .select("id, code, note, email, created_at, expires_at, used_at, used_by, revoked_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const emailOf = await emailsById(admin, rows.map((r) => r.used_by));
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    note: r.note,
    email: r.email,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    status: r.used_at ? "used" : r.revoked_at ? "revoked" : Date.parse(r.expires_at) < now ? "expired" : "open",
    usedAt: r.used_at,
    usedBy: r.used_by ? (emailOf.get(r.used_by) ?? null) : null,
  }));
}

/** Every workspace with its size, activity and this month's AI use, busiest first. */
export async function listWorkspaceUsage(): Promise<WorkspaceUsage[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const [{ data, error }, todays] = await Promise.all([
    admin.rpc("admin_workspaces", { p_since: monthStart() }),
    admin.rpc("admin_workspace_calls_since", { p_since: dayStart() }),
  ]);
  if (error) console.error("admin_workspaces failed", error.code ?? error.message);
  if (todays.error) console.error("admin_workspace_calls_since failed", todays.error.code ?? todays.error.message);
  const today = new Map(((todays.data ?? []) as { organization_id: string; calls: number; ai_daily_limit: number | null }[]).map((t) => [t.organization_id, t]));
  type Row = {
    organization_id: string; name: string; is_personal: boolean; owner_email: string | null; members: number; created_at: string;
    last_activity_at: string | null; ai_monthly_limit: number | null; ai_calls: number; ai_tokens: number; clients: number;
    properties: number; interactions: number; viewings: number; deals: number; tasks_open: number; mailboxes: number; storage_bytes: number;
  };
  return ((data ?? []) as Row[])
    .sort((a, b) => b.ai_calls - a.ai_calls || (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? "") || b.created_at.localeCompare(a.created_at))
    .map((r) => ({
      id: r.organization_id,
      name: r.name,
      isPersonal: r.is_personal,
      ownerEmail: r.owner_email,
      members: r.members,
      createdAt: r.created_at,
      lastActivityAt: r.last_activity_at,
      limit: r.ai_monthly_limit,
      calls: r.ai_calls,
      dailyLimit: today.get(r.organization_id)?.ai_daily_limit ?? null,
      today: today.get(r.organization_id)?.calls ?? 0,
      tokens: Number(r.ai_tokens),
      clients: r.clients,
      properties: r.properties,
      interactions: r.interactions,
      viewings: r.viewings,
      deals: r.deals,
      tasksOpen: r.tasks_open,
      mailboxes: r.mailboxes,
      storageBytes: Number(r.storage_bytes),
    }));
}

export async function getOverview(): Promise<Overview | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("admin_overview", { p_since: monthStart() });
  if (error) console.error("admin_overview failed", error.code ?? error.message);
  return (data as Overview | null) ?? null;
}

export async function getDaily(days = 30): Promise<DailyRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.rpc("admin_daily", { p_days: days });
  if (error) console.error("admin_daily failed", error.code ?? error.message);
  return (data ?? []) as DailyRow[];
}

/** Every account, most recently seen first. */
export async function listUsers(): Promise<AdminUser[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.rpc("admin_users", { p_since: monthStart() });
  if (error) console.error("admin_users failed", error.code ?? error.message);
  type Row = {
    user_id: string; email: string; full_name: string | null; created_at: string; confirmed: boolean; last_sign_in_at: string | null;
    last_seen_at: string | null; workspaces: string | null; role: string | null; ai_calls: number; clients: number; properties: number;
    interactions: number; viewings: number; mailboxes: number; push_devices: number; signup_code: string | null;
  };
  const latest = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
  return ((data ?? []) as Row[])
    .map((r) => ({
      id: r.user_id,
      email: r.email,
      fullName: r.full_name,
      createdAt: r.created_at,
      confirmed: r.confirmed,
      lastSeenAt: latest(r.last_seen_at, r.last_sign_in_at),
      workspaces: r.workspaces,
      role: r.role,
      aiCalls: r.ai_calls,
      clients: r.clients,
      properties: r.properties,
      interactions: r.interactions,
      viewings: r.viewings,
      mailboxes: r.mailboxes,
      pushDevices: r.push_devices,
      signupCode: r.signup_code,
    }))
    .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""));
}

export async function getAiBreakdown(): Promise<AiBreakdownRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.rpc("admin_ai_breakdown", { p_since: monthStart() });
  if (error) console.error("admin_ai_breakdown failed", error.code ?? error.message);
  type Row = { operation_type: string; model: string; status: string; calls: number; input_tokens: number; output_tokens: number };
  return ((data ?? []) as Row[]).map((r) => ({
    operation: r.operation_type,
    model: r.model,
    status: r.status,
    calls: r.calls,
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
  }));
}

export async function getSystemStatus(): Promise<SystemStatus | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("admin_system");
  if (error) console.error("admin_system failed", error.code ?? error.message);
  if (!data) return null;
  type Raw = {
    db_bytes: number; storage_bytes: number; storage_files: number; last_mail_sync: string | null; reports_failed: number;
    mailboxes: { email: string; provider: string; status: string; last_error: string | null; last_synced_at: string | null; owner: string | null }[];
    outbox: Record<string, number>;
    outbox_failed: { subject: string | null; error: string | null; at: string; owner: string | null }[];
    calendar_errors: { kind: string; error: string; owner: string | null }[];
  };
  const r = data as Raw;
  return {
    dbBytes: Number(r.db_bytes),
    storageBytes: Number(r.storage_bytes),
    storageFiles: Number(r.storage_files),
    lastMailSync: r.last_mail_sync,
    mailboxes: r.mailboxes.map((m) => ({ email: m.email, provider: m.provider, status: m.status, lastError: m.last_error, lastSyncedAt: m.last_synced_at, owner: m.owner })),
    outbox: r.outbox,
    outboxFailed: r.outbox_failed,
    reportsFailed: Number(r.reports_failed),
    calendarErrors: r.calendar_errors,
  };
}

export async function listFeedback(): Promise<FeedbackItem[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("product_feedback")
    .select("id, kind, message, page, user_agent, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const emailOf = await emailsById(admin, rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    message: r.message,
    page: r.page,
    userAgent: r.user_agent,
    createdAt: r.created_at,
    email: r.user_id ? (emailOf.get(r.user_id) ?? null) : null,
  }));
}

/** Which server settings are present. Names and yes/no only; secret values never leave the server. */
export function configStatus() {
  const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]));
  return {
    appUrl: process.env.APP_URL ?? null,
    region: process.env.VERCEL_REGION ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
    aiModel: process.env.AI_MODEL || null,
    aiFallbackModel: process.env.AI_FALLBACK_MODEL || null,
    transcribeModel: process.env.TRANSCRIBE_MODEL || null,
    checks: [
      { name: "SUPABASE_SECRET_KEY", ok: has("SUPABASE_SECRET_KEY") || has("SUPABASE_SERVICE_ROLE_KEY"), what: "Háttérfolyamatok, értesítések, ez az oldal" },
      { name: "APP_URL", ok: has("APP_URL"), what: "Linkek a levelekben" },
      { name: "CRON_SECRET", ok: has("CRON_SECRET"), what: "Időzített feladatok (cron-job.org)" },
      { name: "MAIL_TOKEN_KEY", ok: has("MAIL_TOKEN_KEY"), what: "Postafiókok összekapcsolása" },
      { name: "AI", ok: Boolean(process.env.ANTHROPIC_API_KEY) || has("AI_BASE_URL", "AI_API_KEY", "AI_MODEL"), what: "AI-funkciók" },
      { name: "AI_FALLBACK_*", ok: has("AI_FALLBACK_BASE_URL", "AI_FALLBACK_API_KEY", "AI_FALLBACK_MODEL"), what: "Tartalék AI, ha a fő nem elérhető", optional: true },
      { name: "TRANSCRIBE_MODEL", ok: has("TRANSCRIBE_MODEL"), what: "Diktálás" },
      { name: "GOOGLE_CLIENT_*", ok: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), what: "Gmail és Google Naptár" },
      { name: "MICROSOFT_CLIENT_*", ok: has("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"), what: "Outlook", optional: true },
      { name: "VAPID_*", ok: has("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"), what: "Telefonos értesítések" },
      { name: "PRIVACY_*", ok: has("PRIVACY_CONTROLLER", "PRIVACY_EMAIL"), what: "Adatkezelési tájékoztató adatai" },
      { name: "AI_MONTHLY_LIMIT", ok: has("AI_MONTHLY_LIMIT"), what: "Havi AI-keret", optional: true },
      { name: "AI_DAILY_LIMIT", ok: has("AI_DAILY_LIMIT"), what: "Napi AI-keret (ha nincs: 100)", optional: true },
    ] as { name: string; ok: boolean; what: string; optional?: boolean }[],
  };
}
