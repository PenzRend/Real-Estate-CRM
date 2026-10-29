import { NextResponse } from "next/server";
import { recordCalls } from "@/lib/phone/calls";
import { bearerToken, callReportSchema } from "@/lib/phone/report";
import { SECRET_TOKEN } from "@/lib/secret-token";

// The Android call-capture app reports calls here with the agent's phone key
// (Beállítások → Kapcsolatok → Hívásnapló Androidról). See docs/ANDROID-CALLS.md.
export async function POST(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token || !SECRET_TOKEN.test(token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = callReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const results = await recordCalls(token, parsed.data);
    if (!results) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ results });
  } catch (error) {
    console.error("call capture", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
