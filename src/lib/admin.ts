import "server-only";
import { randomInt } from "node:crypto";
import type { CurrentUser } from "@/lib/auth";
import { monthStart } from "@/lib/ai/usage";
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
  limit: number | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
};

// No 0/O, 1/I/L: codes are read off a screen and typed in.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const newSignupCode = () => `${part()}-${part()}`;

export async function listSignupCodes(): Promise<SignupCode[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("signup_codes")
    .select("id, code, note, email, created_at, expires_at, used_at, used_by, revoked_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.used_by).filter(Boolean))] as string[];
  const { data: profiles } = userIds.length ? await admin.from("profiles").select("id, email").in("id", userIds) : { data: [] };
  const emailOf = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string]));
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

/** Every workspace with this month's AI calls, busiest first. */
export async function listWorkspaceUsage(): Promise<WorkspaceUsage[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.rpc("admin_workspace_ai_usage", { p_since: monthStart() });
  if (error) console.error("admin_workspace_ai_usage failed", error.code);
  type Row = { organization_id: string; name: string; is_personal: boolean; owner_email: string | null; members: number; ai_monthly_limit: number | null; calls: number; input_tokens: number; output_tokens: number; created_at: string };
  return ((data ?? []) as Row[])
    .sort((a, b) => b.calls - a.calls || b.created_at.localeCompare(a.created_at))
    .map((r) => ({
      id: r.organization_id,
      name: r.name,
      isPersonal: r.is_personal,
      ownerEmail: r.owner_email,
      members: r.members,
      limit: r.ai_monthly_limit,
      calls: r.calls,
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
    }));
}
