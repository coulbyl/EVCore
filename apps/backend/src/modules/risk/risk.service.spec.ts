import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { RiskService } from './risk.service';
import type { PrismaService } from '@/prisma.service';
import type { NotificationService } from '@modules/notification/notification.service';

function makePrismaMock(
  bets: { status: string; oddsSnapshot: { toString(): string } | null }[] = [],
  suspension: { id: string; active: boolean } | null = null,
): PrismaService {
  return {
    client: {
      bet: {
        findMany: vi.fn().mockResolvedValue(bets),
      },
      marketSuspension: {
        findFirst: vi.fn().mockResolvedValue(suspension),
        create: vi.fn().mockResolvedValue({ id: 'new-suspension' }),
      },
    },
  } as unknown as PrismaService;
}

function makeNotificationMock(): NotificationService {
  return {
    sendRoiAlert: vi.fn().mockResolvedValue(undefined),
    sendMarketSuspensionAlert: vi.fn().mockResolvedValue(undefined),
    sendBrierScoreAlert: vi.fn().mockResolvedValue(undefined),
    sendWeeklyReport: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
}

describe('RiskService.isMarketSuspended', () => {
  it('returns false when no active suspension exists', async () => {
    const service = new RiskService(makePrismaMock(), makeNotificationMock());
    expect(await service.isMarketSuspended(Market.ONE_X_TWO)).toBe(false);
  });

  it('returns true when an active suspension exists', async () => {
    const service = new RiskService(
      makePrismaMock([], { id: 'susp-1', active: true }),
      makeNotificationMock(),
    );
    expect(await service.isMarketSuspended(Market.ONE_X_TWO)).toBe(true);
  });
});

describe('RiskService.checkMarketRoi', () => {
  it('returns insufficient_data when fewer than 30 bets', async () => {
    const service = new RiskService(makePrismaMock([]), makeNotificationMock());
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.action).toBe('insufficient_data');
    expect(result.betCount).toBe(0);
  });

  it('returns ok when ROI is above alert threshold', async () => {
    // 30 winning bets at 2.0 → ROI = (1.0 * 30) / 30 = 1.0 (100% profit)
    const bets = Array.from({ length: 30 }, () => ({
      status: 'WON',
      oddsSnapshot: { toString: () => '2.0' },
    }));
    const service = new RiskService(
      makePrismaMock(bets),
      makeNotificationMock(),
    );
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.action).toBe('ok');
    expect(result.roi.toNumber()).toBeCloseTo(1.0, 4);
  });

  it('sends ROI alert when 30-bet ROI < -10%', async () => {
    // 30 losing bets → ROI = -1.0
    const bets = Array.from({ length: 30 }, () => ({
      status: 'LOST',
      oddsSnapshot: null,
    }));
    const notification = makeNotificationMock();
    const service = new RiskService(makePrismaMock(bets), notification);
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.action).toBe('alerted');
    expect(notification.sendRoiAlert).toHaveBeenCalledOnce();
    expect(notification.sendMarketSuspensionAlert).not.toHaveBeenCalled();
  });

  it('auto-suspends when 50-bet ROI < -15% and no existing suspension', async () => {
    const bets = Array.from({ length: 50 }, () => ({
      status: 'LOST',
      oddsSnapshot: null,
    }));
    const prisma = makePrismaMock(bets, null);
    const notification = makeNotificationMock();
    const service = new RiskService(prisma, notification);
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.action).toBe('suspended');
    expect(prisma.client.marketSuspension.create).toHaveBeenCalledOnce();
    expect(notification.sendMarketSuspensionAlert).toHaveBeenCalledOnce();
  });

  it('does not double-suspend an already suspended market', async () => {
    const bets = Array.from({ length: 50 }, () => ({
      status: 'LOST',
      oddsSnapshot: null,
    }));
    const prisma = makePrismaMock(bets, { id: 'existing', active: true });
    const notification = makeNotificationMock();
    const service = new RiskService(prisma, notification);
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.action).toBe('suspended');
    expect(prisma.client.marketSuspension.create).not.toHaveBeenCalled();
    expect(notification.sendMarketSuspensionAlert).not.toHaveBeenCalled();
  });
});

describe('RiskService.checkBrierScore', () => {
  it('sends alert when Brier score exceeds threshold (0.30)', async () => {
    const notification = makeNotificationMock();
    const service = new RiskService(makePrismaMock(), notification);
    await service.checkBrierScore('season-1', new Decimal('0.35'));
    expect(notification.sendBrierScoreAlert).toHaveBeenCalledWith(
      'season-1',
      0.35,
    );
  });

  it('does not send alert when Brier score is at or below threshold', async () => {
    const notification = makeNotificationMock();
    const service = new RiskService(makePrismaMock(), notification);
    await service.checkBrierScore('season-1', new Decimal('0.30'));
    expect(notification.sendBrierScoreAlert).not.toHaveBeenCalled();
  });

  it('does not send alert when Brier score is well below threshold', async () => {
    const notification = makeNotificationMock();
    const service = new RiskService(makePrismaMock(), notification);
    await service.checkBrierScore('season-1', new Decimal('0.20'));
    expect(notification.sendBrierScoreAlert).not.toHaveBeenCalled();
  });
});
