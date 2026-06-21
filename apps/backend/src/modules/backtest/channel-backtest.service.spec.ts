import { describe, expect, it } from 'vitest';
import { Prisma, StrategyChannel } from '@evcore/db';
import { ChannelBacktestService } from './channel-backtest.service';
import type {
  BacktestRepository,
  SettledChannelRow,
} from './backtest.repository';

const dec = (v: string) => new Prisma.Decimal(v);

function row(over: Partial<SettledChannelRow>): SettledChannelRow {
  return {
    channel: StrategyChannel.VALUE,
    competitionCode: 'PL',
    competitionName: 'Premier League',
    seasonName: '2024-25',
    probability: dec('0.5'),
    ev: dec('0.10'),
    odds: dec('2.0'),
    won: true,
    ...over,
  };
}

function stubRepo(rows: SettledChannelRow[]): BacktestRepository {
  return {
    findSettledChannelRows: () => Promise.resolve(rows),
  } as unknown as BacktestRepository;
}

describe('ChannelBacktestService.run', () => {
  it('groups by channel × competition and computes flat ROI', async () => {
    const rows = [
      row({ won: true }),
      row({ won: true }),
      row({ won: false }),
      row({ channel: StrategyChannel.DRAW, competitionCode: 'BL1', ev: null }),
    ];
    const res = await new ChannelBacktestService(stubRepo(rows)).run({});

    expect(res.reports).toHaveLength(2);
    const value = res.reports.find(
      (r) => r.channel === StrategyChannel.VALUE && r.competitionCode === 'PL',
    );
    if (!value) throw new Error('VALUE/PL report missing');
    expect(value.total).toBe(3);
    expect(value.won).toBe(2);
    expect(value.roi).toBeCloseTo((1 + 1 - 1) / 3, 10);
    // EV 0.10 → all three land in the 8–15% bin.
    expect(value.evBins.find((b) => b.label === '8–15%')?.total).toBe(3);
  });

  it('marks a channel below the minimum sample as INSUFFICIENT_DATA', async () => {
    const res = await new ChannelBacktestService(stubRepo([row({})])).run({});
    expect(res.reports[0]?.verdict).toBe('INSUFFICIENT_DATA');
  });

  it('fails a well-sampled channel whose ROI is below the floor', async () => {
    // 60 losing short-odds picks → ROI ≈ −1, below the floor.
    const rows = Array.from({ length: 60 }, () =>
      row({ won: false, odds: dec('1.5') }),
    );
    const res = await new ChannelBacktestService(stubRepo(rows)).run({});
    const [report] = res.reports;
    if (!report) throw new Error('no report');
    expect(report.total).toBe(60);
    expect(report.verdict).toBe('FAIL');
    expect(report.roi).toBeLessThan(res.roiFloor);
  });
});
