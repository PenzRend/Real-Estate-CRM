import { NextResponse } from "next/server";
import { listingFeedPhoto } from "@/lib/portal/feed";
import { SECRET_TOKEN } from "@/lib/secret-token";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A photo of a listing in the portal feed, at a link that stays the same (portals download them on import).
export async function GET(_: Request, { params }: RouteContext<"/api/feed/[token]/photo/[id]">) {
  const { token, id } = await params;
  if (!SECRET_TOKEN.test(token) || !UUID.test(id)) return new NextResponse("Not found", { status: 404 });
  const file = await listingFeedPhoto(token, id).catch(() => null);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(file, { headers: { "Content-Type": file.type || "image/jpeg", "Cache-Control": "public, max-age=86400" } });
}
