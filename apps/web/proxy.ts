import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  REQUESTED_PATH_HEADER,
  SESSION_COOKIE,
  loginPathFor,
} from "@/domains/auth/routing/auth-routing";

const PLAYER_ROUTES = [
  "/today",
  "/matches",
  "/results",
  "/me",
  "/notifications",
  "/ticket",
];

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

/**
 * No network call here (docs/refonte-ui/16-performance-et-qualite.md § 2):
 * the proxy only checks that a session cookie is present. Whether that
 * session is still valid is answered once, by the backend, during the
 * render: the player and dashboard layouts send a stale session to login,
 * the auth layout sends a valid one to the dashboard, and the admin pages
 * check the role in their own layout.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  // Les onglets du joueur (app/(player)). Depuis la bascule (15-todo.md,
  // C19), un joueur qui ouvre /dashboard est renvoyé ici par le layout du
  // tableau de bord ; l'admin y reste.
  const isPlayerRoute = PLAYER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isPlayerRoute && !hasSession) {
    // L'écran demandé est gardé : après connexion, on y revient.
    return NextResponse.redirect(
      new URL(loginPathFor(`${pathname}${search}`), request.url),
    );
  }

  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // The dashboard layout needs the address too, to send a player from an
  // old screen to the one that replaces it (helpers/retired-routes.ts).
  if (isPlayerRoute || pathname.startsWith("/dashboard")) {
    const headers = new Headers(request.headers);
    headers.set(REQUESTED_PATH_HEADER, `${pathname}${search}`);
    return withLocaleCookie(
      request,
      NextResponse.next({ request: { headers } }),
    );
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
    "/ticket/:path*",
  ],
};
