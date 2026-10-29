import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runCronJob, CRON_JOBS, type CronJob } from "@/lib/cron/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Background jobs, called by the server's scheduler (see docs/DEPLOY.md):
 * `GET /api/cron?job=mail` every 2 minutes, `?job=daily` every morning,
 * with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const job = request.nextUrl.searchParams.get("job");
  if (!(CRON_JOBS as readonly string[]).includes(job ?? "")) return NextResponse.json({ error: "unknown job" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SECRET_KEY is not set" }, { status: 503 });
  const result = await runCronJob(admin, job as CronJob, new Date());
  return NextResponse.json(result);
}
