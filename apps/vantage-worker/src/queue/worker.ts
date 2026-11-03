import { Worker, type Job } from "bullmq";
import type { Logger } from "pino";
import type { Config } from "../config";
import type { LlmClients } from "../groq/client";
import {
  clientsFor,
  readLiveConfig,
  scheduledPassesEnabled,
} from "../settings";
import { analyzeFixture } from "../vantage/analyze-fixture";
import { runSweep } from "./scheduler";
import {
  createQueue,
  createRedisConnection,
  VANTAGE_QUEUE_NAME,
} from "./queue";
import type { AnalyzeJobData, VantageJobData } from "./queue";

export function createVantageWorker(
  config: Config,
  llmClients: LlmClients,
  logger: Logger,
): Worker<VantageJobData> {
  // The worker enqueues its own follow-up analysis jobs from within the sweep
  // handler, so it needs a Queue handle alongside the Worker.
  const queue = createQueue(config);
  const liveClients = (live: Config): LlmClients =>
    live === config ? llmClients : clientsFor(live);

  return new Worker<VantageJobData>(
    VANTAGE_QUEUE_NAME,
    async (job: Job<VantageJobData>) => {
      // A scheduled run (not one triggered by hand) honours the operator's
      // switch; a skipped sweep enqueues no analysis either.
      if (
        job.repeatJobKey &&
        job.name === "sweep" &&
        !(await scheduledPassesEnabled(logger))
      ) {
        logger.warn(
          { jobName: job.name },
          "vantage: scheduled passes off, skipped",
        );
        return undefined;
      }
      if (job.name === "sweep") {
        return runSweep(queue, config, logger);
      }
      // The provider chain and research are operator switches, read at
      // every pass (app_setting); the boot clients serve until a row says
      // otherwise.
      if (job.name === "analyze") {
        const { fixtureId } = job.data as AnalyzeJobData;
        const live = await readLiveConfig(config, logger);
        return analyzeFixture(fixtureId, liveClients(live), live, logger);
      }
      logger.warn({ jobName: job.name }, "vantage: unknown job name, skipping");
      return undefined;
    },
    {
      connection: createRedisConnection(config),
      // Groq is fast (LPU inference) and this is not latency-sensitive
      // (matches are analyzed hours ahead of kickoff) — a modest concurrency
      // keeps us comfortably under Groq's rate limits without needing tuning.
      concurrency: 3,
    },
  );
}
