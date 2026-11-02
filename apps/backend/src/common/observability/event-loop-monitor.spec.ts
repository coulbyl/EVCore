import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventLoopMonitor } from './event-loop-monitor';

const logged: { level: string; line: unknown }[] = [];
vi.mock('@utils/logger', () => ({
  createLogger: () => ({
    info: (line: unknown) => logged.push({ level: 'info', line }),
    warn: (line: unknown) => logged.push({ level: 'warn', line }),
  }),
}));

function blockFor(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Holds the event loop, as a heavy synchronous pass would.
  }
}

describe('EventLoopMonitor', () => {
  afterEach(() => {
    logged.length = 0;
  });

  it('reports a stall of the event loop as a warning, in milliseconds', async () => {
    const monitor = new EventLoopMonitor();
    monitor.onApplicationBootstrap();
    await new Promise((resolve) => setTimeout(resolve, 50));
    blockFor(300);
    await new Promise((resolve) => setTimeout(resolve, 50));
    monitor.report();
    monitor.onApplicationShutdown();

    expect(logged).toHaveLength(1);
    const [{ level, line }] = logged as [
      { level: string; line: { maxMs: number } },
    ];
    expect(level).toBe('warn');
    expect(line.maxMs).toBeGreaterThanOrEqual(250);
  });
});
