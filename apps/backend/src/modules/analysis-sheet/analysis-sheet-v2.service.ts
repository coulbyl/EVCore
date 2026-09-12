// Assemblage du schéma v2 — orchestration seule, aucun calcul en propre.
//
// Additif par construction : la fiche v1 est produite d'abord, à l'identique,
// puis enrichie. Un consommateur v1 ne voit aucune différence.

import { Injectable } from '@nestjs/common';
import {
  H2H_GAMMA,
  LAMBDA_SHRINKAGE_FACTOR,
  getLeagueEvThreshold,
  getPickDirectionProbabilityThreshold,
  getPickEvFloor,
  getPickMaxSelectionOdds,
  getPickMinSelectionOdds,
} from '@modules/betting-engine/ev.constants';
import { buildLambdaConfig } from '@modules/betting-engine/math/probability';
import { extractEvaContextFromFeatures } from '@utils/model-run.utils';
import { buildSheetMetaV2 } from './analysis-sheet-v2.definitions';
import {
  AnalysisSheetV2Repository,
  type FinishedFixtureRow,
  type NearbyFixtureRow,
} from './analysis-sheet-v2.repository';
import type { AnalysisSheetFixture } from './analysis-sheet.repository';
import {
  buildCalibrationBlock,
  indexCalibration,
} from './calibration/calibration.builder';
import {
  buildH2HBlock,
  type H2HFixtureRow,
} from './context/h2h-context.builder';
import { buildStandingTable, standingFor } from './context/standing.builder';
import {
  buildTeamForm,
  buildTeamGoals,
  buildTeamSchedule,
  buildTeamXg,
  type NearbyFixture,
  type PriorFixture,
} from './context/team-context.builder';
import {
  buildLegPool,
  LEG_POOL_DEFAULTS,
  type LegPoolCandidate,
} from './leg-pool/leg-pool.builder';
import {
  buildDataCoverageDetail,
  buildLambdaTrace,
} from './model/lambda-trace.builder';
import {
  buildTargetMarketEvaluations,
  type EvaluatedPickInput,
  type PickGates,
} from './model/target-market.builder';
import {
  buildMarketQuotes,
  type BookmakerQuote,
} from './market/market-block.builder';
import {
  ABSENCE_REASONS,
  type CalibrationBlock,
  type FixtureContext,
  type LambdaTrace,
  type LegPool,
  type LegPoolFilters,
  type MarketQuote,
  type SheetMetaV2,
  type TargetMarketEvaluation,
  type TeamAvailability,
  type TeamContext,
  type TeamStanding,
  type DataCoverageDetail,
} from './analysis-sheet-v2.types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fenêtre ±4 jours pour la densité de calendrier (`context.schedule`). */
const SCHEDULE_WINDOW_MS = 4 * DAY_MS;
/** Même borne que TEAM_HISTORY_LIMIT côté SQL — garde les deux cohérents. */
const TEAM_HISTORY_LIMIT = 120;

/** Enrichissements v2 d'un match. */
export type FixtureV2Extras = {
  context: FixtureContext | null;
  contextReason: string | null;
  market: MarketQuote[];
  lambdaTrace: LambdaTrace;
  dataCoverageDetail: DataCoverageDetail;
  targetMarkets: TargetMarketEvaluation[];
};

export type V2BuildResult = {
  meta: SheetMetaV2;
  extrasByFixture: Map<string, FixtureV2Extras>;
  calibration: CalibrationBlock | null;
  legPool: LegPool | null;
};

export type V2BuildOptions = {
  /** Le contexte est coûteux : l'appelant le coupe sur les plages larges. */
  includeContext: boolean;
  includeCalibration: boolean;
  includeLegPool: boolean;
  legPoolFilters: LegPoolFilters;
};

/** Oriente un match du point de vue d'une équipe. */
function orient(row: FinishedFixtureRow, teamId: string): PriorFixture {
  const isHome = row.homeTeamId === teamId;
  return {
    fixtureId: row.fixtureId,
    scheduledAt: row.scheduledAt,
    competitionCode: row.competitionCode,
    competitionName: row.competitionName,
    seasonName: row.seasonName,
    isHome,
    goalsFor: isHome ? row.homeScore : row.awayScore,
    goalsAgainst: isHome ? row.awayScore : row.homeScore,
    htGoalsFor: isHome ? row.homeHtScore : row.awayHtScore,
    htGoalsAgainst: isHome ? row.awayHtScore : row.homeHtScore,
    xgFor: isHome ? row.homeXg : row.awayXg,
    xgAgainst: isHome ? row.awayXg : row.homeXg,
  };
}

