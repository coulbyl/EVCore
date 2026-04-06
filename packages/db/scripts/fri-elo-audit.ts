/// <reference types="node" />
/**
 * Prototype Elo pour matchs de sélections nationales (FRI seniors).
 *
 * - Charge les ratings Elo réels depuis le dernier snapshot syncé en base
 * - Évalue la qualité prédictive sur les fixtures FRI seniors terminées
 * - Compare au de-viguage des cotes Pinnacle quand disponibles
 * - Bootstrappe aussi un Elo interne depuis WCQE/UNL pour comparaison
 *
 * Run: pnpm --filter @evcore/db db:audit:fri-elo
 * Écrit packages/db/reports/fri-elo-audit-YYYY-MM-DD.txt.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

// ─── Config ───────────────────────────────────────────────────────────────────

const HOME_ADV = 50;
const DRAW_RATE = 0.22;
const BASE_ELO = 1500;

const K_FACTOR: Record<string, number> = { WCQE: 40, UNL: 40, FRI: 20 };
const NATIONAL_TEAM_CODES = ["FRI", "WCQE", "UNL"];

// ─── Types ────────────────────────────────────────────────────────────────────

type EloMap = Map<string, number>;

type FixtureRow = {
  id: string;
  externalId: number;
  scheduledAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  competitionCode: string;
};

type Prediction = {
  fixture: FixtureRow;
  eloHomeInternal: number;
  eloAwayInternal: number;
  eloHomeReal: number | null;
  eloAwayReal: number | null;
  pHome: number;
  pDraw: number;
  pAway: number;
  pHomeReal: number | null;
  pDrawReal: number | null;
  pAwayReal: number | null;
  actualOutcome: "HOME" | "DRAW" | "AWAY" | null;
  pinnacleHomeOdds: number | null;
  pinnacleDrawOdds: number | null;
  pinnacleAwayOdds: number | null;
};

// ─── Elo maths ────────────────────────────────────────────────────────────────

function expectedScore(rA: number, rB: number, homeAdv = HOME_ADV): number {
  return 1 / (10 ** (-(rA - rB + homeAdv) / 400) + 1);
}

function updateElo(
  elo: EloMap,
  homeId: string,
  awayId: string,
  hs: number,
  as_: number,
  k: number,
): void {
  const rH = elo.get(homeId) ?? BASE_ELO;
  const rA = elo.get(awayId) ?? BASE_ELO;
  const we = expectedScore(rH, rA);
  const actual = hs > as_ ? 1 : hs === as_ ? 0.5 : 0;
  elo.set(homeId, rH + k * (actual - we));
  elo.set(awayId, rA + k * (1 - actual - (1 - we)));
}

function eloProbabilities(
  rH: number,
  rA: number,
): { pHome: number; pDraw: number; pAway: number } {
  const we = expectedScore(rH, rA);
  const pDraw = DRAW_RATE * (1 - Math.abs(2 * we - 1));
  return { pHome: we * (1 - pDraw), pDraw, pAway: (1 - we) * (1 - pDraw) };
}

// ─── Senior filter ────────────────────────────────────────────────────────────

const YOUTH_PATTERN = /\bU\d{2}\b/i;
const CLUB_PATTERN =
  /\b(FC|SC|AC|CF|FK|SK|NK|BK|IF|PSG|Rangers|Lights|Galaxy|Crew|Sounders|Timbers|Dynamo|Dinamo|Lokomotiv|Spartak|Rapid|Wanderers|Benfica|Sporting|Atletico|Athletic)\b/i;
const CLUB_EXACT_NAMES = new Set(["Las Vegas Lights", "FC Urartu"]);

function isClubTeam(name: string): boolean {
  return CLUB_EXACT_NAMES.has(name) || CLUB_PATTERN.test(name);
}

function isSeniorTeam(name: string): boolean {
  return !YOUTH_PATTERN.test(name) && !isClubTeam(name);
}

function isSeniorFixture(f: FixtureRow): boolean {
  return (
    isSeniorTeam(f.homeTeam?.name ?? "") && isSeniorTeam(f.awayTeam?.name ?? "")
  );
}

function seniorExclusionReason(name: string): string | null {
  if (YOUTH_PATTERN.test(name)) return "youth";
  if (isClubTeam(name)) return "club";
  return null;
}

// ─── Brier score ──────────────────────────────────────────────────────────────

function brierScore(
  predictions: {
    pHome: number;
    pDraw: number;
    pAway: number;
    actualOutcome: string | null;
  }[],
): number {
  const settled = predictions.filter((p) => p.actualOutcome !== null);
  if (settled.length === 0) return NaN;
  const total = settled.reduce((acc, p) => {
    const oH = p.actualOutcome === "HOME" ? 1 : 0;
    const oD = p.actualOutcome === "DRAW" ? 1 : 0;
    const oA = p.actualOutcome === "AWAY" ? 1 : 0;
    return (
      acc + (p.pHome - oH) ** 2 + (p.pDraw - oD) ** 2 + (p.pAway - oA) ** 2
    );
  }, 0);
  return total / settled.length;
}

function devig(
  h: number,
  d: number,
  a: number,
): { pH: number; pD: number; pA: number } {
  const iH = 1 / h,
    iD = 1 / d,
    iA = 1 / a;
  const m = iH + iD + iA;
  return { pH: iH / m, pD: iD / m, pA: iA / m };
}

// ─── Fetch real Elo ───────────────────────────────────────────────────────────

async function fetchRealEloRatings(): Promise<Map<string, number>> {
  const latestSnapshot = await prisma.nationalTeamEloRating.findFirst({
    select: { snapshotAt: true },
    orderBy: [{ snapshotAt: "desc" }, { teamName: "asc" }],
  });

  if (latestSnapshot === null) {
    throw new Error(
      "Aucun snapshot Elo syncé en base. Lance d'abord /etl/sync/elo.",
    );
  }

  const rows = await prisma.nationalTeamEloRating.findMany({
    where: { snapshotAt: latestSnapshot.snapshotAt },
    select: {
      teamName: true,
      eloCode: true,
      rating: true,
      source: true,
      snapshotAt: true,
    },
    orderBy: { teamName: "asc" },
  });

  const nameToRating = new Map(rows.map((row) => [row.teamName, row.rating]));
  console.log(
    `  Elo snapshot: ${rows.length} équipes chargées depuis ${rows[0]?.source ?? "unknown"} @ ${latestSnapshot.snapshotAt.toISOString()}`,
  );
  return nameToRating;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);

  console.log("\nChargement des ratings Elo réels...");
  out("═══════════════════════════════════════════════════════");
  out(`  EVCore — Audit FRI Elo — ${dateLabel}`);
  out(
    `  Généré : ${generatedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`,
  );
  out("═══════════════════════════════════════════════════════");
  out();
  out("Chargement des ratings Elo réels...");
  const realElo = await fetchRealEloRatings();

  const allFixtures = await prisma.fixture.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
      season: { competition: { code: { in: NATIONAL_TEAM_CODES } } },
    },
    select: {
      id: true,
      externalId: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      season: { select: { competition: { select: { code: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const fixtures: FixtureRow[] = allFixtures.map((f) => ({
    id: f.id,
    externalId: f.externalId,
    scheduledAt: f.scheduledAt,
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    competitionCode: f.season.competition.code,
  }));

  const friFixtures = fixtures.filter((f) => f.competitionCode === "FRI");
  const friSeniorFixtures = friFixtures.filter((f) => isSeniorFixture(f));
  const friNonSeniorFixtures = friFixtures.filter((f) => !isSeniorFixture(f));

  out();
  out(`Fixtures nationales FINISHED : ${fixtures.length}`);
  NATIONAL_TEAM_CODES.forEach((c) =>
    out(
      `  ${c.padEnd(6)}: ${fixtures.filter((f) => f.competitionCode === c).length}`,
    ),
  );

  // Pinnacle odds
  const friIds = fixtures
    .filter((f) => f.competitionCode === "FRI")
    .map((f) => f.id);
  const oddsRows = await prisma.oddsSnapshot.findMany({
    where: {
      fixtureId: { in: friIds },
      bookmaker: "Pinnacle",
      homeOdds: { not: null },
    },
    select: { fixtureId: true, homeOdds: true, drawOdds: true, awayOdds: true },
  });
  const oddsMap = new Map(oddsRows.map((o) => [o.fixtureId, o]));

  // Rolling internal Elo + predictions
  const elo: EloMap = new Map();
  const predictions: Prediction[] = [];

  for (const f of fixtures) {
    if (!f.homeTeam || !f.awayTeam) continue;
    const k = K_FACTOR[f.competitionCode] ?? 20;

    const eloHomeInternal = elo.get(f.homeTeam.id) ?? BASE_ELO;
    const eloAwayInternal = elo.get(f.awayTeam.id) ?? BASE_ELO;

    if (f.competitionCode === "FRI" && isSeniorFixture(f)) {
      const { pHome, pDraw, pAway } = eloProbabilities(
        eloHomeInternal,
        eloAwayInternal,
      );

      const eloHomeReal = realElo.get(f.homeTeam.name) ?? null;
      const eloAwayReal = realElo.get(f.awayTeam.name) ?? null;
      let pHomeReal = null,
        pDrawReal = null,
        pAwayReal = null;
      if (eloHomeReal !== null && eloAwayReal !== null) {
        const r = eloProbabilities(eloHomeReal, eloAwayReal);
        pHomeReal = r.pHome;
        pDrawReal = r.pDraw;
        pAwayReal = r.pAway;
      }

      const odds = oddsMap.get(f.id);
      const actualOutcome =
        f.homeScore !== null && f.awayScore !== null
          ? f.homeScore > f.awayScore
            ? "HOME"
            : f.homeScore < f.awayScore
              ? "AWAY"
              : "DRAW"
          : null;

      predictions.push({
        fixture: f,
        eloHomeInternal,
        eloAwayInternal,
        eloHomeReal,
        eloAwayReal,
        pHome,
        pDraw,
        pAway,
        pHomeReal,
        pDrawReal,
        pAwayReal,
        actualOutcome,
        pinnacleHomeOdds: odds ? Number(odds.homeOdds) : null,
        pinnacleDrawOdds: odds ? Number(odds.drawOdds) : null,
        pinnacleAwayOdds: odds ? Number(odds.awayOdds) : null,
      });
    }

    if (f.homeScore !== null && f.awayScore !== null) {
      updateElo(elo, f.homeTeam.id, f.awayTeam.id, f.homeScore, f.awayScore, k);
    }
  }

  // ─── Output ────────────────────────────────────────────────────────────────

  const seniorWithRealMapping = predictions.filter(
    (p) => p.eloHomeReal !== null && p.eloAwayReal !== null,
  );

  out(
    `\n── FRI seniors (${predictions.length} fixtures) ─────────────────────────────────\n`,
  );
  out(
    `${"Date".padEnd(12)}${"Match".padEnd(34)}${"ΔElo(réel)".padEnd(12)}${"pH(réel)".padEnd(10)}${"pD(réel)".padEnd(10)}${"pA(réel)".padEnd(10)}Résultat`,
  );
  out("─".repeat(100));

  for (const p of predictions) {
    const date = p.fixture.scheduledAt.toISOString().slice(0, 10);
    const name = `${p.fixture.homeTeam?.name ?? "?"} vs ${p.fixture.awayTeam?.name ?? "?"}`;
    const hasReal = p.eloHomeReal !== null && p.eloAwayReal !== null;
    const delta = hasReal
      ? String(Math.round(p.eloHomeReal! - p.eloAwayReal!))
      : "N/A";
    const pH = p.pHomeReal !== null ? p.pHomeReal.toFixed(3) : "  -  ";
    const pD = p.pDrawReal !== null ? p.pDrawReal.toFixed(3) : "  -  ";
    const pA = p.pAwayReal !== null ? p.pAwayReal.toFixed(3) : "  -  ";
    out(
      `${date.padEnd(12)}${name.slice(0, 32).padEnd(34)}${delta.padEnd(12)}${pH.padEnd(10)}${pD.padEnd(10)}${pA.padEnd(10)}${p.actualOutcome ?? "-"}`,
    );
  }

  out("\n" + "─".repeat(100));
  out(
    "\n── Debug matching seniors ───────────────────────────────────────────────────────\n",
  );
  out(`FRI total (FINISHED + scores)  : ${friFixtures.length}`);
  out(`FRI seniors                    : ${friSeniorFixtures.length}`);
  out(`FRI exclus non-senior          : ${friNonSeniorFixtures.length}`);
  out(`FRI seniors avec Elo réel      : ${seniorWithRealMapping.length}`);
  out(
    `FRI seniors sans Elo réel      : ${predictions.length - seniorWithRealMapping.length}`,
  );

  if (friNonSeniorFixtures.length > 0) {
    out("\nFixtures FRI exclues par le filtre senior:");
    for (const f of friNonSeniorFixtures) {
      const homeName = f.homeTeam?.name ?? "?";
      const awayName = f.awayTeam?.name ?? "?";
      const homeReason = seniorExclusionReason(homeName);
      const awayReason = seniorExclusionReason(awayName);
      const reasons = [
        homeReason ? `${homeName}=${homeReason}` : null,
        awayReason ? `${awayName}=${awayReason}` : null,
      ].filter((value): value is string => value !== null);
      out(
        `  ${f.scheduledAt.toISOString().slice(0, 10)}  ${homeName} vs ${awayName}  [${reasons.join(", ")}]`,
      );
    }
  }

  const seniorMissingMapping = predictions.filter(
    (p) => p.eloHomeReal === null || p.eloAwayReal === null,
  );
  if (seniorMissingMapping.length > 0) {
    out("\nFixtures FRI seniors sans mapping Elo complet:");
    for (const p of seniorMissingMapping) {
      const homeName = p.fixture.homeTeam?.name ?? "?";
      const awayName = p.fixture.awayTeam?.name ?? "?";
      const missing = [
        p.eloHomeReal === null ? `home=${homeName}` : null,
        p.eloAwayReal === null ? `away=${awayName}` : null,
      ].filter((value): value is string => value !== null);
      out(
        `  ${p.fixture.scheduledAt.toISOString().slice(0, 10)}  ${homeName} vs ${awayName}  [${missing.join(", ")}]`,
      );
    }
  }

  out("\n" + "─".repeat(100));
  out(
    "\n── Métriques ───────────────────────────────────────────────────────────────────\n",
  );

  const settled = predictions.filter((p) => p.actualOutcome !== null);
  const withReal = settled.filter((p) => p.pHomeReal !== null);
  const withOdds = settled.filter((p) => p.pinnacleHomeOdds !== null);

  const naiveBrier = brierScore(
    settled.map((p) => ({
      pHome: 1 / 3,
      pDraw: 1 / 3,
      pAway: 1 / 3,
      actualOutcome: p.actualOutcome,
    })),
  );
  const internalBrier = brierScore(settled);
  const realBrier =
    withReal.length > 0
      ? brierScore(
          withReal.map((p) => ({
            pHome: p.pHomeReal!,
            pDraw: p.pDrawReal!,
            pAway: p.pAwayReal!,
            actualOutcome: p.actualOutcome,
          })),
        )
      : NaN;

  out(
    `Baseline naïf (1/3)      : ${naiveBrier.toFixed(4)}  (${settled.length} matchs)`,
  );
  out(
    `Elo interne (WCQE/UNL)   : ${internalBrier.toFixed(4)}  (${settled.length} matchs)`,
  );
  if (!isNaN(realBrier)) {
    out(
      `Elo réel (eloratings.net): ${realBrier.toFixed(4)}  (${withReal.length} matchs mappés)`,
    );
  }

  if (withOdds.length > 0) {
    const pinnBrier = brierScore(
      withOdds.map((p) => {
        const { pH, pD, pA } = devig(
          p.pinnacleHomeOdds!,
          p.pinnacleDrawOdds!,
          p.pinnacleAwayOdds!,
        );
        return {
          pHome: pH,
          pDraw: pD,
          pAway: pA,
          actualOutcome: p.actualOutcome,
        };
      }),
    );
    out(
      `Pinnacle dé-vigué        : ${pinnBrier.toFixed(4)}  (${withOdds.length} matchs)`,
    );
  }

  // Accuracy
  const accReal = withReal.filter((p) => {
    const pred =
      p.pHomeReal! > p.pDrawReal! && p.pHomeReal! > p.pAwayReal!
        ? "HOME"
        : p.pAwayReal! > p.pHomeReal! && p.pAwayReal! > p.pDrawReal!
          ? "AWAY"
          : "DRAW";
    return pred === p.actualOutcome;
  }).length;
  if (withReal.length > 0) {
    out(
      `\nAccuracy Elo réel        : ${accReal}/${withReal.length} = ${((accReal / withReal.length) * 100).toFixed(1)}%`,
    );
  }

  // Teams without Elo mapping
  const unmapped = predictions
    .flatMap((p) => [
      p.eloHomeReal === null ? p.fixture.homeTeam?.name : null,
      p.eloAwayReal === null ? p.fixture.awayTeam?.name : null,
    ])
    .filter((n): n is string => n !== null);
  const uniqueUnmapped = [...new Set(unmapped)];
  if (uniqueUnmapped.length > 0) {
    out(`\n⚠  Équipes sans mapping Elo : ${uniqueUnmapped.join(", ")}`);
  }

  // Distribution
  const dist = settled.reduce(
    (acc, p) => {
      if (p.actualOutcome)
        acc[p.actualOutcome] = (acc[p.actualOutcome] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  out(
    `\nDistribution réels  →  HOME: ${dist["HOME"] ?? 0}  DRAW: ${dist["DRAW"] ?? 0}  AWAY: ${dist["AWAY"] ?? 0}`,
  );

  out();
  out("═══════════════════════════════════════════════════════");

  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const filePath = join(reportsDir, `fri-elo-audit-${dateLabel}.txt`);
  writeFileSync(filePath, lines.join("\n"), "utf-8");
  console.log(`\nReport saved → ${filePath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
