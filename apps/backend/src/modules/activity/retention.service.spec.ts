import { describe, it, expect, vi } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '@/common/guards/admin.guard';
import { RetentionService } from './retention.service';
import type { RetentionRepository } from './retention.repository';
import { RetentionController } from './activity.controller';
import { DashboardController } from '@modules/dashboard/dashboard.controller';

describe('RetentionService', () => {
  it('turns counts into rates, null without a denominator', async () => {
    const repository = {
      findCohorts: vi.fn().mockResolvedValue([
        {
          week: new Date('2026-10-05'),
          signups: 10,
          activated: 4,
          d7Eligible: 10,
          d7Retained: 3,
          d14Eligible: 0,
          d14Retained: 0,
          d30Eligible: 0,
          d30Retained: 0,
        },
      ]),
      findActiveCounts: vi.fn().mockResolvedValue({ dau: 2, wau: 5, mau: 9 }),
      findEngagement: vi
        .fn()
        .mockResolvedValue({ weeklyActive: 5, followed: 2 }),
      findNotificationOpens: vi
        .fn()
        .mockResolvedValue([{ type: 'MORNING_BRIEF', sent: 20, opened: 7 }]),
    } as unknown as RetentionRepository;
    const view = await new RetentionService(repository).getRetention(
      new Date('2026-10-29T10:00:00Z'),
    );
    expect(view.cohorts[0]).toEqual({
      week: '2026-10-05',
      signups: 10,
      activation: 0.4,
      d7: { eligible: 10, rate: 0.3 },
      d14: { eligible: 0, rate: null },
      d30: { eligible: 0, rate: null },
    });
    expect(view.engagement).toEqual({
      weeklyActive: 5,
      followedRate: 0.4,
    });
    expect(view.notifications[0]?.rate).toBe(0.35);
  });
});

describe('admin-only measurement routes', () => {
  it('guards the retention controller with AdminGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, RetentionController)).toContain(
      AdminGuard,
    );
  });

  it.each(['getSummary', 'getCompetitionStats'] as const)(
    'guards dashboard %s with AdminGuard',
    (method) => {
      const handler = (
        DashboardController.prototype as unknown as Record<
          string,
          () => unknown
        >
      )[method];
      expect(handler).toBeDefined();
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
        AdminGuard,
      );
    },
  );
});
