import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api/shared";

const PLAYER_ROUTES = [
  "/today",
  "/matches",
  "/results",
  "/me",
  "/notifications",
];

type SessionCheck =
  | { state: "signed-in"; role: "ADMIN" | "OPERATOR" }
  | { state: "signed-out" }
  | { state: "unavailable" };

/**
 * Trois réponses, pas deux : un serveur qui ne répond pas n'est pas une
 * session expirée. Sans cette différence, une panne du backend renvoyait le
 * joueur vers l'écran de connexion (10-transverse.md § 2).
 */
async function checkSession(request: NextRequest): Promise<SessionCheck> {
  const cookie = request.headers.get("cookie");

  if (!cookie) {
    return { state: "signed-out" };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { cookie },
      cache: "no-store",
    });

    if (response.status >= 500) {
      return { state: "unavailable" };
    }
    if (!response.ok) {
      return { state: "signed-out" };
    }

    const payload = (await response.json()) as {
      session: { user: { role: "ADMIN" | "OPERATOR" } };
    };

    return { state: "signed-in", role: payload.session.user.role };
  } catch {
    return { state: "unavailable" };
  }
}

function withLocaleCookie(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (!request.cookies.has("NEXT_LOCALE")) {
    const acceptLanguage = request.headers.get("accept-language") ?? "";
    const locale = acceptLanguage.startsWith("en") ? "en" : "fr";
    response.cookies.set("NEXT_LOCALE", locale, { path: "/", sameSite: "lax" });
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await checkSession(request);
  const isAuthRoute = pathname.startsWith("/auth/");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  // Les onglets du joueur de la refonte (app/(player)), construits à côté
  // de /dashboard jusqu'au commit de bascule (docs/refonte-ui/15-todo.md).
  const isPlayerRoute = PLAYER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isAdminOnlyRoute =
    pathname.startsWith("/dashboard/audit") ||
    pathname.startsWith("/dashboard/glossaire") ||
    pathname.startsWith("/dashboard/documentation-technique");

  // Serveur injoignable : on laisse passer, l'écran montre la maintenance.
  if (session.state === "unavailable") {
    return withLocaleCookie(request, NextResponse.next());
  }

  if (isAuthRoute && session.state === "signed-in") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPlayerRoute && session.state === "signed-out") {
    // L'écran demandé est gardé : après connexion, on y revient.
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (isDashboardRoute && session.state === "signed-out") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (
    isAdminOnlyRoute &&
    !(session.state === "signed-in" && session.role === "ADMIN")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return withLocaleCookie(request, NextResponse.next());
}

export const config = {
  matcher: [
    "/auth/:path*",
    "/dashboard/:path*",
    "/today/:path*",
    "/matches/:path*",
    "/results/:path*",
    "/me/:path*",
    "/notifications/:path*",
  ],
};
