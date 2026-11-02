import { Injectable } from '@nestjs/common';
import { BetStatus, StrategyChannel } from '@evcore/db';
import Decimal from 'decimal.js';
import { toNumber } from '@utils/prisma.utils';
import { marketProbability } from '@evcore/analysis-core';
import { startOfUtcDay, endOfUtcDay, parseIsoDate } from '@utils/date.utils';
import { TRACKED_CHANNELS } from './dashboard.constants';
import { DashboardRepository } from './dashboard.repository';
import type {
  ChannelCompetitionStatItem,
  ChannelStatus,
} from './dashboard.types';

// Assez long pour couvrir les appels simultanés d'un chargement de page et un
// rafraîchissement rapide ; assez court pour qu'un nouveau règlement apparaisse
// sans redémarrage.
const SETTLED_CACHE_TTL_MS = 60_000;
const SETTLED_CACHE_MAX_ENTRIES = 6;

/**
 * Channel × competition calibration, read by the admin console's engine
 * screen. What is left of the old dashboard: its routes had no caller
 * since its pages were retired, and left on 2026-11-02.
 */
@Injectable()
export class DashboardService {
  /**
   * Mémoïsation courte des sélections réglées, par plage de dates. Sert
   * d'abord à collapser les trois appels simultanés d'un même chargement de
   * page en une seule requête — voir settledByChannel.
   */
  private readonly settledCache = new Map<
    string,
    {
      at: number;
      rows: Promise<Map<StrategyChannel, SelectionWithCompetition[]>>;
    }
  >();

  constructor(private readonly repo: DashboardRepository) {}

  private settledByChannel(range: {
    since: Date;
    until: Date;
  }): Promise<Map<StrategyChannel, SelectionWithCompetition[]>> {
    const key = `${range.since.toISOString()}..${range.until.toISOString()}`;
    const cached = this.settledCache.get(key);
    if (cached && Date.now() - cached.at < SETTLED_CACHE_TTL_MS) {
      return cached.rows;
    }

    const rows = this.loadSettledByChannel(range);
    if (this.settledCache.size >= SETTLED_CACHE_MAX_ENTRIES) {
      const oldest = [...this.settledCache.entries()].sort(
        (a, b) => a[1].at - b[1].at,
      )[0];
      if (oldest) this.settledCache.delete(oldest[0]);
    }
    this.settledCache.set(key, { at: Date.now(), rows });
    // Un échec ne doit pas rester en cache : la prochaine requête doit
    // retenter au lieu de resservir la promesse rejetée pendant tout le TTL.
    rows.catch(() => this.settledCache.delete(key));
    return rows;
  }

  private async loadSettledByChannel(range: {
    since: Date;
    until: Date;
  }): Promise<Map<StrategyChannel, SelectionWithCompetition[]>> {
    const rows = await this.repo.findChannelSelectionsInRange(
      TRACKED_CHANNELS,
      range,
    );
    const byChannel = new Map<StrategyChannel, SelectionWithCompetition[]>(
      TRACKED_CHANNELS.map((channel) => [channel, []]),
    );
    for (const row of rows) {
      byChannel.get(row.channelDecision.channel)?.push(row);
    }
    return byChannel;
  }

  /** Settled selections grouped by competition per channel. */
  async getChannelStatsByCompetition(
    from: string,
    to: string,
  ): Promise<ChannelCompetitionStatItem[]> {
    const range = {
      since: startOfUtcDay(parseIsoDate(from)),
      until: endOfUtcDay(parseIsoDate(to)),
    };
    const bySelection = await this.settledByChannel(range);

    return [...bySelection].flatMap(([channel, selections]) =>
      channelCompetitionStatsFromSelections(channel, selections),
    );
  }
}

// ---------------------------------------------------------------------------
// Channel-health pure helpers
// ---------------------------------------------------------------------------

function flatBetRoi(
  bets: { status: string; oddsSnapshot: { toString(): string } | null }[],
): number | null {
  if (!bets.length) return null;
  const returned = bets.reduce(
    (acc, b) =>
      acc +
      (b.status === 'WON' && b.oddsSnapshot
        ? parseFloat(b.oddsSnapshot.toString())
        : 0),
    0,
  );
  return ((returned - bets.length) / bets.length) * 100;
}

type FlatBet = { status: string; oddsSnapshot: { toString(): string } | null };

// Same floor CLAUDE.md/VANTAGE's own guardrail use for "poorly calibrated"
// (docs/vantage-centric-redesign-2026-09-01.md §4 point 3, §5.8) — ratio
// réel/annoncé below this is measured overconfident enough to distrust.
// Reused here for consistency: this page previously classified by ROI
// (§5.4 of that doc) even though DRAW was flagged "Négatif" on ROI while
// being one of only 2 channels with a genuinely positive calibration ratio
// after shrinkage (2026-08-22 audit) — the classification basis was wrong,
// not just this one channel's number.
const CALIBRATION_GOOD_RATIO = 0.85;
// A wider margin below GOOD before calling a channel outright unreliable
// rather than borderline — same asymmetric shape (a narrow middle band,
// no distinct tier above GOOD) as the ROI thresholds this replaces.
const CALIBRATION_BAD_RATIO = 0.7;

