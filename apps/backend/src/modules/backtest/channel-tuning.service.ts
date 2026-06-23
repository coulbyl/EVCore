import { Injectable } from '@nestjs/common';
import {
  getChannelStrategyConfig,
  GOALS_CONFIG,
} from '@modules/betting-engine/strategies/channel-strategy.config';
import { parseIsoDate, startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import {
  BacktestRepository,
  type ChannelTuningRow,
} from './backtest.repository';
import {
  buildChannelThresholdSweep,
  buildGoalsLineSweep,
} from './tuning.metrics';
import { GOALS_TUNING_SIDES, TUNING_CHANNELS } from './tuning.constants';
import type {
  ChannelTuningReport,
  ChannelTuningResponse,
  GoalsTuningReport,
} from './dto/backtest-tuning.dto';

function dateRange(from?: string, to?: string) {
  const today = new Date();
  const toDate = to
    ? endOfUtcDay(parseIsoDate(to))
    : endOfUtcDay(new Date(today.getTime() - 86_400_000));
  const fromDate = from
    ? startOfUtcDay(parseIsoDate(from))
    : startOfUtcDay(new Date(today.getTime() - 365 * 86_400_000));
  return {
    from: fromDate,
    to: toDate,
    fromIso: fromDate.toISOString().slice(0, 10),
    toIso: toDate.toISOString().slice(0, 10),
  };
}

/**
 * Offline threshold tuning for the config-driven channels (DOMINANT/DRAW/BTTS).
 * Sweeps candidate thresholds against settled history (read from
 * `model_run.features` + odds) and recommends a per-league threshold. It is the
 * value-driven replacement for the legacy grid search: it reads from the DB
 * instead of re-running the engine, and never auto-applies — a human edits
 * `CHANNEL_STRATEGY_CONFIG` from the recommendation.
 */
@Injectable()
export class ChannelTuningService {
  constructor(private readonly repo: BacktestRepository) {}

  async run(query: {
    from?: string;
    to?: string;
    competitionCode?: string;
  }): Promise<ChannelTuningResponse> {
    const range = dateRange(query.from, query.to);
    const rows = await this.repo.findChannelTuningRows({
      from: range.from,
      to: range.to,
      competitionCode: query.competitionCode,
    });

    const byComp = new Map<string, ChannelTuningRow[]>();
    for (const row of rows) {
      const list = byComp.get(row.competitionCode) ?? [];
      list.push(row);
      byComp.set(row.competitionCode, list);
    }

    const reports: ChannelTuningReport[] = [];
    const goalsReports: GoalsTuningReport[] = [];
    for (const [code, group] of byComp) {
      const competitionName = group[0]?.competitionName ?? code;
      for (const channel of TUNING_CHANNELS) {
        const sweep = buildChannelThresholdSweep(channel, group);
        if (sweep.candidates === 0) continue;
        const config = getChannelStrategyConfig(channel, code);
        reports.push({
          channel,
          competitionCode: code,
          competitionName,
          candidates: sweep.candidates,
          current: {
            enabled: config.enabled,
            threshold: config.threshold,
            minSampleN: config.minSampleN,
          },
          points: sweep.points,
          recommended: sweep.recommended,
        });
      }
      for (const side of GOALS_TUNING_SIDES) {
        const sweep = buildGoalsLineSweep(side, group);
        if (sweep.candidates === 0) continue;
        const current = GOALS_CONFIG[code]?.lines.find(
          (l) => l.line === sweep.line && l.side === side,
        );
        goalsReports.push({
          competitionCode: code,
          competitionName,
          line: sweep.line,
          side,
          candidates: sweep.candidates,
          current: current
            ? {
                enabled: current.enabled,
                threshold: current.threshold,
                minSampleN: current.minSampleN,
              }
            : null,
          points: sweep.points,
          recommended: sweep.recommended,
        });
      }
    }

    reports.sort(
      (a, b) =>
        a.channel.localeCompare(b.channel) ||
        a.competitionCode.localeCompare(b.competitionCode),
    );
    goalsReports.sort(
      (a, b) =>
        a.competitionCode.localeCompare(b.competitionCode) ||
        a.side.localeCompare(b.side),
    );

    return {
      from: range.fromIso,
      to: range.toIso,
      reports,
      goalsReports,
      generatedAt: new Date().toISOString(),
    };
  }
}
