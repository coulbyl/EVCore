import { redirect } from "next/navigation";
import type { AuthSession } from "../types/auth";
import { getCurrentSession } from "./get-current-session";

/**
 * For pages only an admin may open. The backend refuses their data to
 * anyone else anyway; this sends a non-admin back to the dashboard instead
 * of showing an empty page.
 */
export async function requireAdmin(): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return session;
}
