import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { createLlmClient } from "./groq/client";
import { createVantageWorker } from "./queue/worker";
import { createQueue } from "./queue/queue";

async function main() {
  const config = loadConfig();
  const logger = createLogger("vantage-worker");
  const groqClient = createLlmClient(config);

  if (config.enableResearch && config.llmProvider !== "groq") {
    logger.warn(
      { llmProvider: config.llmProvider },
      "vantage: VANTAGE_ENABLE_RESEARCH is set but situational research (groq/compound web search) has no equivalent on this provider — skipping it on every fixture",
    );
  }

  const worker = createVantageWorker(config, groqClient, logger);
  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, err },
      "vantage: job failed",
    );
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
