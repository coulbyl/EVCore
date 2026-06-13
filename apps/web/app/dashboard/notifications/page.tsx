import { Bell } from "lucide-react";
import { Page, PageContent, PageHeader, PageHeaderTitle } from "@evcore/ui";
import { NotificationsPageClient } from "./components/notifications-page-client";

export default function NotificationsPage() {
  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="items-center gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-accent shadow-xs">
          <Bell size={16} />
        </span>
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Centre
          </p>
          <PageHeaderTitle className="text-base font-semibold tracking-tight sm:text-lg">
            Notifications
          </PageHeaderTitle>
        </div>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <NotificationsPageClient />
      </PageContent>
    </Page>
  );
}
