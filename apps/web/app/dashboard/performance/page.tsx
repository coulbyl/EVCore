import { Page, PageContent } from "@evcore/ui";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { BacktestSection } from "./components/backtest-section";
import { CalibrationSection } from "./components/calibration-section";
import { CompetitionStatsSection } from "./components/competition-stats-section";
import { OverviewSection } from "./components/overview-section";
import { WeightsTimelineSection } from "./components/weights-timeline-section";

export default async function PerformancePage() {
  const session = await getCurrentSession();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          <OverviewSection />

          {isAdmin ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <CalibrationSection />
              <WeightsTimelineSection />
            </div>
          ) : null}

          <CompetitionStatsSection />
          <BacktestSection />
        </div>
      </PageContent>
    </Page>
  );
}
