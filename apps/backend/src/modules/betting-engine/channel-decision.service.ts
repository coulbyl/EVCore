import { Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import type { BetStatus } from '@evcore/db';
import {
  ChannelDecisionRepository,
  type PersistedChannelDecision,
} from './channel-decision.repository';
import {
  ChannelStrategyOrchestrator,
  createChannelStrategyOrchestrator,
} from '@evcore/analysis-core';
import type { StrategyContext } from './channel-strategy.types';
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
