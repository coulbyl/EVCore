import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/api/shared";

async function getSession(request: NextRequest) {
  const cookie = request.headers.get("cookie");

  if (!cookie) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { cookie },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      session: {
        sessionId: string;
        user: { id: string; role: "ADMIN" | "OPERATOR" };
      };
    };

    return payload.session;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getSession(request);
  const isAuthRoute = pathname.startsWith("/auth/");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAdminOnlyRoute =
    pathname.startsWith("/dashboard/audit") ||
    pathname.startsWith("/dashboard/glossaire");

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isDashboardRoute && !session) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (isAdminOnlyRoute && session?.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();
  if (!request.cookies.has("NEXT_LOCALE")) {
    const acceptLanguage = request.headers.get("accept-language") ?? "";
    const locale = acceptLanguage.startsWith("en") ? "en" : "fr";
    response.cookies.set("NEXT_LOCALE", locale, { path: "/", sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/auth/:path*", "/dashboard/:path*"],
};
