import { NextResponse } from "next/server";
import { listingFeedXml } from "@/lib/portal/feed";
import { SECRET_TOKEN } from "@/lib/secret-token";

// The portal export feed. Portals send no cookies: the token is the key.
export async function GET(_: Request, { params }: RouteContext<"/api/feed/[token]">) {
  const token = (await params).token.replace(/\.xml$/, "");
  if (!SECRET_TOKEN.test(token)) return new NextResponse("Not found", { status: 404 });
  try {
    const xml = await listingFeedXml(token);
    if (xml == null) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "private, max-age=600" } });
  } catch (error) {
    console.error("listing feed", error instanceof Error ? error.message : error);
    return new NextResponse("Feed unavailable", { status: 503 });
  }
}