function calibrationStatus(
  ratio: number | null,
  sampleSize: number,
  minSample: number,
): ChannelStatus {
  if (sampleSize < minSample) return 'INSUFFICIENT_DATA';
  if (ratio === null) return 'INACTIVE';
  if (ratio >= CALIBRATION_GOOD_RATIO && ratio <= 2 - CALIBRATION_GOOD_RATIO)
    return 'GREEN';
  if (ratio >= CALIBRATION_BAD_RATIO && ratio <= 2 - CALIBRATION_BAD_RATIO)
    return 'ORANGE';
  return 'RED';
}

// hitRate ÷ average announced probability — same formula as VANTAGE's own
// context calibration (apps/vantage-worker/src/context/build-match-
// context.ts's loadChannelCalibration) and the admission philosophy
// documented in project memory feedback_admission_par_calibration: ratio
// réel/annoncé, never ROI.
function calibrationRatioOf(selections: SettledSelection[]): number | null {
  const hitRate = hitRateOf(selections);
  const avgProbability = announcedOf(selections);
  if (hitRate === null || avgProbability === null || avgProbability <= 0)
    return null;
  return hitRate / avgProbability;
}

/** Probabilité moyenne annoncée, 0–1 ; null sans sélection. */
function announcedOf(selections: SettledSelection[]): number | null {
  if (selections.length === 0) return null;
  return (
    selections.reduce((acc, s) => acc + toNumber(s.probability), 0) /
    selections.length
  );
}

/**
 * Fréquence du marché moyenne, 0–1 ; null sans sélection cotée. Somme en
 * Decimal, comme toute arithmétique de probabilités.
 */
function marketOf(selections: SettledSelection[]): number | null {
  const probabilities = selections
    .map((s) =>
      marketProbability({
        odds: s.odds === null ? null : toNumber(s.odds),
        market: s.market,
        marginPaid: s.marginPaid === null ? null : toNumber(s.marginPaid),
      }),
    )
    .filter((p): p is number => p !== null);
  if (probabilities.length === 0) return null;
  return probabilities
    .reduce((acc, p) => acc.plus(p), new Decimal(0))
    .dividedBy(probabilities.length)
    .toNumber();
}

// DOMINANT/BTTS/DRAW/GOALS settle via ChannelSelection.result rather than a
// materialised Bet (see DashboardRepository.findRecentChannelSelections) —
// reshape into the {status, oddsSnapshot} FlatBet shape so the same flat-stake
// math as VALUE/SAFE applies.
type SettledSelection = {
  // Schema-nullable, but the repository query filters to WON/LOST only.
  result: BetStatus | null;
  odds: { toString(): string } | null;
  probability: { toString(): string };
  market: string;
  marginPaid: { toString(): string } | null;
};

function asFlatBets(selections: SettledSelection[]): FlatBet[] {
  return selections.map((s) => ({
    status: s.result ?? '',
    oddsSnapshot: s.odds,
  }));
}

function hitRateOf(selections: SettledSelection[]): number | null {
  if (selections.length === 0) return null;
  const won = selections.filter((s) => s.result === BetStatus.WON).length;
  return won / selections.length;
}

type CompetitionRef = { code: string; name: string; country: string };

type SelectionWithCompetition = SettledSelection & {
  channelDecision: {
    modelRun: { fixture: { season: { competition: CompetitionRef } } };
  };
};

function groupByCompetition<T>(
  rows: T[],
  competitionOf: (row: T) => CompetitionRef,
): Map<string, { name: string; country: string; rows: T[] }> {
  const groups = new Map<
    string,
    { name: string; country: string; rows: T[] }
  >();
  for (const row of rows) {
    const { code, name, country } = competitionOf(row);
    const entry = groups.get(code);
    if (entry) entry.rows.push(row);
    else groups.set(code, { name, country, rows: [row] });
  }
  return groups;
}
function channelCompetitionStatsFromSelections(
  channel: ChannelCompetitionStatItem['channel'],
  selections: SelectionWithCompetition[],
): ChannelCompetitionStatItem[] {
  const groups = groupByCompetition(
    selections,
    (s) => s.channelDecision.modelRun.fixture.season.competition,
  );
  return Array.from(groups.entries()).map(
    ([competitionCode, { name, country, rows }]) => {
      const roi = flatBetRoi(asFlatBets(rows));
      const calibrationRatio = calibrationRatioOf(rows);
      return {
        channel,
        competitionCode,
        competitionName: name,
        competitionCountry: country,
        roi,
        hitRate: hitRateOf(rows),
        announced: announcedOf(rows),
        market: marketOf(rows),
        calibrationRatio,
        sampleSize: rows.length,
        status: calibrationStatus(calibrationRatio, rows.length, 30),
      };
    },
  );
}
