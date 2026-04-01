import { NextRequest, NextResponse } from "next/server";

// ─── Route definitions ──────────────────────────────────────
// Routes that require authentication AND a verified email
const PROTECTED_ROUTES = ["/dashboard"];

// Auth pages that logged-in users should be redirected away from
const AUTH_ROUTES = ["/auth/signin", "/auth/signup"];

const VERIFY_EMAIL_ROUTE = "/auth/verify-email";

type SessionLookupResult =
  | { kind: "valid"; session: { user: { emailVerified: boolean } } }
  | { kind: "missing" }
  | { kind: "error"; status?: number };

// ─── Helper: fetch session from Better Auth API ─────────────
async function getSession(request: NextRequest): Promise<SessionLookupResult> {
  try {
    const response = await fetch(
      new URL("/api/auth/get-session", request.url),
      {
        cache: "no-store",
        headers: {
          accept: "application/json",
          cookie: request.headers.get("cookie") || "",
        },
      }
    );

    if (response.status === 401) {
      return { kind: "missing" };
    }

    if (!response.ok) {
      return { kind: "error", status: response.status };
    }

    const data = await response.json();
    return data?.user ? { kind: "valid", session: data } : { kind: "missing" };
  } catch {
    return { kind: "error" };
  }
}

// ─── Middleware ──────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Better Auth session cookie (dev vs production name)
  const hasSessionCookie =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token");

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  const isVerifyEmail = pathname === VERIFY_EMAIL_ROUTE;

  // ── 1. No session cookie ──────────────────────────────────
  if (!hasSessionCookie) {
    // Unauthenticated users can't access protected routes or verify-email
    if (isProtected || isVerifyEmail) {
      const signinUrl = new URL("/auth/signin", request.url);
      signinUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signinUrl);
    }
    // Let them through to public pages & auth pages
    return NextResponse.next();
  }

  // ── 2. Has session cookie — always fetch session ──────────
  const sessionResult = await getSession(request);

  if (sessionResult.kind === "error") {
    return NextResponse.next();
  }

  // Cookie present but session is invalid / expired
  if (sessionResult.kind === "missing") {
    if (isProtected || isVerifyEmail) {
      const response = NextResponse.redirect(
        new URL("/auth/signin", request.url)
      );
      // Clean up stale cookies
      response.cookies.delete("better-auth.session_token");
      response.cookies.delete("__Secure-better-auth.session_token");
      return response;
    }
    // Auth pages or public pages with stale cookie — let them through
    return NextResponse.next();
  }

  // ── Valid session below this point ─────────────────────────

  const emailVerified = sessionResult.session.user.emailVerified;

  // Already verified but visiting verify-email → send to account
  if (isVerifyEmail && emailVerified) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ★ Unverified email → force to verify-email on ALL routes
  //   (except the verify-email page itself, which is handled above)
  if (!emailVerified && !isVerifyEmail) {
    return NextResponse.redirect(new URL(VERIFY_EMAIL_ROUTE, request.url));
  }

  // Redirect logged-in (and verified) users away from sign-in / sign-up pages
  if (isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── 3. All other routes — pass through ────────────────────
  return NextResponse.next();
}

// Only run middleware on page routes — skip static assets & API
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|api/).*)",
  ],
};
