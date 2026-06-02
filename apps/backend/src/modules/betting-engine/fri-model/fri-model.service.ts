import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { isSeniorNationalTeam } from '../fri-elo.utils';
import type {
  HistoricalFriEloFixtureEntry,
  HistoricalFriEloFixtureInput,
  FriEloSnapshot,
  FriFixtureInput,
  FriModelComputation,
} from './fri-model.types';
import {
  buildFriPoissonModel,
  buildFriSupportedMarkets,
  computeFriDeterministicScore,
  devigOneXTwoOdds,
  eloProbabilities,
} from './fri-model.utils';

@Injectable()
export class FriModelService {
  constructor(private readonly prisma: PrismaService) {}

  async analyzeLiveFixture(
    input: FriFixtureInput,
  ): Promise<FriModelComputation> {
    const realEloSnapshot = await this.getLatestFriEloRatings();
    return this.buildComputation(input, {
      home: this.getRatingForTeam(realEloSnapshot.ratings, input.homeTeamName),
      away: this.getRatingForTeam(realEloSnapshot.ratings, input.awayTeamName),
      snapshotAt: realEloSnapshot.snapshotAt,
    });
  }

  analyzeHistoricalFixture(
    input: FriFixtureInput,
    eloEntry: HistoricalFriEloFixtureEntry | null,
  ): FriModelComputation {
    return this.buildComputation(input, eloEntry);
  }

  async loadHistoricalRatingsForFixtures(
    fixtures: HistoricalFriEloFixtureInput[],
  ): Promise<Map<string, HistoricalFriEloFixtureEntry>> {
    if (fixtures.length === 0) {
      return new Map<string, HistoricalFriEloFixtureEntry>();
    }

    const teamNames = Array.from(
      new Set(
        fixtures.flatMap((fixture) =>
          [fixture.homeTeamName, fixture.awayTeamName].filter(
            (name): name is string => name !== null,
          ),
        ),
      ),
    );
    if (teamNames.length === 0) {
      return new Map<string, HistoricalFriEloFixtureEntry>();
    }

    const latestFixtureDate = fixtures.reduce(
      (latest, fixture) =>
        fixture.scheduledAt.getTime() > latest.getTime()
          ? fixture.scheduledAt
          : latest,
      fixtures[0].scheduledAt,
    );
    const rows = await this.prisma.client.nationalTeamEloRating.findMany({
      where: {
        teamName: { in: teamNames },
        snapshotAt: { lte: latestFixtureDate },
      },
      select: { teamName: true, rating: true, snapshotAt: true },
      orderBy: [{ teamName: 'asc' }, { snapshotAt: 'desc' }],
    });

    const rowsByTeam = new Map<
      string,
      { rating: number; snapshotAt: Date }[]
    >();
    for (const row of rows) {
      const entries = rowsByTeam.get(row.teamName) ?? [];
      entries.push({ rating: row.rating, snapshotAt: row.snapshotAt });
      rowsByTeam.set(row.teamName, entries);
    }

    return new Map(
      fixtures.map((fixture) => {
        const homeEntry = this.findHistoricalRating(
          fixture.homeTeamName !== null
            ? (rowsByTeam.get(fixture.homeTeamName) ?? [])
            : [],
          fixture.scheduledAt,
        );
        const awayEntry = this.findHistoricalRating(
          fixture.awayTeamName !== null
            ? (rowsByTeam.get(fixture.awayTeamName) ?? [])
            : [],
          fixture.scheduledAt,
        );

        return [
          fixture.fixtureId,
          {
            home: homeEntry?.rating ?? null,
            away: awayEntry?.rating ?? null,
            snapshotAt: homeEntry?.snapshotAt ?? awayEntry?.snapshotAt ?? null,
          },
        ];
      }),
    );
  }

  private buildComputation(
    input: FriFixtureInput,
    eloEntry: HistoricalFriEloFixtureEntry | null,
  ): FriModelComputation {
    const isSenior =
      input.homeTeamName !== null &&
      input.awayTeamName !== null &&
      isSeniorNationalTeam(input.homeTeamName) &&
      isSeniorNationalTeam(input.awayTeamName);
    const eloHome = isSenior ? eloEntry?.home ?? null : null;
    const eloAway = isSenior ? eloEntry?.away ?? null : null;

    let predictionSource: FriModelComputation['predictionSource'] = null;
    let probabilities: FriModelComputation['probabilities'] = null;
    let lambda: FriModelComputation['lambda'] = null;
    let distHome: FriModelComputation['distHome'] = [];
    let distAway: FriModelComputation['distAway'] = [];
    let fallbackReason: string | null = null;

    if (eloHome !== null && eloAway !== null) {
      const oneXTwo = eloProbabilities(eloHome, eloAway);
      const goalModel = buildFriPoissonModel(oneXTwo);
      probabilities = goalModel.probabilities;
      lambda = goalModel.lambda;
      distHome = goalModel.distHome;
      distAway = goalModel.distAway;
      predictionSource = 'FRI_ELO_POISSON';
    } else if (input.pinnacleOdds !== null) {
      const oneXTwo = devigOneXTwoOdds(input.pinnacleOdds);
      const goalModel = buildFriPoissonModel(oneXTwo);
      probabilities = goalModel.probabilities;
      lambda = goalModel.lambda;
      distHome = goalModel.distHome;
      distAway = goalModel.distAway;
      predictionSource = 'ODDS_DEVIG';
    } else if (!input.hasMarketOdds) {
      fallbackReason = 'missing_market_odds';
    } else if (!isSenior) {
      fallbackReason = 'non_senior_fixture';
    } else if (eloHome === null || eloAway === null) {
      fallbackReason =
        eloHome === null && eloAway === null
          ? 'missing_both_elo_mappings'
          : eloHome === null
            ? 'missing_home_elo_mapping'
            : 'missing_away_elo_mapping';
    } else {
      fallbackReason = 'missing_reference_probs';
    }

    return {
      predictionSource,
      probabilities,
      deterministicScore: computeFriDeterministicScore(probabilities),
      lambda,
      distHome,
      distAway,
      supportedMarkets: buildFriSupportedMarkets(),
      metadata: {
        isSenior,
        eloHome,
        eloAway,
        fallbackReason,
        snapshotAt: eloEntry?.snapshotAt ?? null,
      },
    };
  }

  private getRatingForTeam(
    ratings: Map<string, number>,
    teamName: string | null,
  ): number | null {
    if (teamName === null) {
      return null;
    }

    return ratings.get(teamName) ?? null;
  }

  private findHistoricalRating(
    ratings: { rating: number; snapshotAt: Date }[],
    scheduledAt: Date,
  ): { rating: number; snapshotAt: Date } | null {
    return (
      ratings.find((entry) => entry.snapshotAt.getTime() <= scheduledAt.getTime()) ??
      null
    );
  }

  private async getLatestFriEloRatings(): Promise<FriEloSnapshot> {
    const latest = await this.prisma.client.nationalTeamEloRating.findFirst({
      select: { snapshotAt: true },
      orderBy: [{ snapshotAt: 'desc' }, { teamName: 'asc' }],
    });

    if (latest === null) {
      return { snapshotAt: null, ratings: new Map<string, number>() };
    }

    const rows = await this.prisma.client.nationalTeamEloRating.findMany({
      where: { snapshotAt: latest.snapshotAt },
      select: { teamName: true, rating: true },
      orderBy: { teamName: 'asc' },
    });

    return {
      snapshotAt: latest.snapshotAt,
      ratings: new Map(rows.map((row) => [row.teamName, row.rating])),
    };
  }
}
