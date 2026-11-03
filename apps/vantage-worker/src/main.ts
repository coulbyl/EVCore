import { loadConfig, retiredEnvPresent } from "./config";
import { createLogger } from "./logger";
import { createLlmClients, findProviderClient } from "./groq/client";
import { createVantageWorker } from "./queue/worker";
import { createQueue } from "./queue/queue";
import {
  removeObsoleteSchedulers,
  VANTAGE_SCHEDULERS,
} from "./queue/remove-obsolete-schedulers";

async function main() {
  const config = loadConfig();
  const logger = createLogger("vantage-worker");
  const llmClients = createLlmClients(config);

  // Catch a research provider that's armed (VANTAGE_ENABLE_RESEARCH=true)
  // but can't actually run, at startup rather than as a per-fixture warning
  // nobody's watching. Provider-specific: "groq" can serve from either slot
  // (primary or fallback — see findProviderClient; fixed 2026-08-30 after a
  // real prod config — LLM_PROVIDER=cerebras with groq as a fallback — had
  // this silently broken because the old check only ever looked at the
  // primary); "tavily" just needs its own API key set.
  if (config.enableResearch) {
    if (
      config.researchProvider === "groq" &&
      findProviderClient(llmClients, "groq") === null
    ) {
      logger.warn(
        {
          llmProvider: config.llmProvider,
          llmFallbackProviders: llmClients.fallbacks.map((f) => f.provider),
        },
        "vantage: VANTAGE_ENABLE_RESEARCH is set with VANTAGE_RESEARCH_PROVIDER=groq, but no configured provider (primary or fallback) is groq — skipping research on every fixture",
      );
    }
    if (config.researchProvider === "tavily" && !config.tavilyApiKey) {
      logger.warn(
        {},
        "vantage: VANTAGE_ENABLE_RESEARCH is set with VANTAGE_RESEARCH_PROVIDER=tavily, but TAVILY_API_KEY is not set — skipping research on every fixture",
      );
    }
  }

  const worker = createVantageWorker(config, llmClients, logger);
  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, err },
      "vantage: job failed",
    );
  });
  // BullMQ routes its own internal script failures (Redis script errors,
  // stalled-check errors, a job's Redis key vanishing mid-flight — e.g. a
  // manual `redis-cli DEL` racing an in-flight job, as happened during the
  // 2026-08-28 incident cleanup) through `worker.emit('error', ...)`, not
  // through "failed". Node's EventEmitter throws when an 'error' event has
  // no listener — without this handler, any one of those internal errors
  // could crash the whole process (raw, unformatted stack traces bypassing
  // pino entirely is the signature of exactly this happening).
  worker.on("error", (err) => {
    logger.error({ err }, "vantage: worker error");
  });

  // Self-scheduling: the worker owns its own recurring "sweep" rather than
  // depending on an external cron. `pnpm sweep` (run-sweep-once.ts) remains
  // available as an alternative trigger for ops that prefer a host cron —
  // both are idempotent and safe to run together. Job schedulers with a
  // fixed key (BullMQ 6 drops `queue.add({ repeat })`): an interval or an
  // hour changed here updates the same scheduler.
  const queue = createQueue(config);
  await queue.upsertJobScheduler(
    VANTAGE_SCHEDULERS.sweep.id,
    { every: config.sweepIntervalMs },
    { name: VANTAGE_SCHEDULERS.sweep.jobName, data: {} },
  );

  // The coupon passes are gone: the intraday batch since 2026-09-16, the
  // LLM combo since 2026-11-03 (replaced by the backend's Combiné IA, the
  // AI's own plays at 4–10). Their schedulers, still in Redis on a running
  // deployment, are removed here.
  const removedObsoleteSchedulers = await removeObsoleteSchedulers(queue);

  logger.info(
    {
      sweepIntervalMs: config.sweepIntervalMs,
      removedObsoleteSchedulers,
      retiredEnv: retiredEnvPresent(),
      llmProvider: config.llmProvider,
      model: config.llmModel,
      llmFallbackProviders: llmClients.fallbacks.map((f) => f.provider),
    },
    "vantage-worker started",
  );

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      logger.info({ signal }, "vantage-worker shutting down");
      void Promise.all([worker.close(), queue.close()]).then(() =>
        process.exit(0),
      );
    });
  }
}

main().catch((err) => {
  console.error("vantage-worker failed to start:", err);
  process.exitCode = 1;
});
