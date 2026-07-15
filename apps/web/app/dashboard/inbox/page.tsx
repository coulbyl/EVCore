import { Page, PageContent } from "@evcore/ui";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { InboxPageClient } from "./components/inbox-page-client";
import { SupportInboxClient } from "./components/support-inbox-client";

export default async function InboxPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/auth/login");
  }

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        {session.user.role === "ADMIN" ? (
          <SupportInboxClient activeConversationId={null} />
        ) : (
          <InboxPageClient />
        )}
      </PageContent>
    </Page>
  );
}
