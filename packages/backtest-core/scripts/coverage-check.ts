/**
 * First real consumer of the harness (docs/backtest-harness-architecture.md)
 * — walks a date range chronologically via BacktestRunner and reports how
 * many fixtures have complete point-in-time inputs (odds present, both
 * teams' rolling stats present). Not a calibration backtest itself: a
 * health check that the harness's data coverage is good enough to run one.
 *
 * This script lives INSIDE @evcore/backtest-core, not in
 * packages/db/scripts, because @evcore/backtest-core already depends on
 * @evcore/db — a script needing @evcore/backtest-core from inside
 * packages/db/scripts would make @evcore/db depend on @evcore/backtest-core
 * too, a circular package dependency (db -> backtest-core -> db). The 27
 * existing packages/db/scripts/backtest-*.ts migrate here for the same
 * reason, not to packages/db/scripts.
 *
 * Run:   pnpm --filter @evcore/backtest-core run backtest:coverage-check -- --from=2026-01-01 --to=2026-08-01 [--competition=PL]
 * Output: packages/backtest-core/reports/coverage-check-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { BacktestRunner } from "../src/backtest-runner";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

async function main(): Promise<void> {
  const fromArg = parseArg("from");
  const toArg = parseArg("to");
  if (!fromArg || !toArg) {
    console.error(
      "Usage: --from=YYYY-MM-DD --to=YYYY-MM-DD [--competition=CODE]",
    );
    process.exitCode = 1;
    return;
  }
  const from = new Date(fromArg);
  const to = new Date(toArg);
  const competition = parseArg("competition");

  const runner = new BacktestRunner();

  let total = 0;
  let withOdds = 0;
  let withBothTeamStats = 0;
  const byCompetition = new Map<
    string,
    { total: number; withOdds: number; withBothTeamStats: number }
  >();

  for await (const step of runner.run({
    from,
    to,
    competitionCodes: competition ? [competition] : undefined,
  })) {
    total += 1;
    const hasOdds = step.odds !== null;
    const hasBothStats =
      step.homeTeamStats !== null && step.awayTeamStats !== null;
    if (hasOdds) withOdds += 1;
    if (hasBothStats) withBothTeamStats += 1;

    const bucket = byCompetition.get(step.fixture.competitionCode) ?? {
      total: 0,
      withOdds: 0,
      withBothTeamStats: 0,
    };
    bucket.total += 1;
    if (hasOdds) bucket.withOdds += 1;
    if (hasBothStats) bucket.withBothTeamStats += 1;
    byCompetition.set(step.fixture.competitionCode, bucket);
  }

  const pct = (n: number, d: number) =>
    d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}%`;

  const lines: string[] = [
    `Backtest harness coverage check`,
    `Range: ${from.toISOString()} -> ${to.toISOString()}${competition ? ` (${competition})` : ""}`,
    ``,
    `Fixtures replayed: ${total}`,
    `  with odds:            ${withOdds} (${pct(withOdds, total)})`,
    `  with both team stats: ${withBothTeamStats} (${pct(withBothTeamStats, total)})`,
    ``,
    `By competition:`,
    ...Array.from(byCompetition.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(
        ([code, b]) =>
          `  ${code}: ${b.total} fixtures, odds ${pct(b.withOdds, b.total)}, team stats ${pct(b.withBothTeamStats, b.total)}`,
      ),
  ];

  const report = lines.join("\n");
  console.log(report);

  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outPath = join(
    reportsDir,
    `coverage-check-${new Date().toISOString().slice(0, 10)}.txt`,
  );
  writeFileSync(outPath, report + "\n");
  console.log(`\nWritten to ${outPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
