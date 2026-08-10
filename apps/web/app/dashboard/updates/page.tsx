import { Page, PageContent } from "@evcore/ui";
import { UpdatesPageClient } from "./components/updates-page-client";

export default function UpdatesPage() {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <UpdatesPageClient />
      </PageContent>
    </Page>
  );
}
