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
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CountCard label="Fixtures" value={overview.counts.fixtures} />
        <CountCard label="Model runs" value={overview.counts.modelRuns} />
        <CountCard label="Bets" value={overview.counts.bets} />
        <CountCard label="Coupons" value={overview.counts.coupons} />
      </div>

      <LeagueBreakdown rows={overview.leagueBreakdown} />

      <BetsBreakdown
        betsByStatus={overview.betsByStatus}
        betsByMarket={overview.betsByMarket}
        couponsByStatus={overview.couponsByStatus}
        settledBets={overview.settledBets}
        adjustmentProposals={overview.adjustmentProposals}
        activeSuspensions={overview.activeSuspensions}
      />
    </div>
  );
}
