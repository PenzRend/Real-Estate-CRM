"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { sendOutboxItem, updateOutbox } from "@/lib/email-auto/outbox";
import { deleteEmailTemplate, EMAIL_STARTERS, listEmailTemplates, saveEmailTemplate, type EmailTemplateInput } from "@/lib/email-auto/templates";
import { templateValues } from "@/lib/office-docs/fields";
import { loadRecords } from "@/lib/office-docs/fill";
import { fillTemplateText } from "@/lib/office-docs/template-render";

export async function saveEmailTemplateAction(id: string | null, input: EmailTemplateInput) {
  const user = await getCurrentUser();
  const r = await saveEmailTemplate(user, id ? String(id) : null, {
    name: String(input.name ?? ""),
    subject: String(input.subject ?? ""),
    body: String(input.body ?? ""),
    trigger: String(input.trigger ?? "manual"),
    delayMinutes: Number(input.delayMinutes) || 0,
    noContactDays: input.noContactDays == null ? null : Number(input.noContactDays),
    mode: String(input.mode ?? "approve"),
    active: Boolean(input.active),
  });
  if (r.ok) refresh();
  return r;
}

export async function toggleEmailTemplateAction(id: string, active: boolean) {
  const user = await getCurrentUser();
  const t = (await listEmailTemplates(user)).find((x) => x.id === String(id));
  if (!t) return { ok: false as const, error: "Ismeretlen szabály." };
  const r = await saveEmailTemplate(user, t.id, { ...t, active: Boolean(active) });
  if (r.ok) refresh();
  return r;
}

export async function deleteEmailTemplateAction(id: string) {
  const user = await getCurrentUser();
  await deleteEmailTemplate(user, String(id));
  refresh();
}

export async function addEmailStartersAction() {
  const user = await getCurrentUser();
  const existing = await listEmailTemplates(user);
  let added = 0;
  for (const t of EMAIL_STARTERS) {
    if (existing.some((e) => e.name === t.name)) continue;
    if ((await saveEmailTemplate(user, null, { ...t, active: false })).ok) added++;
  }
  refresh();
  return added;
}

/** The editor's preview for a sample client (AI paragraphs shown as notes). */
export async function previewEmailAction(subject: string, body: string, clientId: string | null) {
  const user = await getCurrentUser();
  const records = await loadRecords(user, { clientId: clientId || null });
  const values = { ...templateValues(records), keresztnev: (records.buyer?.full_name ?? "").trim().split(/\s+/).slice(-1)[0] ?? "", megtekintes_ideje: "csütörtök 15:00", visszajelzes: "" };
  return { subject: fillTemplateText(String(subject), values), body: fillTemplateText(String(body), values) };
}

export async function approveOutboxAction(id: string, edits?: { subject?: string; body?: string }) {
  const user = await getCurrentUser();
  await updateOutbox(user, String(id), { subject: edits?.subject, body: edits?.body, status: "queued" });
  refresh();
}

export async function cancelOutboxAction(id: string) {
  const user = await getCurrentUser();
  await updateOutbox(user, String(id), { status: "cancelled" });
  refresh();
}

export async function sendOutboxNowAction(id: string, edits?: { subject?: string; body?: string }) {
  const user = await getCurrentUser();
  if (edits) await updateOutbox(user, String(id), { subject: edits.subject, body: edits.body });
  const r = await sendOutboxItem(user, String(id));
  refresh();
  return r;
}
