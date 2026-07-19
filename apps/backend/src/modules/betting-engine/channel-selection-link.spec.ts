import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { findChannelSelectionId } from './betting-engine.service';
import type { PersistedChannelDecision } from './channel-decision.repository';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
} from './channel-strategy.types';

function persisted(): PersistedChannelDecision[] {
  return [
    {
      id: 'cd-ev',
      channel: STRATEGY_CHANNEL.VALUE,
      status: CHANNEL_DECISION_STATUS.SELECTED,
      selections: [
        {
          id: 'sel-ev',
          market: Market.ONE_X_TWO,
          pick: 'HOME',
          probability: new Decimal('0.6'),
          rank: 1,
        },
      ],
    },
    {
      id: 'cd-safe',
      channel: STRATEGY_CHANNEL.SAFE,
      status: CHANNEL_DECISION_STATUS.REJECTED,
      selections: [],
    },
  ];
}

describe('findChannelSelectionId', () => {
  it('returns the selection id when the bet pick matches the channel selection', () => {
    expect(
      findChannelSelectionId(persisted(), STRATEGY_CHANNEL.VALUE, {
        market: Market.ONE_X_TWO,
        pick: 'HOME',
      }),
    ).toBe('sel-ev');
  });

  it('returns null when the channel produced no selection', () => {
    expect(
      findChannelSelectionId(persisted(), STRATEGY_CHANNEL.SAFE, {
        market: Market.OVER_UNDER,
        pick: 'UNDER',
      }),
    ).toBeNull();
  });

  it('returns null when the channel is absent from the decisions', () => {
    expect(
      findChannelSelectionId(persisted(), STRATEGY_CHANNEL.DRAW, {
        market: Market.ONE_X_TWO,
        pick: 'DRAW',
      }),
    ).toBeNull();
  });

  it('returns null when the live pick diverges from the strategy selection', () => {
    expect(
      findChannelSelectionId(persisted(), STRATEGY_CHANNEL.VALUE, {
        market: Market.ONE_X_TWO,
        pick: 'AWAY',
      }),
    ).toBeNull();
  });
});
