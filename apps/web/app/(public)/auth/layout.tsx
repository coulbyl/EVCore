import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/domains/auth/routing/auth-routing";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";

/**
 * A signed-in visitor has nothing to do on the auth pages: to the dashboard.
 * The session is read only when a cookie is there, and a stale cookie simply
 * shows the page (the proxy cannot tell, it makes no network call).
 */
export default async function PublicAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const hasCookie = (await cookies()).has(SESSION_COOKIE);
  if (hasCookie && (await getCurrentSession())) {
    redirect("/dashboard");
  }
  return children;
}
