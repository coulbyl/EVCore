import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { redirect } from "next/navigation";
import { DashboardPageClient } from "./components/dashboard-page-client";

export default async function Home() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login");
  }

  return <DashboardPageClient isAdmin={session.user.role === "ADMIN"} />;
}
