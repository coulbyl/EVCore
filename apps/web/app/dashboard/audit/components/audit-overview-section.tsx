import type { AuditOverview } from "@/domains/audit/types/audit";
import { CountCard } from "./count-card";
import { LeagueBreakdown } from "./league-breakdown";
import { BetsBreakdown } from "./bets-breakdown";

export function AuditOverviewSection({
  overview,
}: {
  overview: AuditOverview;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CountCard label="Matchs" value={overview.counts.fixtures} />
        <CountCard label="Analyses" value={overview.counts.modelRuns} />
        <CountCard label="Paris" value={overview.counts.bets} />
        <CountCard label="Paris réglés" value={overview.settledBets} />
      </div>

      <LeagueBreakdown rows={overview.leagueBreakdown} />

      <BetsBreakdown
        betsByStatus={overview.betsByStatus}
        betsByMarket={overview.betsByMarket}
        settledBets={overview.settledBets}
        adjustmentProposals={overview.adjustmentProposals}
        activeSuspensions={overview.activeSuspensions}
      />
    </div>
  );
}
