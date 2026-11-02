import { Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import type {
  BetStatus,
  FixtureStatus,
  Market,
  ModelRunPhase,
} from '@evcore/db';
import {
  ChannelDecisionRepository,
  type PersistedChannelDecision,
} from './channel-decision.repository';
import {
  ChannelStrategyOrchestrator,
  createChannelStrategyOrchestrator,
} from '@evcore/analysis-core';
import type {
  ChannelDecisionStatus,
  StrategyChannel,
  StrategyContext,
} from './channel-strategy.types';
import {
  resolveSelectionEarlyResult,
  resolveSelectionFinalResult,
  type FixtureScores,
} from './channel-selection-settlement';
import { OddsClosingLineRepository } from './pricing/odds-closing-line.repository';
import { VantageHistoryRepository } from './vantage-history.repository';
import { resolveClosingLine } from './pricing/closing-line';
import { CLOSING_LINE_POLICY } from './pricing/closing-line.constants';
import type { SettleableSelectionRow } from './channel-decision.repository';

const logger = createLogger('channel-decision');

export type ChannelSelectionItem = {
  id: string;
  market: Market;
  pick: string;
  probability: number;
  odds: number | null;
  /** Book qui a servi `odds` (null avant le 2026-10-10). */
  oddsBookmaker: string | null;
  /** Marge payée sur le groupe d'issues de ce book, et meilleure marge du relevé (E-5/E-6). */
  marginPaid: number | null;
  marginBest: number | null;
  impliedProbability: number | null;
  /**
   * Fréquence affichée au joueur : probabilité du marché, marge payée
   * retirée (sinon la marge typique du marché). Remplace la probabilité du
   * moteur à l'écran, optimiste de 4 à 8 points (2026-10-28). Null sans cote.
   */
  marketProbability: number | null;
  ev: number | null;
  qualityScore: number | null;
  rank: number;
  result: BetStatus | null;
  settledAt: string | null;
  /**
   * Ligne de clôture (E-2) : cote du choix chez `closingBookmaker` juste
   * avant le coup d'envoi, et `closingLineValue` = odds × probabilité de
   * clôture sans marge − 1. Null tant que la sélection n'est pas réglée ou
   * qu'aucun book n'a coté le groupe complet à moins de 90 min.
   */
  closingOdds: number | null;
  closingBookmaker: string | null;
  closingLineValue: number | null;
  /**
   * Cote jouable : prix du choix chez le book de l'utilisateur
   * (`playableBookmaker`, 1xBet) quand il le cote, sinon le plus bas des
   * books relevés. Notre prix de référence (Bet365, Pinnacle) est le plus
   * généreux du relevé ; c'est celui-ci que l'utilisateur trouvera.
   */
  playableOdds: number | null;
  playableBookmaker: string | null;
};

// Normalised read shape (doc §5): one object per run × channel, REJECTED decisions
// included with their reasonCode, SELECTED ones carrying their selections.
export type ChannelDecisionItem = {
  id: string;
  fixtureId: string;
  fixtureStatus: FixtureStatus;
  modelRunId: string;
  competition: string | null;
  competitionName: string | null;
  country: string | null;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  // Informational only (coach-continuity.constants.ts) — true when that team
  // has played fewer than NEW_COACH_WINDOW_MATCHES finished matches under
  // its current coach as of this fixture. Never feeds scoring/EV.
  homeNewCoach: boolean;
  awayNewCoach: boolean;
  kickoff: string;
  scheduledAt: string;
  score: string | null;
  htScore: string | null;
  phase: ModelRunPhase;
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode: string | null;
  reasonDetails: unknown;
  // When this specific ChannelDecision was written — see
  // ChannelDecisionReadRow.createdAt. Not surfaced on the primaries' cards
  // today (their own ModelRun.phase already conveys "when"), but it's the
  // only accurate "decided at" for a later, separate pass like VANTAGE's.
  decidedAt: string;
  // Model↔market coherence gate flag on the underlying ModelRun — when true
  // the whole fixture is excluded from the staking pool.
  calibrationAlert: boolean;
  selections: ChannelSelectionItem[];
};

export type ChannelDecisionMatchDecision = Pick<
  ChannelDecisionItem,
  | 'id'
  | 'modelRunId'
  | 'phase'
  | 'channel'
  | 'status'
  | 'reasonCode'
  | 'reasonDetails'
  | 'decidedAt'
  | 'calibrationAlert'
  | 'selections'
>;

export type ChannelDecisionMatchItem = Pick<
  ChannelDecisionItem,
  | 'fixtureId'
  | 'fixtureStatus'
  | 'competition'
  | 'competitionName'
  | 'country'
  | 'homeTeam'
  | 'awayTeam'
  | 'homeLogo'
  | 'awayLogo'
  | 'homeNewCoach'
  | 'awayNewCoach'
  | 'kickoff'
  | 'scheduledAt'
  | 'score'
  | 'htScore'
> & {
  selectedCount: number;
  decisions: ChannelDecisionMatchDecision[];
};

export type ChannelDecisionChannelGroup = {
  channel: StrategyChannel;
  decisions: ChannelDecisionItem[];
};

export type ChannelDecisionListQuery = {
  date: string;
  competition?: string[];
  channel?: StrategyChannel[];
  market?: Market;
  status?: ChannelDecisionStatus;
  phase?: ModelRunPhase;
};

export type LeagueFacet = {
  code: string;
  name: string;
  country: string;
  count: number;
};

export type ChannelFacet = { channel: StrategyChannel; count: number };

export type ChannelDecisionFacets = {
  leagues: LeagueFacet[];
  channels: ChannelFacet[];
};

/**
 * Bridges the betting engine to the channel-strategy layer (doc §5): runs every
 * registered strategy over one immutable ModelRun's context and persists the
 * resulting per-channel decisions. Purely analytical — financial authority
 * stays with Bet.status.
 */
@Injectable()
export class ChannelDecisionService {
  private readonly orchestrator: ChannelStrategyOrchestrator;

  constructor(
    private readonly repository: ChannelDecisionRepository,
    private readonly closingLines: OddsClosingLineRepository,
    private readonly vantageHistory: VantageHistoryRepository,
  ) {
    this.orchestrator = createChannelStrategyOrchestrator();
  }

  async recordRunDecisions(
    modelRunId: string,
    context: StrategyContext,
  ): Promise<PersistedChannelDecision[]> {
    const decisions = this.orchestrator.evaluate(context);
    return this.repository.saveRunDecisions(modelRunId, decisions);
  }

  /**
   * Writes `ChannelSelection.result` for one fixture (doc §5). Analytical only —
   * Bet.status remains the financial authority. `early` settles only irrevocable
   * outcomes from the in-progress score; `final` re-settles everything from the
   * definitive score. Idempotent: a re-run yields the same result, so a selection
   * linked to a Bet is never double-counted on the financial side.
   */
  async settleFixtureSelections(opts: {
    fixtureId: string;
    scores: FixtureScores;
    mode: 'early' | 'final';
  }): Promise<{ settled: number }> {
    const { fixtureId, scores, mode } = opts;
    const selections = await this.repository.findSelectionsForFixture(
      fixtureId,
      { onlyUnsettled: mode === 'early' },
    );

    const updates: { id: string; result: BetStatus }[] = [];
    for (const selection of selections) {
      const result =
        mode === 'early'
          ? resolveSelectionEarlyResult(selection, scores)
          : resolveSelectionFinalResult(selection, scores);
      if (result === null) continue;
      updates.push({ id: selection.id, result });
    }

    await this.repository.applySelectionResults(updates);
    if (mode === 'final') {
      await this.recordSelectionClosingLines(fixtureId, selections);
      await this.settleVantageHistory(fixtureId, scores);
    }
    return { settled: updates.length };
  }

  /**
   * Les avis VANTAGE de l'historique figé, réglés sur le score final avec
   * les mêmes résolveurs que les sélections : c'est ce que lit le bilan de
   * l'IA (vantageCohortSql), jamais la ligne vivante. Rejouable.
   */
  private async settleVantageHistory(
    fixtureId: string,
    scores: FixtureScores,
  ): Promise<void> {
    const plays = await this.vantageHistory.findPlaysForFixture(fixtureId);
    await this.vantageHistory.applyResults(
      plays.map((play) => ({
        id: play.id,
        result: resolveSelectionFinalResult(play, scores),
      })),
    );
  }

  /**
   * Ligne de clôture et CLV de chaque sélection cotée d'une rencontre
   * terminée (chantier E, E-2), une seule fois par sélection : une sélection
   * déjà renseignée n'est pas relue, donc `settleRange` remplit l'historique
   * et reste idempotent. Même règle que les jambes de coupon : groupe d'issues
   * complet chez un book, observation à moins de 90 min, book de la sélection
   * de préférence (`oddsBookmaker`), sinon le mieux classé. Jamais bloquant.
   */
  private async recordSelectionClosingLines(
    fixtureId: string,
    selections: readonly SettleableSelectionRow[],
  ): Promise<void> {
    const pending = selections.filter(
      (selection) => selection.odds !== null && selection.closingOdds === null,
    );
    if (pending.length === 0) return;
    const rows = await this.closingLines.findClosingLines({
      fixtureIds: [fixtureId],
      markets: [...new Set(pending.map((selection) => selection.market))],
      maxHoursBeforeKickoff: CLOSING_LINE_POLICY.maxHoursBeforeKickoff,
    });
    if (rows.length === 0) return;

    const updates: Parameters<
      ChannelDecisionRepository['applySelectionClosingLines']
    >[0][number][] = [];
    for (const selection of pending) {
      if (selection.odds === null) continue;
      const closing = resolveClosingLine({
        market: selection.market,
        pick: selection.pick,
        takenOdds: selection.odds.toString(),
        preferredBookmaker: selection.oddsBookmaker,
        rows,
      });
      if (closing) updates.push({ id: selection.id, ...closing });
    }
    await this.repository.applySelectionClosingLines(updates);
  }

  /**
   * Catch-up: force final re-settlement of every ChannelSelection on every
   * FINISHED fixture in [from, to] — idempotent, safe to re-run. Mirrors
   * CouponSettlementService.settleRange (doc §5): use after a settlement
   * resolver bug fix, or when a fixture's score was corrected after it was
   * already settled, to self-correct without re-analysing the fixture.
   */
  async settleRange(
    from: Date,
    to: Date,
  ): Promise<{ fixturesResettled: number; selectionsResettled: number }> {
    const fixtures =
      await this.repository.findFinishedFixturesWithSelectionsInRange(from, to);
    logger.info(
      { from, to, fixtures: fixtures.length },
      'Force re-settling channel selections in range',
    );

    let selectionsResettled = 0;
    let processed = 0;
    for (const fixture of fixtures) {
      processed++;
      if (processed % 100 === 0) {
        logger.info(
          { processed, total: fixtures.length, selectionsResettled },
          'Channel selections re-settlement in progress',
        );
      }
      if (fixture.homeScore === null || fixture.awayScore === null) continue;
      const { settled } = await this.settleFixtureSelections({
        fixtureId: fixture.id,
        scores: {
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
          homeHtScore: fixture.homeHtScore,
          awayHtScore: fixture.awayHtScore,
        },
        mode: 'final',
      });
      selectionsResettled += settled;
    }

    logger.info(
      { fixturesResettled: fixtures.length, selectionsResettled },
      'Channel selections re-settlement done',
    );
    return { fixturesResettled: fixtures.length, selectionsResettled };
  }
}
