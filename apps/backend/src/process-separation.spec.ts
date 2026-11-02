import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { DynamicModule, Type } from '@nestjs/common';
import { PROCESSOR_METADATA } from '@nestjs/bullmq/dist/bull.constants';
import { AppModule } from './app.module';
import { WorkerModule } from './worker.module';

// `ConfigModule.forRoot` validates the environment as soon as the module is
// defined, and CI has no `.env`: only the module graph is under test here.
vi.mock('./config/env.schema', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./config/env.schema')>()),
  validateEnv: (config: Record<string, unknown>) => config,
}));

type ModuleGraph = {
  providers: Set<Type>;
  controllers: Set<string>;
};

function isDynamicModule(ref: object): ref is DynamicModule {
  return 'module' in ref && typeof ref.module === 'function';
}

function readArray(key: string, target: object): unknown[] {
  const value: unknown = Reflect.getMetadata(key, target);
  return Array.isArray(value) ? value : [];
}

function providerClass(provider: unknown): Type | null {
  if (typeof provider === 'function') return provider as Type;
  if (provider && typeof provider === 'object' && 'useClass' in provider) {
    const { useClass } = provider as { useClass: unknown };
    return typeof useClass === 'function' ? (useClass as Type) : null;
  }
  return null;
}

/** Every provider class and controller reachable from `root`'s imports. */
function collectGraph(root: Type): ModuleGraph {
  const graph: ModuleGraph = { providers: new Set(), controllers: new Set() };
  const seen = new Set<unknown>();
  const visit = (ref: unknown): void => {
    if (!ref || ref instanceof Promise) return;
    if (typeof ref === 'object' && 'forwardRef' in ref) {
      visit((ref as { forwardRef: () => unknown }).forwardRef());
      return;
    }
    const dynamic =
      typeof ref === 'object' && isDynamicModule(ref) ? ref : null;
    const moduleClass = dynamic
      ? dynamic.module
      : typeof ref === 'function'
        ? ref
        : null;
    if (!moduleClass) return;
    const key = dynamic ?? moduleClass;
    if (seen.has(key)) return;
    seen.add(key);
    for (const provider of [
      ...readArray('providers', moduleClass),
      ...(dynamic?.providers ?? []),
    ]) {
      const cls = providerClass(provider);
      if (cls) graph.providers.add(cls);
    }
    for (const controller of readArray('controllers', moduleClass)) {
      if (typeof controller === 'function') {
        graph.controllers.add(controller.name);
      }
    }
    for (const imported of [
      ...readArray('imports', moduleClass),
      ...(dynamic?.imports ?? []),
    ]) {
      visit(imported);
    }
  };
  visit(root);
  return graph;
}

const isConsumer = (cls: Type) =>
  Reflect.getMetadata(PROCESSOR_METADATA, cls) !== undefined;
// A recurring schedule: upserts a BullMQ job scheduler, or a timer.
const isScheduler = (cls: Type) => /Scheduler$/.test(cls.name);

describe('process separation (worker.module.ts)', () => {
  it('keeps the API free of queue consumers and schedules', () => {
    const api = collectGraph(AppModule);
    // The walk reached the API's modules: not an empty graph passing by default.
    expect(api.controllers).toContain('TodayController');
    expect([...api.providers].map((p) => p.name)).toContain('EtlService');
    expect(api.controllers).toContain('WorkerHealthController');

    expect([...api.providers].filter(isConsumer).map((p) => p.name)).toEqual(
      [],
    );
    expect([...api.providers].filter(isScheduler).map((p) => p.name)).toEqual(
      [],
    );
  });

  it('runs every consumer and schedule in the worker', () => {
    const worker = collectGraph(WorkerModule);
    const names = [...worker.providers].map((p) => p.name);

    expect([...worker.providers].filter(isConsumer).length).toBeGreaterThan(15);
    expect(names).toEqual(
      expect.arrayContaining([
        'EtlScheduler',
        'ConsoleWatchScheduler',
        'SlipDigestScheduler',
        'SchedulingSwitchScheduler',
        'WorkerHeartbeatScheduler',
        'BettingEngineAnalysisWorker',
        'PendingBetsSettlementWorker',
        'SlipDigestWorker',
        'ConsoleWatchWorker',
      ]),
    );
  });
});
