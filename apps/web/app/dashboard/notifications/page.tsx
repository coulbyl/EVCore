import { Page, PageContent } from "@evcore/ui";
import { NotificationsPageClient } from "./components/notifications-page-client";

export default function NotificationsPage() {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="mb-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Centre
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            Notifications
          </h1>
        </div>
        <NotificationsPageClient />
      </PageContent>
    </Page>
  );
}
