import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { AdminJournalService } from '@modules/admin-journal/admin-journal.service';
import type { AppSettingRepository } from '@modules/app-setting/app-setting.repository';
import type { DashboardService } from '@modules/dashboard/dashboard.service';
import type { EtlService } from '@modules/etl/etl.service';
import type { ResultsService } from '@modules/screens/results.service';
import { ConsoleEngineService } from './console-engine.service';
import { ConsolePassesService } from './console-passes.service';
import { ConsoleSettingsService } from './console-settings.service';
import type { ConsoleRepository } from './console.repository';

/** The human actions of the admin (12-admin.md § 1, § 2, § 4). */

const journal = () => ({ record: vi.fn(() => Promise.resolve()) });

/** A queue holding `active` jobs of `name`, nothing else. */
function queue(active: { name: string; createdAt: number }[] = []) {
  return {
    getJobs: vi.fn((states: string[]) =>
      Promise.resolve(
        states.includes('active')
          ? active.map((job) => ({
              name: job.name,
              timestamp: job.createdAt,
              processedOn: job.createdAt,
            }))
          : [],
      ),
    ),
    add: vi.fn(() => Promise.resolve()),
    getJobScheduler: vi.fn(() => Promise.resolve(null)),
  };
}

function passes(engineJobs: { name: string; createdAt: number }[] = []) {
  const etl = {
    triggerStatsSync: vi.fn(() => Promise.resolve()),
    triggerOddsPrematchSync: vi.fn(() => Promise.resolve()),
    triggerBettingEngineAnalysis: vi.fn(() => Promise.resolve()),
  };
  const log = journal();
  const q = () => queue() as unknown as Queue;
  const service = new ConsolePassesService(
    etl as unknown as EtlService,
    log as unknown as AdminJournalService,
    q(),
    q(),
    q(),
    q(),
    q(),
    queue(engineJobs) as unknown as Queue,
  );
  return { service, etl, log };
}

// 20:00 UTC: the 21:00 analysis is still waiting.
const NOW = new Date('2026-11-01T20:00:00Z');

describe('Relancer', () => {
  it('adds the same job as the schedule and journals who did it', async () => {
    const { service, etl, log } = passes();
    await service.relaunch({ key: 'analysis', actorId: 'u1', now: NOW });
    expect(etl.triggerBettingEngineAnalysis).toHaveBeenCalledTimes(1);
    expect(log.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u1',
        kind: 'pass_relaunched',
        target: 'analysis',
      }),
    );
  });

  it('refuses a pass that is running: never twice at once', async () => {
    const { service, etl, log } = passes([
      {
        name: 'betting-engine-analysis',
        createdAt: NOW.getTime() - 60_000,
      },
    ]);
    await expect(
      service.relaunch({ key: 'analysis', actorId: 'u1', now: NOW }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(etl.triggerBettingEngineAnalysis).not.toHaveBeenCalled();
    expect(log.record).not.toHaveBeenCalled();
  });

  it('refuses the morning brief, which writes to every player', async () => {
    const { service } = passes();
    await expect(
      service.relaunch({ key: 'morning_brief', actorId: 'u1', now: NOW }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses an unknown pass', async () => {
    const { service } = passes();
    await expect(
      service.relaunch({ key: 'nope', actorId: 'u1', now: NOW }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function settings() {
  const rows: {
    key: string;
    value: unknown;
    updatedAt: Date;
    updatedBy: string | null;
  }[] = [];
  const repository = {
    rows: vi.fn(() => Promise.resolve(rows)),
    write: vi.fn(
      ({ key, value }: { key: string; value: unknown; actorId: string }) => {
        const row = rows.find((r) => r.key === key);
        if (row) row.value = value;
        else rows.push({ key, value, updatedAt: NOW, updatedBy: 'Admin' });
        return Promise.resolve();
      },
    ),
  };
  const log = journal();
  const service = new ConsoleSettingsService(
    repository as unknown as AppSettingRepository,
    log as unknown as AdminJournalService,
  );
  return { service, repository, log };
}

describe('Réglages', () => {
  it('lists the five settings with their defaults when nothing is written', async () => {
    const { service } = settings();
    const list = await service.list();
    expect(list.map((s) => s.key)).toEqual([
      'llm.providers',
      'research',
      'apiFootball.quotaAlertPct',
      'statsBackfill.dailyReserve',
      'scheduling.enabled',
    ]);
    expect(list.every((s) => s.value === null)).toBe(true);
    expect(list.find((s) => s.key === 'scheduling.enabled')?.defaultValue).toBe(
      true,
    );
  });

  it('writes a valid value, read back at once, and journals before → after', async () => {
    const { service, log } = settings();
    const after = await service.set({
      key: 'apiFootball.quotaAlertPct',
      value: 85,
      actorId: 'u1',
    });
    expect(after.value).toBe(85);
    expect((await service.list())[2]?.value).toBe(85);
    expect(log.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'setting',
        target: 'apiFootball.quotaAlertPct',
        before: 80,
        after: 85,
      }),
    );
  });

  it('refuses a value its parser refuses, and writes nothing', async () => {
    const { service, repository, log } = settings();
    for (const value of [0, 101, 'abc', 85.5]) {
      await expect(
        service.set({ key: 'apiFootball.quotaAlertPct', value, actorId: 'u1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(
      service.set({
        key: 'llm.providers',
        value: { primary: 'openai' },
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.write).not.toHaveBeenCalled();
    expect(log.record).not.toHaveBeenCalled();
  });

  it('refuses an unknown key: no secret can be written through it', async () => {
    const { service } = settings();
    await expect(
      service.set({ key: 'RESEND_API_KEY', value: 'x', actorId: 'u1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Réactiver', () => {
  function engine(lifted: boolean) {
    const repository = {
      liftSuspension: vi.fn(() =>
        Promise.resolve(
          lifted
            ? {
                id: 's1',
                market: 'HALF_TIME_FULL_TIME',
                createdAt: NOW,
                reason: 'loss',
              }
            : null,
        ),
      ),
    };
    const log = journal();
    const service = new ConsoleEngineService(
      {} as ResultsService,
      repository as unknown as ConsoleRepository,
      {} as DashboardService,
      log as unknown as AdminJournalService,
    );
    return { service, log };
  }

  it('journals the market with the human reason', async () => {
    const { service, log } = engine(true);
    await service.reactivate({
      id: 's1',
      reason: 'relecture 90 j',
      actorId: 'u1',
    });
    expect(log.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'market_reactivated',
        target: 'HALF_TIME_FULL_TIME',
        reason: 'relecture 90 j',
      }),
    );
  });

  it('journals nothing when the suspension was already lifted', async () => {
    const { service, log } = engine(false);
    await expect(
      service.reactivate({ id: 's1', reason: 'x', actorId: 'u1' }),
    ).rejects.toThrow();
    expect(log.record).not.toHaveBeenCalled();
  });
});
