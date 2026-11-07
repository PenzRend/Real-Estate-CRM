"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { aiReview, approveDraft, createDraft, deleteDraft, getDraft, saveDraft, type Refs } from "@/lib/contracts/data";
import { contractChecks } from "@/lib/contracts/checks";
import { CONTRACT_KINDS, isContractKind, missingFields } from "@/lib/contracts/kinds";
import { contractHtml } from "@/lib/contracts/render";

const ref = (v: unknown) => (typeof v === "string" ? v : null);

export async function createContractAction(kind: string, refs: Refs) {
  const user = await getCurrentUser();
  const r = await createDraft(user, String(kind), { dealId: ref(refs?.dealId), propertyId: ref(refs?.propertyId), clientId: ref(refs?.clientId) });
  return r;
}

/** The review screen's live preview: the text with the agent's values, gaps and checks. Nothing is saved. */
export async function previewContractAction(id: string, body: string, extra: Record<string, string>) {
  const user = await getCurrentUser();
  const draft = await getDraft(user, String(id));
  if (!draft || !isContractKind(draft.kind)) return null;
  const values = { ...draft.values, ...Object.fromEntries(Object.entries(extra ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) };
  return {
    html: contractHtml(draft.kind, String(body).slice(0, 200_000), values),
    missing: missingFields(draft.kind, values).map((f) => f.key),
    checks: contractChecks(draft.kind, values),
    label: CONTRACT_KINDS[draft.kind].label,
  };
}

export async function saveContractAction(id: string, input: { body?: string; extra?: Record<string, string>; title?: string }) {
  const user = await getCurrentUser();
  const r = await saveDraft(user, String(id), input ?? {});
  if (r.ok) refresh();
  return r;
}

export async function approveContractAction(id: string) {
  const user = await getCurrentUser();
  const r = await approveDraft(user, String(id));
  if (r.ok) refresh();
  return r;
}

export async function aiReviewContractAction(id: string) {
  const user = await getCurrentUser();
  return aiReview(user, String(id));
}

export async function deleteContractAction(id: string) {
  const user = await getCurrentUser();
  await deleteDraft(user, String(id));
  redirect("/contracts");
}
