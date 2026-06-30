import {
  Market as DbMarket,
  StrategyChannel as DbStrategyChannel,
  ChannelDecisionStatus as DbChannelDecisionStatus,
  ModelRunPhase as DbModelRunPhase,
  SportType as DbSportType,
  BetStatus as DbBetStatus,
} from '@evcore/db';
import {
  Market as CoreMarket,
  STRATEGY_CHANNEL as CoreStrategyChannel,
  CHANNEL_DECISION_STATUS as CoreChannelDecisionStatus,
  MODEL_RUN_PHASE as CoreModelRunPhase,
  SPORT_TYPE as CoreSportType,
  BetStatus as CoreBetStatus,
} from '@evcore/analysis-core';
import type {
  Market as CoreMarketT,
  StrategyChannel as CoreStrategyChannelT,
  ChannelDecisionStatus as CoreChannelDecisionStatusT,
  ModelRunPhase as CoreModelRunPhaseT,
  SportType as CoreSportTypeT,
  BetStatus as CoreBetStatusT,
} from '@evcore/analysis-core';
import { describe, expect, it } from 'vitest';

// analysis-core OWNS the domain enums (dependency inversion); Prisma persists
// them. The two must stay byte-identical. This file is the single anti-drift
// guard required by the architecture decision (lab.md §2-bis):
//
//   1. COMPILE-TIME — `AssertEqual` fails `tsc` if either union gains/loses a
//      member, so a `schema.prisma` change unmatched in analysis-core (or the
//      reverse) breaks the build before anything runs.
//   2. RUNTIME — the deep-equality assertions below catch value/key drift even
//      where the string types alone would still line up.
type AssertEqual<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;

// Each line must stay assignable to `true`; a divergence collapses it to `never`.
const _market: AssertEqual<DbMarket, CoreMarketT> = true;
const _strategyChannel: AssertEqual<DbStrategyChannel, CoreStrategyChannelT> =
  true;
const _channelDecisionStatus: AssertEqual<
  DbChannelDecisionStatus,
  CoreChannelDecisionStatusT
> = true;
const _modelRunPhase: AssertEqual<DbModelRunPhase, CoreModelRunPhaseT> = true;
const _sportType: AssertEqual<DbSportType, CoreSportTypeT> = true;
const _betStatus: AssertEqual<DbBetStatus, CoreBetStatusT> = true;

void _market;
void _strategyChannel;
void _channelDecisionStatus;
void _modelRunPhase;
void _sportType;
void _betStatus;

describe('domain enum conformance (Prisma ↔ analysis-core)', () => {
  it.each([
    ['Market', DbMarket, CoreMarket],
    ['StrategyChannel', DbStrategyChannel, CoreStrategyChannel],
    [
      'ChannelDecisionStatus',
      DbChannelDecisionStatus,
      CoreChannelDecisionStatus,
    ],
    ['ModelRunPhase', DbModelRunPhase, CoreModelRunPhase],
    ['SportType', DbSportType, CoreSportType],
    ['BetStatus', DbBetStatus, CoreBetStatus],
  ] as const)(
    '%s has identical members in both packages',
    (_name, db, core) => {
      expect(core).toEqual(db);
    },
  );
});
