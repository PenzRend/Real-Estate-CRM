"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { draftReport, sendReport, setWeeklyReport, type Report } from "@/lib/reports/data";

export async function draftReportAction(propertyId: string): Promise<{ ok: true; report: Report } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  return draftReport(user, propertyId, new Date());
}

export async function sendReportAction(reportId: string, subject: string, body: string) {
  const user = await getCurrentUser();
  const r = await sendReport(user, reportId, { subject: String(subject ?? ""), body: String(body ?? "") }, new Date());
  refresh();
  return r;
}

export async function setWeeklyReportAction(propertyId: string, on: boolean) {
  const user = await getCurrentUser();
  await setWeeklyReport(user, propertyId, Boolean(on));
  refresh();
}
