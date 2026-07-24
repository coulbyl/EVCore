/// <reference types="node" />
/**
 * Deletes `ml_model_version` rows still tagged with the pre-2026-07 channel
 * nomenclature (EV→VALUE, CONF→DOMINANT rename — see docs/ml-worker-sync.md).
 * These segments no longer exist in `ML_SEGMENTS`/`VALID_SEGMENTS` and are
 * never trained or looked up again under that name — keeping them around is
 * pure registry clutter (some were left `isActive=true` by mistake, see
 * `project_ml_worker_desync` memory). No value in a soft-deactivate here:
 * the same segments get a fresh model the next time they train under their
 * live name, so there is nothing to roll back to.
 *
 * Dry run:
 *   pnpm --filter @evcore/db db:cleanup:legacy-ml-models
 *
 * Execute:
 *   pnpm --filter @evcore/db db:cleanup:legacy-ml-models -- --confirm=DELETE_LEGACY_ML_MODELS
 */
import "dotenv/config";
import { prisma } from "../src/client";

const CONFIRM_FLAG = "--confirm=DELETE_LEGACY_ML_MODELS";

// Every segment prefix retired by the 2026-07-01 rename. Matched as an exact
// "PREFIX:" start (not a substring) so e.g. "GOALS:OVER_UNDER" is never
// touched despite containing no legacy prefix at all — this is a belt-and-
// braces guard, not just documentation.
const LEGACY_PREFIXES = ["EV:", "CONF:"] as const;

async function findLegacyModels() {
  const all = await prisma.mlModelVersion.findMany({
    select: { id: true, segment: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return all.filter((m) =>
    LEGACY_PREFIXES.some((prefix) => m.segment.startsWith(prefix)),
  );
}

function printRows(
  title: string,
  rows: { segment: string; isActive: boolean; createdAt: Date }[],
): void {
  console.log(title);
  console.table(
    rows.map((r) => ({
      segment: r.segment,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes(CONFIRM_FLAG);
  const legacy = await findLegacyModels();

  if (legacy.length === 0) {
    console.log(
      "No legacy EV:*/CONF:* ml_model_version rows found. Nothing to do.",
    );
    return;
  }

  if (!confirmed) {
    printRows(
      "Dry run: legacy ml_model_version rows that would be deleted",
      legacy,
    );
    console.log(`\nPass ${CONFIRM_FLAG} to execute the delete.`);
    return;
  }

  printRows("Deleting legacy ml_model_version rows", legacy);
  const deleted = await prisma.mlModelVersion.deleteMany({
    where: { id: { in: legacy.map((m) => m.id) } },
  });
  console.log(`\nDeleted ${deleted.count} row(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
