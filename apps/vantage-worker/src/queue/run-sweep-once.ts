// Standalone entrypoint for `pnpm sweep` — runs one sweep and exits. Useful
// for triggering VANTAGE from an external cron instead of relying on the
// long-running worker's own repeatable job (see main.ts). Either mechanism
// is safe to run alone or together: `runSweep` only ever enqueues fixtures
// that don't already have a VANTAGE decision.
import { loadConfig } from "../config";
import { createLogger } from "../logger";
import { createQueue } from "./queue";
import { runSweep } from "./scheduler";

async function main() {
  const config = loadConfig();
  const logger = createLogger("vantage-sweep-once");
  const queue = createQueue(config);
  try {
    const count = await runSweep(queue, config, logger);
    logger.info({ count }, "vantage: one-shot sweep complete");
  } finally {
    await queue.close();
  }
}

main().catch((err) => {
  console.error("vantage sweep failed:", err);
  process.exitCode = 1;
});
