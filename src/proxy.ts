import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// "/api/cron" is Vercel Cron hitting the notifications job on a schedule —
// there's no signed-in user for it to redirect to /login as, and the route
// itself checks CRON_SECRET (see src/app/api/cron/notifications/route.ts).
const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/api/cron"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getClaims() verifies the session's JWT locally (via a cached JWKS check)
  // instead of making a network round-trip to the Auth server on every single
  // request the way getUser() does — that round-trip was adding real latency
  // to every navigation. It still calls getSession() under the hood first, so
  // an expiring session is refreshed here exactly as before. Actual data
  // access is enforced by Postgres RLS regardless, so this is purely a
  // (now faster) routing guard, not the real security boundary.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets, images, public draft/PDF
    // files, and the PWA infrastructure files (manifest, service worker,
    // offline fallback page) — those must always be publicly reachable or
    // the service worker can't even register for a signed-out visitor,
    // which breaks installability entirely.
    "/((?!_next/static|_next/image|favicon.ico|drafts/.*\\.docx|major-acts-pdfs/.*\\.pdf|pdfjs/|manifest\\.webmanifest|sw\\.js|offline\\.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
