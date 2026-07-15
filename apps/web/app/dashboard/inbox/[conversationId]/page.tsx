import { Page, PageContent } from "@evcore/ui";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { SupportInboxClient } from "../components/support-inbox-client";

export default async function InboxConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/auth/login");
  }
  // Operators only ever have their own conversation — no per-id thread route
  // for them, unlike admins who navigate between many.
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/inbox");
  }

  const { conversationId } = await params;

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <SupportInboxClient activeConversationId={conversationId} />
      </PageContent>
    </Page>
  );
}
