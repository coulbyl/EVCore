import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { ModuleRef } from '@nestjs/core';
import type Redis from 'ioredis';
import type { AppSettingService } from './app-setting.service';
import {
  SWITCH_PAUSED_KEY,
  SchedulingSwitchService,
} from './scheduling-switch.service';

function queue(name: string, paused = false) {
  const state = { paused };
  return {
    name,
    isPaused: vi.fn(() => Promise.resolve(state.paused)),
    pause: vi.fn(() => {
      state.paused = true;
      return Promise.resolve();
    }),
    resume: vi.fn(() => {
      state.paused = false;
      return Promise.resolve();
    }),
  };
}

function harness(enabled: boolean, queues: ReturnType<typeof queue>[]) {
  const marked = new Set<string>();
  const redis = {
    sadd: vi.fn((_key: string, ...names: string[]) => {
      names.forEach((n) => marked.add(n));
      return Promise.resolve(names.length);
    }),
    smembers: vi.fn(() => Promise.resolve([...marked])),
    del: vi.fn(() => {
      marked.clear();
      return Promise.resolve(1);
    }),
  } as unknown as Redis;
  const byToken = new Map(queues.map((q) => [`BullQueue_${q.name}`, q]));
  const moduleRef = {
    get: vi.fn((token: string) => {
      const found = byToken.get(token);
      if (!found) throw new Error('no queue');
      return found;
    }),
  } as unknown as ModuleRef;
  const settings = {
    schedulingEnabled: vi.fn(() => Promise.resolve(enabled)),
  } as unknown as AppSettingService;
  const config = { get: vi.fn() } as unknown as ConfigService;
  const service = new SchedulingSwitchService(
    settings,
    moduleRef,
    redis,
    config,
  );
  return { service, redis, settings, marked };
}

describe('SchedulingSwitchService', () => {
  it('off: pauses the running queues, marks only those', async () => {
    const running = queue('league-sync');
    const alreadyPaused = queue('stats-backfill', true);
    const { service, marked } = harness(false, [running, alreadyPaused]);
    await service.apply();
    expect(running.pause).toHaveBeenCalledTimes(1);
    expect(alreadyPaused.pause).not.toHaveBeenCalled();
    expect([...marked]).toEqual(['league-sync']);
  });

  it('back on: resumes its own pauses, never one paused elsewhere', async () => {
    const running = queue('league-sync');
    const backfill = queue('stats-backfill', true);
    const off = harness(false, [running, backfill]);
    await off.service.apply();

    const on = harness(true, [running, backfill]);
    // Same Redis marker as the run that paused.
    off.marked.forEach((name) => on.marked.add(name));
    await on.service.apply();
    expect(running.resume).toHaveBeenCalledTimes(1);
    expect(backfill.resume).not.toHaveBeenCalled();
    expect(on.marked.size).toBe(0);
    expect(SWITCH_PAUSED_KEY).toBe('evcore:scheduling-switch:paused');
  });
});
