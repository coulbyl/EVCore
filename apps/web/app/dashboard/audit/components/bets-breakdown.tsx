import { StatList, TableCard } from "@evcore/ui";
import type { StatListItem } from "@evcore/ui";
import type { AuditOverview } from "@/domains/audit/types/audit";

export function BetsBreakdown({
  betsByStatus,
  betsByMarket,
  settledBets,
  adjustmentProposals,
  activeSuspensions,
}: Pick<
  AuditOverview,
  | "betsByStatus"
  | "betsByMarket"
  | "settledBets"
  | "adjustmentProposals"
  | "activeSuspensions"
>) {
  const learningItems: StatListItem[] = [
    {
      label: "Paris réglés",
      value: settledBets < 50 ? `${settledBets} / 50` : String(settledBets),
      tone: settledBets >= 50 ? "positive" : "warning",
    },
    {
      label: "Propositions",
      value: String(adjustmentProposals),
    },
    {
      label: "Suspensions actives",
      value: String(activeSuspensions),
      tone: activeSuspensions > 0 ? "negative" : "neutral",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <TableCard title="Paris par statut">
        <div className="p-4">
          <StatList
            items={betsByStatus.map((r) => ({
              label: r.status,
              value: r.count.toLocaleString(),
              mono: true,
            }))}
          />
        </div>
      </TableCard>

      <TableCard title="Paris par marché">
        <div className="p-4">
          <StatList
            items={betsByMarket.map((r) => ({
              label: r.market,
              value: r.count.toLocaleString(),
              mono: true,
            }))}
          />
        </div>
      </TableCard>

      <TableCard title="Boucle d'apprentissage">
        <div className="p-4">
          <StatList items={learningItems} />
        </div>
      </TableCard>
    </div>
  );
}
