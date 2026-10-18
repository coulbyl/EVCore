import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { RiskService } from './risk.service';
import type { RiskRepository, SettledLegRow } from './risk.repository';
import type { PrismaService } from '@/prisma.service';
import type { NotificationService } from '@modules/notification/notification.service';

function makePrismaMock(
  suspension: { id: string; active: boolean } | null = null,
): PrismaService {
  return {
    client: {
      bet: { findMany: vi.fn().mockResolvedValue([]) },
      marketSuspension: {
        findFirst: vi.fn().mockResolvedValue(suspension),
        create: vi.fn().mockResolvedValue({ id: 'new-suspension' }),
      },
    },
  } as unknown as PrismaService;
}

function makeRepositoryMock(
  legs: SettledLegRow[] = [],
  alertedRecently = false,
): RiskRepository {
  return {
    findSettledLegs: vi.fn().mockResolvedValue(legs),
    hasRoiAlertSince: vi.fn().mockResolvedValue(alertedRecently),
  } as unknown as RiskRepository;
}

const won = (odds: number): SettledLegRow => ({ result: 'WON', odds });
const lost = (odds = 2): SettledLegRow => ({ result: 'LOST', odds });

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
    const service = new RiskService(
      makePrismaMock(),
      makeNotificationMock(),
      makeRepositoryMock(),
    );
    expect(await service.isMarketSuspended(Market.ONE_X_TWO)).toBe(false);
  });

  it('returns true when an active suspension exists', async () => {
    const service = new RiskService(
      makePrismaMock({ id: 'susp-1', active: true }),
      makeNotificationMock(),
      makeRepositoryMock(),
    );
    expect(await service.isMarketSuspended(Market.ONE_X_TWO)).toBe(true);
  });
});

describe('RiskService.checkMarketRoi', () => {
  it('returns insufficient_data under 30 settled legs', async () => {
    const service = new RiskService(
      makePrismaMock(),
      makeNotificationMock(),
      makeRepositoryMock([]),
    );
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.action).toBe('insufficient_data');
    expect(result.betCount).toBe(0);
  });

  it('returns ok when the window ROI is above the alert threshold', async () => {
    const legs = Array.from({ length: 30 }, () => won(2));
    const service = new RiskService(
      makePrismaMock(),
      makeNotificationMock(),
      makeRepositoryMock(legs),
    );
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.action).toBe('ok');
    expect(result.roi.toNumber()).toBeCloseTo(1.0, 4);
    expect(result.standardError.toNumber()).toBe(0);
  });

  it('sends one ROI alert when 30+ legs are under -10%, then stays quiet for the cooldown', async () => {
    const legs = Array.from({ length: 30 }, () => lost());
    const notification = makeNotificationMock();
    const first = new RiskService(
      makePrismaMock(),
      notification,
      makeRepositoryMock(legs),
    );
    expect((await first.checkMarketRoi(Market.ONE_X_TWO)).action).toBe(
      'alerted',
    );
    expect(notification.sendRoiAlert).toHaveBeenCalledOnce();
    expect(notification.sendMarketSuspensionAlert).not.toHaveBeenCalled();

    const second = new RiskService(
      makePrismaMock(),
      notification,
      makeRepositoryMock(legs, true),
    );
    expect((await second.checkMarketRoi(Market.ONE_X_TWO)).action).toBe(
      'alerted',
    );
    expect(notification.sendRoiAlert).toHaveBeenCalledOnce();
  });

  it('auto-suspends when 50+ legs sit under -15% with the loss established', async () => {
    // 20 won at 2.0, 40 lost: ROI = (20 − 40) / 60 = −0.333, SE ≈ 0.12.
    const legs = [
      ...Array.from({ length: 20 }, () => won(2)),
      ...Array.from({ length: 40 }, () => lost()),
    ];
    const prisma = makePrismaMock(null);
    const notification = makeNotificationMock();
    const service = new RiskService(
      prisma,
      notification,
      makeRepositoryMock(legs),
    );
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.action).toBe('suspended');
    expect(result.roi.toNumber()).toBeCloseTo(-1 / 3, 4);
    expect(prisma.client.marketSuspension.create).toHaveBeenCalledOnce();
    expect(notification.sendMarketSuspensionAlert).toHaveBeenCalledOnce();
  });

  it('only alerts when the ROI is under -15% but not established (noise)', async () => {
    // 10 won at 5.0, 50 lost: ROI = (40 − 50) / 60 = −0.167, but the
    // standard error is ≈ 0.29 — the 95 % upper bound sits above zero.
    const legs = [
      ...Array.from({ length: 10 }, () => won(5)),
      ...Array.from({ length: 50 }, () => lost()),
    ];
    const prisma = makePrismaMock(null);
    const notification = makeNotificationMock();
    const service = new RiskService(
      prisma,
      notification,
      makeRepositoryMock(legs),
    );
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.roi.toNumber()).toBeLessThan(-0.15);
    expect(result.action).toBe('alerted');
    expect(prisma.client.marketSuspension.create).not.toHaveBeenCalled();
  });

  it('does not double-suspend an already suspended market', async () => {
    const legs = Array.from({ length: 50 }, () => lost());
    const prisma = makePrismaMock({ id: 'existing', active: true });
    const notification = makeNotificationMock();
    const service = new RiskService(
      prisma,
      notification,
      makeRepositoryMock(legs),
    );
    const result = await service.checkMarketRoi(Market.ONE_X_TWO);
    expect(result.action).toBe('suspended');
    expect(prisma.client.marketSuspension.create).not.toHaveBeenCalled();
    expect(notification.sendMarketSuspensionAlert).not.toHaveBeenCalled();
  });
});

describe('RiskService.checkBrierScore', () => {
  it('sends alert when Brier score exceeds threshold (0.30)', async () => {
    const notification = makeNotificationMock();
    const service = new RiskService(
      makePrismaMock(),
      notification,
      makeRepositoryMock(),
    );
    await service.checkBrierScore('season-1', new Decimal('0.35'));
    expect(notification.sendBrierScoreAlert).toHaveBeenCalledWith(
      'season-1',
      0.35,
    );
  });

  it('does not send alert when Brier score is at or below threshold', async () => {
    const notification = makeNotificationMock();
    const service = new RiskService(
      makePrismaMock(),
      notification,
      makeRepositoryMock(),
    );
    await service.checkBrierScore('season-1', new Decimal('0.30'));
    expect(notification.sendBrierScoreAlert).not.toHaveBeenCalled();
  });

  it('does not send alert when Brier score is well below threshold', async () => {
    const notification = makeNotificationMock();
    const service = new RiskService(
      makePrismaMock(),
      notification,
      makeRepositoryMock(),
    );
    await service.checkBrierScore('season-1', new Decimal('0.20'));
    expect(notification.sendBrierScoreAlert).not.toHaveBeenCalled();
  });
});
