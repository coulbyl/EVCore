import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { Config } from "../config";

export const VANTAGE_QUEUE_NAME = "vantage-analysis";

export type AnalyzeJobData = { fixtureId: string };
export type SweepJobData = Record<string, never>;
/** `date` optional, same convention as apps/backend's retired
 * BettingEngineAnalysisJobData — defaults to tomorrowUtc() when unset (see
 * worker.ts). */
export type CouponJobData = { date?: string };
/** No job data — the intraday pass always targets "now" + `config.
 * couponIntradayWindowHours" (see worker.ts), never a specific date. */
export type IntradayCouponJobData = Record<string, never>;

export type VantageJobData =
  | AnalyzeJobData
  | SweepJobData
  | CouponJobData
  | IntradayCouponJobData;

export function createRedisConnection(config: Config): ConnectionOptions {
  return { host: config.redisHost, port: config.redisPort };
}

export function createQueue(config: Config): Queue<VantageJobData> {
  return new Queue(VANTAGE_QUEUE_NAME, {
    connection: createRedisConnection(config),
  });
}
