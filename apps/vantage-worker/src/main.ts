import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { createLlmClients, findProviderClient } from "./groq/client";
import { createVantageWorker } from "./queue/worker";
import { createQueue } from "./queue/queue";
import { removeObsoleteIntradaySchedulers } from "./queue/remove-obsolete-schedulers";

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

  // Daily coupon generation (docs/vantage-centric-redesign-2026-09-01.md
  // §9bis) — its own independent cron, same self-scheduling principle as
  // the sweep above, no dependency on apps/backend's queue. See
  // config.ts's couponCron doc comment for how its default relates to
  // apps/backend's own analysis cron.
  await queue.add(
    "generate-coupons",
    {},
    {
      repeat: { pattern: config.couponCron },
      jobId: "vantage-recurring-coupon-generation",
    },
  );
  // Self-healing second pass — see config.ts's couponRetryCron doc comment.
  // Distinct jobId (same job name, "generate-coupons") so both repeatable
  // registrations coexist instead of one overwriting the other.
  await queue.add(
    "generate-coupons",
    {},
    {
      repeat: { pattern: config.couponRetryCron },
      jobId: "vantage-recurring-coupon-generation-retry",
    },
  );

  // Intraday batch (recheck J-J) — NO LONGER SCHEDULED since 2026-09-16.
  //
  // Measured over 2026-09-04..09-11, evening pass versus intraday pass, legs
  // settled: realised 42.7 % versus 42.6 % — identical, with overlapping
  // intervals (ratio 0.681 ± 9.9 versus 0.810 ± 14.1). It bought nothing
  // measurable while costing one LLM call per hour, and because
  // persist-coupon-proposal upserts on
  // (forDate, signalWindowDays, targetOddsMin, targetOddsMax, rank), each hourly
  // pass overwrote the previous one: what the database held was the last state
  // before kickoff, never what was actually proposed. A proposal that mutates
  // through the day cannot be compared leg-by-leg against another generator,
  // which is precisely what running two sources in parallel requires.
  //
  // `runIntradayCouponGeneration` and its "generate-intraday-coupons" handler
  // stay callable for a manual pass; only the recurring registration is gone.
  // A repeatable job already registered in Redis keeps firing until it is
  // explicitly removed, so removing the `queue.add` above would not have been
  // enough on a running deployment.
  const removedIntradaySchedulers =
    await removeObsoleteIntradaySchedulers(queue);

  logger.info(
    {
      sweepIntervalMs: config.sweepIntervalMs,
      couponCron: config.couponCron,
      couponRetryCron: config.couponRetryCron,
      couponIntradayWindowHours: config.couponIntradayWindowHours,
      removedIntradaySchedulers,
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
