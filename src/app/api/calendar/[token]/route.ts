import { NextResponse } from "next/server";
import { calendarFeedIcs } from "@/lib/calendar/feed";
import { SECRET_TOKEN } from "@/lib/secret-token";

// The calendar subscription link (iPhone/Mac Calendar, Outlook, Google
// Calendar "from URL"). Calendar apps send no cookies: the token is the key.
export async function GET(_: Request, { params }: RouteContext<"/api/calendar/[token]">) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!SECRET_TOKEN.test(token)) return new NextResponse("Not found", { status: 404 });
  try {
    const ics = await calendarFeedIcs(token);
    if (ics == null) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="flavio.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("calendar feed", error instanceof Error ? error.message : error);
    return new NextResponse("Calendar unavailable", { status: 503 });
  }
}
