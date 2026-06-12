import { Page, PageContent } from "@evcore/ui";
import { ChatPageClient } from "./components/chat-page-client";

// Auth is enforced by the dashboard layout.
export default function ChatPage() {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <ChatPageClient />
      </PageContent>
    </Page>
  );
}
