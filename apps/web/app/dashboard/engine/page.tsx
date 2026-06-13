import { Page, PageContent } from "@evcore/ui";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { EnginePageClient } from "./components/engine-page-client";

export default async function EnginePage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <EnginePageClient />
      </PageContent>
    </Page>
  );
}
