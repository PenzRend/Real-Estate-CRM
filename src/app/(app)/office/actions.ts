"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { setInRotation, setLeadMode, setTarget, type TargetField } from "@/lib/team/office-data";
import { parseHungarianNumber } from "@/lib/validation/common";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One target of one agent for a month ("" clears it). */
export async function setTargetAction(userId: string, month: string, field: string, value: string) {
  if (!UUID.test(userId)) return { ok: false as const, error: "Ismeretlen munkatárs." };
  const n = parseHungarianNumber(value);
  if (n != null && (Number.isNaN(n) || n < 0 || n > 1e12)) return { ok: false as const, error: "Számot adj meg (pl. 3 vagy 2M)." };
  const user = await getCurrentUser();
  const r = await setTarget(user, userId, month, field as TargetField, n == null ? null : field === "commission" ? n : Math.round(n));
  if (r.ok) refresh();
  return r;
}

export async function setLeadModeAction(mode: string) {
  const user = await getCurrentUser();
  await setLeadMode(user, mode === "round_robin" ? "round_robin" : "creator");
  refresh();
}

export async function setInRotationAction(userId: string, on: boolean) {
  if (!UUID.test(userId)) return;
  const user = await getCurrentUser();
  await setInRotation(user, userId, Boolean(on));
  refresh();
}
