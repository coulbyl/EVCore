import { Page, PageContent } from "@evcore/ui";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { UsersPageClient } from "./users-page-client";

export default async function UsersAdminPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <UsersPageClient />
      </PageContent>
    </Page>
  );
}
