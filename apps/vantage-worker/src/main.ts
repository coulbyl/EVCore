import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { createLlmClients, findProviderClient } from "./groq/client";
import { createVantageWorker } from "./queue/worker";
import { createQueue } from "./queue/queue";

async function main() {
  const config = loadConfig();
  const logger = createLogger("vantage-worker");
  const llmClients = createLlmClients(config);

  // Groq can serve research from either slot (primary or fallback — see
  // findProviderClient) — only warn when there's truly no Groq client
  // configured anywhere, not just when it isn't primary (fixed 2026-08-30:
  // the old check missed a real prod config running LLM_PROVIDER=cerebras
  // with groq as a fallback, where research was silently disabled despite
  // this warning never firing).
  if (
    config.enableResearch &&
    findProviderClient(llmClients, "groq") === null
  ) {
    logger.warn(
      {
        llmProvider: config.llmProvider,
        llmFallbackProviders: llmClients.fallbacks.map((f) => f.provider),
      },
      "vantage: VANTAGE_ENABLE_RESEARCH is set but no configured provider (primary or fallback) is groq — situational research (groq/compound web search) has no equivalent elsewhere, skipping it on every fixture",
    );
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

  // Self-scheduling: the worker owns its own repeatable "sweep" job rather
  // than depending on an external cron. `pnpm sweep` (run-sweep-once.ts)
  // remains available as an alternative trigger for ops that prefer a host
  // cron — both are idempotent and safe to run together.
  const queue = createQueue(config);
  await queue.add(
    "sweep",
    {},
    {
      repeat: { every: config.sweepIntervalMs },
      jobId: "vantage-recurring-sweep",
    },
  );

  logger.info(
    {
      sweepIntervalMs: config.sweepIntervalMs,
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
