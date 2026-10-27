// Liveness check for the server and Docker (no database call, no sign-in).
export function GET() {
  return Response.json({ ok: true });
}