function readNumber(source: unknown, key: string): number | null {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Blessés : uniquement des compteurs, et seulement sur ~19 % des analyses.
 * Aucun détail joueur n'existe en base — `players` est donc structurellement
 * null, avec son motif, plutôt qu'absent du schéma.
 */
function buildAvailability(
  features: unknown,
  side: 'home' | 'away',
): TeamAvailability {
  const injuries =
    features && typeof features === 'object'
      ? (features as Record<string, unknown>)['shadow_injuries']
      : null;
  const count = readNumber(injuries, side);

  return {
    injuryCount: count,
    reason: count === null ? ABSENCE_REASONS.NOT_COLLECTED : null,
    players: null,
    playersReason: ABSENCE_REASONS.NOT_COLLECTED,
  };
}

@Injectable()
export class AnalysisSheetV2Service {
  constructor(private readonly repository: AnalysisSheetV2Repository) {}

  async build(
    fixtures: readonly AnalysisSheetFixture[],
    options: V2BuildOptions,
  ): Promise<V2BuildResult> {
    const meta = buildSheetMetaV2();

    const [oddsByFixture, contextData, calibrationData] = await Promise.all([
      this.repository.getTargetMarketOdds(fixtures.map((f) => f.fixtureId)),
      options.includeContext
        ? this.loadContextData(fixtures)
        : Promise.resolve(null),
      options.includeCalibration
        ? this.loadCalibrationData()
        : Promise.resolve(null),
    ]);

    const extrasByFixture = new Map<string, FixtureV2Extras>();
    for (const fixture of fixtures) {
      extrasByFixture.set(
        fixture.fixtureId,
        this.buildExtras({
          fixture,
          quotes: oddsByFixture.get(fixture.fixtureId) ?? [],
          contextData,
        }),
      );
    }

    const calibration = calibrationData;
    const calibrationIndex = indexCalibration(
      calibration?.byMarketAndCompetition ?? [],
    );

    const legPool = options.includeLegPool
      ? buildLegPool({
          candidates: fixtures.map((fixture): LegPoolCandidate => {
            const extras = extrasByFixture.get(fixture.fixtureId);
            const coverage =
              extras?.dataCoverageDetail ??
              buildDataCoverageDetail(fixture.features);
            return {
              fixtureId: fixture.fixtureId,
              kickoff: fixture.scheduledAt.toISOString(),
              match: `${fixture.homeTeam} - ${fixture.awayTeam}`,
              competitionCode: fixture.competitionCode,
              status: fixture.status,
              coverageRatio: coverage.ratio,
              coverageLevel: coverage.level,
              flags: this.readFlags(fixture),
              targetMarkets: extras?.targetMarkets ?? [],
            };
          }),
          filters: options.legPoolFilters,
          calibrationIndex,
        })
      : null;

    return { meta, extrasByFixture, calibration, legPool };
  }

  /** Drapeaux du match, lus depuis les décisions et les features. */
  private readFlags(fixture: AnalysisSheetFixture): LegPoolCandidate['flags'] {
    const features =
      fixture.features && typeof fixture.features === 'object'
        ? (fixture.features as Record<string, unknown>)
        : {};
    const overUnder = features['calibration_alert_over_under'];

    return {
      avoid: fixture.selections.some(
        (s) => s.channel === 'AVOID' && s.decisionStatus === 'SELECTED',
      ),
      calibrationAlert:
        features['calibration_alert'] !== undefined &&
        features['calibration_alert'] !== null,
      calibrationAlertOverUnder:
        Array.isArray(overUnder) && overUnder.length > 0,
    };
  }

  private buildExtras(input: {
    fixture: AnalysisSheetFixture;
    quotes: readonly BookmakerQuote[];
    contextData: ContextData | null;
  }): FixtureV2Extras {
    const { fixture, quotes, contextData } = input;
    const evaContext = extractEvaContextFromFeatures(fixture.features);
    const lambdaConfig = buildLambdaConfig(fixture.competitionCode);

    const market = buildMarketQuotes({
      quotes,
      kickoff: fixture.scheduledAt,
    });

    const evaluatedPicks: EvaluatedPickInput[] = evaContext.evaluatedPicks.map(
      (pick) => ({
        market: pick.market,
        pick: pick.pick,
        probability: pick.probability,
        odds: pick.odds,
        ev: pick.ev,
        status: pick.status,
        rejectionReason: pick.rejectionReason,
      }),
    );

    const targetMarkets = buildTargetMarketEvaluations({
      evaluatedPicks,
      quotes: market,
      rawProbabilityFor: (marketName, pick) =>
        readRawProbability(evaContext.rawPoissonProbability, marketName, pick),
      gatesFor: (marketName, pick) =>
        this.resolveGates(fixture.competitionCode, marketName, pick),
    });

    return {
      context: contextData ? this.buildContext({ fixture, contextData }) : null,
      contextReason: contextData
        ? null
        : 'context désactivé pour cette plage — voir includeContext',
      market,
      lambdaTrace: buildLambdaTrace({
        features: fixture.features,
        config: {
          meanLambda: lambdaConfig.meanLambda,
          homeAdvFactor: lambdaConfig.homeAdvFactor,
          awayDisadvFactor: lambdaConfig.awayDisadvFactor,
          lambdaScale: lambdaConfig.lambdaScale ?? 1,
          shrinkageFactor: LAMBDA_SHRINKAGE_FACTOR,
        },
        gamma: H2H_GAMMA,
      }),
      dataCoverageDetail: buildDataCoverageDetail(fixture.features),
      targetMarkets,
    };
  }

  /** Seuils effectifs du moteur pour un (compétition, marché, pick). */
  private resolveGates(
    competitionCode: string,
    market: string,
    pick: string,
  ): PickGates {
    const leagueFloor = getLeagueEvThreshold(competitionCode);
    const maxOdds = getPickMaxSelectionOdds(competitionCode, market, pick);

    return {
      evFloor: getPickEvFloor(
        competitionCode,
        market,
        pick,
        leagueFloor,
      ).toNumber(),
      minOdds: getPickMinSelectionOdds(
        competitionCode,
        market,
        pick,
      ).toNumber(),
      maxOdds: maxOdds === null ? null : maxOdds.toNumber(),
      minProbability: getPickDirectionProbabilityThreshold(
        competitionCode,
        market,
        pick,
      ).toNumber(),
    };
  }

  private buildContext(input: {
    fixture: AnalysisSheetFixture;
    contextData: ContextData;
  }): FixtureContext {
    const { fixture, contextData } = input;
    const kickoff = fixture.scheduledAt;

    const teamContext = (team: {
      teamId: string;
      teamName: string;
      venue: 'HOME' | 'AWAY';
      side: 'home' | 'away';
    }): TeamContext => {
      const { teamId, teamName, venue, side } = team;
      const history = (contextData.historyByTeam.get(teamId) ?? [])
        .filter((row) => row.scheduledAt < kickoff)
        .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
        .slice(0, TEAM_HISTORY_LIMIT)
        .map((row) => orient(row, teamId));

      const nearby: NearbyFixture[] = (
        contextData.nearbyByTeam.get(teamId) ?? []
      )
        .filter((row) => row.fixtureId !== fixture.fixtureId)
        .map((row) => ({
          scheduledAt: row.scheduledAt,
          competitionCode: row.competitionCode,
        }));

      return {
        teamId,
        teamName,
        form: buildTeamForm(history, venue),
        goals: buildTeamGoals(
          history,
          contextData.seasonNameById.get(fixture.seasonId) ?? null,
        ),
        xg: buildTeamXg(history),
        standing: standingFor(
          contextData.standingBySeason.get(fixture.seasonId) ?? new Map(),
          teamId,
        ),
        schedule: buildTeamSchedule({
          kickoff,
          priorFixtures: history,
          nearbyFixtures: nearby,
          competitionCode: fixture.competitionCode,
        }),
        availability: buildAvailability(fixture.features, side),
      };
    };

    const evaContext = extractEvaContextFromFeatures(fixture.features);
    const probabilities =
      fixture.features && typeof fixture.features === 'object'
        ? (fixture.features as Record<string, unknown>)['probabilities']
        : null;

    return {
      home: teamContext({
        teamId: fixture.homeTeamId,
        teamName: fixture.homeTeam,
        venue: 'HOME',
        side: 'home',
      }),
      away: teamContext({
        teamId: fixture.awayTeamId,
        teamName: fixture.awayTeam,
        venue: 'AWAY',
        side: 'away',
      }),
      h2h: buildH2HBlock({
        rows:
          contextData.h2hByPair.get(
            `${fixture.homeTeamId}:${fixture.awayTeamId}`,
          ) ?? [],
        homeTeamId: fixture.homeTeamId,
        shadowH2h: evaContext.shadowH2h,
        shadowH2hSampleSize: readNumber(
          fixture.features,
          'shadow_h2h_sample_size',
        ),
        homeProbability: readNumber(probabilities, 'home'),
        awayProbability: readNumber(probabilities, 'away'),
      }),
    };
  }

  private async loadContextData(
    fixtures: readonly AnalysisSheetFixture[],
  ): Promise<ContextData> {
    const teamIds = [
      ...new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId])),
    ];
    const seasonIds = [...new Set(fixtures.map((f) => f.seasonId))];
    const kickoffs = fixtures.map((f) => f.scheduledAt.getTime());
    const latestKickoff = new Date(Math.max(...kickoffs));
    const earliestKickoff = new Date(Math.min(...kickoffs));

    const [history, nearby, h2hByPair, seasonFixtures] = await Promise.all([
      // Borne haute = coup d'envoi le plus tardif de l'export ; le filtre exact
      // par match est réappliqué en mémoire (`row.scheduledAt < kickoff`).
      this.repository.getFinishedFixturesForTeams({
        teamIds,
        before: latestKickoff,
      }),
      this.repository.getNearbyFixturesForTeams({
        teamIds,
        from: new Date(earliestKickoff.getTime() - SCHEDULE_WINDOW_MS),
        to: new Date(latestKickoff.getTime() + SCHEDULE_WINDOW_MS),
      }),
      this.repository.getH2HRows(
        fixtures.map((f) => ({
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          before: f.scheduledAt,
        })),
      ),
      this.repository.getSeasonFixturesBefore({
        seasonIds,
        before: latestKickoff,
      }),
    ]);

    const historyByTeam = new Map<string, FinishedFixtureRow[]>();
    for (const row of history) {
      for (const teamId of [row.homeTeamId, row.awayTeamId]) {
        const list = historyByTeam.get(teamId);
        if (list) list.push(row);
        else historyByTeam.set(teamId, [row]);
      }
    }

    const nearbyByTeam = new Map<string, NearbyFixtureRow[]>();
    for (const row of nearby) {
      for (const teamId of [row.homeTeamId, row.awayTeamId]) {
        const list = nearbyByTeam.get(teamId);
        if (list) list.push(row);
        else nearbyByTeam.set(teamId, [row]);
      }
    }

    const standingBySeason = new Map(
      [...seasonFixtures.entries()].map(([seasonId, rows]) => [
        seasonId,
        buildStandingTable(rows),
      ]),
    );

    const seasonNameById = new Map<string, string>();
    for (const row of history) {
      seasonNameById.set(row.seasonId, row.seasonName);
    }

    return {
      historyByTeam,
      nearbyByTeam,
      h2hByPair,
      standingBySeason,
      seasonNameById,
    };
  }

  private async loadCalibrationData(): Promise<CalibrationBlock> {
    const [rows, lambdaBiasRows, exclusions] = await Promise.all([
      this.repository.getCalibrationRows(),
      this.repository.getLambdaBiasRows(),
      this.repository.getCalibrationExclusions(),
    ]);

    return buildCalibrationBlock({
      rows,
      lambdaBiasRows,
      exclusions,
      settledThrough: new Date(),
    });
  }
}

