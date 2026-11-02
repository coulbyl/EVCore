import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';
import { EVENT_LOOP_MONITOR } from '@config/http.constants';
import { createLogger } from '@utils/logger';

const logger = createLogger('event-loop');

const NS_PER_MS = 1_000_000;

/**
 * How long the event loop was held, one line a minute per process (API
 * and worker): p50, p99 and the longest stall, in milliseconds. A screen's
 * request waits behind any stall of its process; this is what the split
 * into two processes (main.worker.ts) is judged on, in the prod logs.
 */
@Injectable()
export class EventLoopMonitor
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private histogram: IntervalHistogram | null = null;
  private timer: NodeJS.Timeout | null = null;

  onApplicationBootstrap(): void {
    this.histogram = monitorEventLoopDelay({
      resolution: EVENT_LOOP_MONITOR.RESOLUTION_MS,
    });
    this.histogram.enable();
    this.timer = setInterval(() => this.report(), EVENT_LOOP_MONITOR.REPORT_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.histogram?.disable();
  }

  report(): void {
    const h = this.histogram;
    if (!h || h.count === 0) return;
    // The histogram measures the gap between two samples, the resolution
    // included: what is left over it is the time the loop was held.
    const ms = (ns: number) =>
      Math.max(
        0,
        Math.round((ns / NS_PER_MS - EVENT_LOOP_MONITOR.RESOLUTION_MS) * 10) /
          10,
      );
    const line = {
      p50Ms: ms(h.percentile(50)),
      p99Ms: ms(h.percentile(99)),
      maxMs: ms(h.max),
    };
    h.reset();
    if (line.maxMs >= EVENT_LOOP_MONITOR.WARN_MS) {
      logger.warn(line, 'event loop held');
    } else {
      logger.info(line, 'event loop');
    }
  }
}
