import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  homePathFor,
} from "@/domains/auth/routing/auth-routing";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";

/**
 * A signed-in visitor has nothing to do on the signed-out pages (login,
 * register, password recovery): to Aujourd'hui. The session is read only
 * when a cookie is there, and a stale cookie simply shows the page (the proxy
 * cannot tell, it makes no network call).
 *
 * `/auth/verify` stays outside this group: it is the step right after
 * registering, so its visitor is signed in by definition.
 */
export default async function SignedOutAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const hasCookie = (await cookies()).has(SESSION_COOKIE);
  const session = hasCookie ? await getCurrentSession() : null;
  if (session) redirect(homePathFor(session.user.role));
  return children;
}
