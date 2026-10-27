import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// Pages reachable without a session ("/" is the landing page; matched exactly;
// "/l/…" are listing pages shared with clients). Everything else requires sign-in.
const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/auth", "/l", "/adatvedelem"];
// Signed-in users have no reason to see these.
const GUEST_ONLY_PATHS = ["/", "/login", "/signup", "/forgot-password"];

const matches = (pathname: string, paths: string[]) =>
  paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Refreshes the Supabase session cookie on every request and does an
 * optimistic redirect. This is not the authorization boundary: pages verify
 * the user again (src/lib/auth.ts) and RLS protects every row.
 */
export async function proxy(request: NextRequest) {
  // Without Supabase configured the app shows its setup notice instead.
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/login" && pathname !== "/") url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!signedIn && !matches(pathname, PUBLIC_PATHS)) return redirectTo("/login");
  if (signedIn && matches(pathname, GUEST_ONLY_PATHS)) return redirectTo("/dashboard");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