type ContextData = {
  historyByTeam: Map<string, FinishedFixtureRow[]>;
  nearbyByTeam: Map<string, NearbyFixtureRow[]>;
  h2hByPair: Map<string, H2HFixtureRow[]>;
  standingBySeason: Map<string, Map<string, TeamStanding>>;
  seasonNameById: Map<string, string>;
};

export { LEG_POOL_DEFAULTS };

/**
 * Probabilité Poisson brute d'un (marché, pick) — même correspondance que
 * analysis-sheet.render.ts, restreinte aux marchés cibles.
 */
function readRawProbability(
  raw: Record<string, unknown> | null,
  market: string,
  pick: string,
): number | null {
  if (!raw) return null;
  const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  if (market === 'ONE_X_TWO') {
    if (pick === 'HOME') return num(raw.home);
    if (pick === 'AWAY') return num(raw.away);
    return null;
  }
  if (market === 'BTTS') {
    return pick === 'YES' ? num(raw.bttsYes) : null;
  }
  if (market === 'OVER_UNDER') {
    if (pick === 'OVER') return num(raw.over25);
    if (pick === 'OVER_1_5') return num(raw.over15);
    return null;
  }
  // TO_WIN_EITHER_HALF n'a pas d'équivalent dans l'export Poisson brut :
  // null plutôt qu'une valeur approchée.
  return null;
}
