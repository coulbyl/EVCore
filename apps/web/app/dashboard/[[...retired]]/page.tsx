import { redirect } from "next/navigation";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { retiredRouteTarget } from "@/helpers/retired-routes";

/**
 * Every retired /dashboard address (12-admin.md § 0, 11-public.md § 8):
 * the nearest screen. Only the support inbox and the diagnostic sheet
 * are still pages here.
 */
export default async function RetiredPage({
  params,
}: {
  params: Promise<{ retired?: string[] }>;
}) {
  const [{ retired = [] }, session] = await Promise.all([
    params,
    getCurrentSession(),
  ]);
  if (!session) redirect("/auth/login");
  const path = ["/dashboard", ...retired].join("/");
  redirect(retiredRouteTarget(path, session.user.role) ?? "/admin");
}
