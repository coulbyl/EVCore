import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { redirect } from "next/navigation";
import { DashboardPageClientAdmin } from "./components/dashboard-page-client-admin";
import { DashboardPageClientOperator } from "./components/dashboard-page-client-operator";

export default async function Home() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login");
  }

  return session.user.role === "ADMIN" ? (
    <DashboardPageClientAdmin />
  ) : (
    <DashboardPageClientOperator />
  );
}
