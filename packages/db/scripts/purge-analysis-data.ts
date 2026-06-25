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
 * This intentionally deletes generated analysis artifacts so the
 * betting-engine-rebuild ETL worker can rebuild ModelRun / ChannelDecision data
 * from the new strategy model (POST /etl/rebuild/betting-engine).
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
  //channelSelections: number;
  //channelDecisions: number;
  // Legacy table removed from the Prisma schema ("Remove legacy prediction
  // runtime") but still present in pulled prod DBs. Its RESTRICT FK on
  // model_run blocks the model_run delete, so it must be purged first.
  legacyPredictions: number;
  modelRuns: number;
};

async function countLegacyPredictions(): Promise<number> {
  // Raw query: the table is no longer in the Prisma schema. Returns 0 when the
  // table does not exist (fresh local DBs without the legacy table).
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "prediction"`,
    );
    return Number(rows[0]?.count ?? 0n);
  } catch {
    return 0;
  }
}

async function countTargets(): Promise<TargetCounts> {
  const [
    bankrollTransactions,
    betSlipItems,
    betSlips,
    couponProposalLegs,
    couponProposals,
    bets,
    //channelSelections,
   // channelDecisions,
    legacyPredictions,
    modelRuns,
  ] = await Promise.all([
    prisma.bankrollTransaction.count({ where: { betId: { not: null } } }),
    prisma.betSlipItem.count(),
    prisma.betSlip.count(),
    prisma.couponProposalLeg.count(),
    prisma.couponProposal.count(),
    prisma.bet.count(),
    //prisma.channelSelection.count(),
    //prisma.channelDecision.count(),
    countLegacyPredictions(),
    prisma.modelRun.count(),
  ]);

  return {
    bankrollTransactions,
    betSlipItems,
    betSlips,
    couponProposalLegs,
    couponProposals,
    bets,
    //channelSelections,
    //channelDecisions,
    legacyPredictions,
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
      //const channelSelections = await tx.channelSelection.deleteMany({});
      //const channelDecisions = await tx.channelDecision.deleteMany({});
      // Legacy table: must be deleted before model_run (RESTRICT FK). Raw query
      // since it is not part of the Prisma schema; tolerate absence.
      let legacyPredictions = 0;
      try {
        legacyPredictions = await tx.$executeRawUnsafe(
          `DELETE FROM "prediction"`,
        );
      } catch {
        legacyPredictions = 0;
      }
      const modelRuns = await tx.modelRun.deleteMany({});

      return {
        bankrollTransactions: bankrollTransactions.count,
        betSlipItems: betSlipItems.count,
        betSlips: betSlips.count,
        couponProposalLegs: couponProposalLegs.count,
        couponProposals: couponProposals.count,
        bets: bets.count,
        //channelSelections: channelSelections.count,
        //channelDecisions: channelDecisions.count,
        legacyPredictions,
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
   // { table: "channel_selection", rows: counts.channelSelections },
   // { table: "channel_decision", rows: counts.channelDecisions },
    { table: "prediction (legacy)", rows: counts.legacyPredictions },
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
