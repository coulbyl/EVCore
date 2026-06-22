import { Page, PageContent } from "@evcore/ui";
import { ChannelAnalysisSection } from "./components/channel-analysis-section";
import { OverviewSection } from "./components/overview-section";

export default async function PerformancePage() {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          <OverviewSection />
          <ChannelAnalysisSection />
        </div>
      </PageContent>
    </Page>
  );
}
