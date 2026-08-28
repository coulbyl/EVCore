import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { Config } from "../config";

export const VANTAGE_QUEUE_NAME = "vantage-analysis";

export type AnalyzeJobData = { fixtureId: string };
export type SweepJobData = Record<string, never>;

export function createRedisConnection(config: Config): ConnectionOptions {
  return { host: config.redisHost, port: config.redisPort };
}

export function createQueue(
  config: Config,
): Queue<AnalyzeJobData | SweepJobData> {
  return new Queue(VANTAGE_QUEUE_NAME, {
    connection: createRedisConnection(config),
  });
}
