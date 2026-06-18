/// <reference types="node" />
/**
 * Destructive analysis-data purge.
 *
 * Dry run:
 *   pnpm --filter @evcore/db db:purge:analysis
 *
 * Execute:
 *   pnpm --filter @evcore/db db:purge:analysis -- --confirm=PURGE_ANALYSIS_DATA
 *
 * This intentionally deletes generated analysis artifacts so ml-backfill can
 * rebuild ModelRun / ChannelDecision data from the new strategy model.
 */
import "dotenv/config";
import { prisma } from "../src/client";

const CONFIRM_FLAG = "--confirm=PURGE_ANALYSIS_DATA";

type TargetCounts = {
  bankrollTransactions: number;
  betSlipItems: number;
  betSlips: number;
  couponProposalLegs: number;
  couponProposals: number;
  bets: number;
  channelSelections: number;
  channelDecisions: number;
  modelRuns: number;
};

async function countTargets(): Promise<TargetCounts> {
  const [
    bankrollTransactions,
    betSlipItems,
    betSlips,
    couponProposalLegs,
    couponProposals,
    bets,
    channelSelections,
    channelDecisions,
    modelRuns,
  ] = await Promise.all([
    prisma.bankrollTransaction.count({ where: { betId: { not: null } } }),
    prisma.betSlipItem.count(),
    prisma.betSlip.count(),
    prisma.couponProposalLeg.count(),
    prisma.couponProposal.count(),
    prisma.bet.count(),
    prisma.channelSelection.count(),
    prisma.channelDecision.count(),
    prisma.modelRun.count(),
  ]);

  return {
    bankrollTransactions,
    betSlipItems,
    betSlips,
    couponProposalLegs,
    couponProposals,
    bets,
    channelSelections,
    channelDecisions,
    modelRuns,
  };
}

async function purgeAnalysisData(): Promise<TargetCounts> {
  return prisma.$transaction(
    async (tx) => {
      const bankrollTransactions = await tx.bankrollTransaction.deleteMany({
        where: { betId: { not: null } },
      });
      const betSlipItems = await tx.betSlipItem.deleteMany({});
      const betSlips = await tx.betSlip.deleteMany({});
      const couponProposalLegs = await tx.couponProposalLeg.deleteMany({});
      const couponProposals = await tx.couponProposal.deleteMany({});
      const bets = await tx.bet.deleteMany({});
      const channelSelections = await tx.channelSelection.deleteMany({});
      const channelDecisions = await tx.channelDecision.deleteMany({});
      const modelRuns = await tx.modelRun.deleteMany({});

      return {
        bankrollTransactions: bankrollTransactions.count,
        betSlipItems: betSlipItems.count,
        betSlips: betSlips.count,
        couponProposalLegs: couponProposalLegs.count,
        couponProposals: couponProposals.count,
        bets: bets.count,
        channelSelections: channelSelections.count,
        channelDecisions: channelDecisions.count,
        modelRuns: modelRuns.count,
      };
    },
    { timeout: 120_000 },
  );
}

function printCounts(title: string, counts: TargetCounts): void {
  console.log(title);
  console.table([
    {
      table: "bankroll_transaction (bet-linked)",
      rows: counts.bankrollTransactions,
    },
    { table: "bet_slip_item", rows: counts.betSlipItems },
    { table: "bet_slip", rows: counts.betSlips },
    { table: "coupon_proposal_leg", rows: counts.couponProposalLegs },
    { table: "coupon_proposal", rows: counts.couponProposals },
    { table: "bet", rows: counts.bets },
    { table: "channel_selection", rows: counts.channelSelections },
    { table: "channel_decision", rows: counts.channelDecisions },
    { table: "model_run", rows: counts.modelRuns },
  ]);
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes(CONFIRM_FLAG);
  const counts = await countTargets();

  if (!confirmed) {
    printCounts("Dry run: analysis data that would be deleted", counts);
    console.log(`\nPass ${CONFIRM_FLAG} to execute the purge.`);
    return;
  }

  printCounts("Deleting analysis data", counts);
  const deleted = await purgeAnalysisData();
  printCounts("Deleted rows", deleted);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
