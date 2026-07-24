import { Injectable } from '@nestjs/common';
import { FixtureStatus } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';

type FetchLegsInput = {
  homeTeamId: string;
  awayTeamId: string;
  fixtureDate: Date;
  limit?: number;
};

type ComputeH2HScoreInput = FetchLegsInput & {
  favoriteTeamId: string;
};

type H2HLeg = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

// docs/h2h-service-v2-plan.md §3.3 (v2.2) — per-market signals computed on
// the same H2H legs pool as computeH2HScore. Shadow only: logged in
// ModelRun.features, never read by decision logic (backtest-h2h-market-
// signals.ts, 2026-07-23 — 5/6 markets show a real out-of-sample Brier
// gain, BTTS is noise-level; activation needs a combined backtest against
// the already-active lambda correction to rule out double-counting the
// correlated result-based H2H signal before any of these feed a decision).
export type H2HMarketSignals = {
  btts: number | null;
  over25: number | null;
  cleanSheetHome: number | null;
  cleanSheetAway: number | null;
  winToNilHome: number | null;
  winToNilAway: number | null;
  sampleSize: number;
};

const H2H_LIMIT_DEFAULT = 5;
// docs/h2h-service-v2-plan.md §3.1 — n<3 is as "confident" as n=5, so gate it like TeamStats cold-start.
const H2H_MIN_SAMPLE = 3;
// Same decay convention as recentForm (rolling-stats.utils.ts) — most recent match weighted heaviest.
const H2H_DECAY = new Decimal('0.8');
const H2H_DRAW_SCORE = new Decimal('0.5');

@Injectable()
export class H2HService {
  constructor(private readonly prisma: PrismaService) {}

  async computeH2HScore(input: ComputeH2HScoreInput): Promise<number | null> {
    const { favoriteTeamId } = input;
    const legs = await this.fetchLegs(input);

    if (legs.length < H2H_MIN_SAMPLE) return null;

    let weightedSum = new Decimal(0);
    let weightTotal = new Decimal(0);
    legs.forEach((leg, i) => {
      const weight = H2H_DECAY.pow(i);
      const winnerTeamId =
        leg.homeScore > leg.awayScore
          ? leg.homeTeamId
          : leg.awayScore > leg.homeScore
            ? leg.awayTeamId
            : null;
      const outcomeScore =
        winnerTeamId === null
          ? H2H_DRAW_SCORE
          : new Decimal(winnerTeamId === favoriteTeamId ? 1 : 0);

      weightedSum = weightedSum.plus(weight.times(outcomeScore));
      weightTotal = weightTotal.plus(weight);
    });

    return weightedSum.div(weightTotal).toNumber();
  }

  async computeH2HMarketSignals(
    input: FetchLegsInput,
  ): Promise<H2HMarketSignals> {
    const { homeTeamId, awayTeamId } = input;
    const legs = await this.fetchLegs(input);

    if (legs.length < H2H_MIN_SAMPLE) {
      return {
        btts: null,
        over25: null,
        cleanSheetHome: null,
        cleanSheetAway: null,
        winToNilHome: null,
        winToNilAway: null,
        sampleSize: legs.length,
      };
    }

    const weightedRate = (indicator: (leg: H2HLeg) => Decimal): number => {
      let weightedSum = new Decimal(0);
      let weightTotal = new Decimal(0);
      legs.forEach((leg, i) => {
        const weight = H2H_DECAY.pow(i);
        weightedSum = weightedSum.plus(weight.times(indicator(leg)));
        weightTotal = weightTotal.plus(weight);
      });
      return weightedSum.div(weightTotal).toNumber();
    };

    return {
      btts: weightedRate(
        (leg) => new Decimal(leg.homeScore > 0 && leg.awayScore > 0 ? 1 : 0),
      ),
      over25: weightedRate(
        (leg) => new Decimal(leg.homeScore + leg.awayScore >= 3 ? 1 : 0),
      ),
      cleanSheetHome: weightedRate((leg) =>
        teamCleanSheetInLeg(leg, homeTeamId),
      ),
      cleanSheetAway: weightedRate((leg) =>
        teamCleanSheetInLeg(leg, awayTeamId),
      ),
      winToNilHome: weightedRate((leg) => teamWinToNilInLeg(leg, homeTeamId)),
      winToNilAway: weightedRate((leg) => teamWinToNilInLeg(leg, awayTeamId)),
      sampleSize: legs.length,
    };
  }

  private async fetchLegs(input: FetchLegsInput): Promise<H2HLeg[]> {
    const {
      homeTeamId,
      awayTeamId,
      fixtureDate,
      limit = H2H_LIMIT_DEFAULT,
    } = input;

    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        status: FixtureStatus.FINISHED,
        scheduledAt: { lt: fixtureDate },
        OR: [
          { homeTeamId, awayTeamId },
          { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
        ],
      },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
      },
      orderBy: { scheduledAt: 'desc' },
      take: limit,
    });

    return fixtures
      .filter(
        (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
      )
      .map((fixture) => ({
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeScore: fixture.homeScore as number,
        awayScore: fixture.awayScore as number,
      }));
  }
}

// "Clean sheet for teamId in this leg" — teamId's opponent scored 0,
// regardless of which side (home/away) teamId occupied in that past leg.
function teamCleanSheetInLeg(leg: H2HLeg, teamId: string): Decimal {
  const kept =
    leg.homeTeamId === teamId ? leg.awayScore === 0 : leg.homeScore === 0;
  return new Decimal(kept ? 1 : 0);
}

function teamWinToNilInLeg(leg: H2HLeg, teamId: string): Decimal {
  const won =
    leg.homeTeamId === teamId
      ? leg.homeScore > leg.awayScore && leg.awayScore === 0
      : leg.awayScore > leg.homeScore && leg.homeScore === 0;
  return new Decimal(won ? 1 : 0);
}
