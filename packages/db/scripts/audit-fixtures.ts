/// <reference types="node" />
/**
 * Diagnostics moteur par jour — run with: pnpm --filter @evcore/db db:audit:fixtures [YYYY-MM-DD]
 * Par défaut : aujourd'hui UTC.
 * Écrit packages/db/reports/audit-fixtures-YYYY-MM-DD.txt.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

// ── Labels français ──────────────────────────────────────────────────────────

function singlePickLabel(market: string, pick: string): string {
  if (market === "ONE_X_TWO") {
    if (pick === "HOME") return "V1";
    if (pick === "DRAW") return "NUL";
    if (pick === "AWAY") return "V2";
  }
  if (market === "OVER_UNDER") {
    if (pick === "OVER") return "PLUS DE 2.5";
    if (pick === "UNDER") return "MOINS DE 2.5";
  }
  if (market === "BTTS") {
    if (pick === "YES") return "BB OUI";
    if (pick === "NO") return "BB NON";
  }
  return `${market}/${pick}`;
}

function pickLabel(
  market: string,
  pick: string,
  comboMarket?: string | null,
  comboPick?: string | null,
): string {
  const base = singlePickLabel(market, pick);
  if (comboMarket && comboPick) {
    return `${base} + ${singlePickLabel(comboMarket, comboPick)}`;
  }
  return base;
}

function marketFullLabel(market: string): string {
  if (market === "ONE_X_TWO") return "Résultat 1X2";
  if (market === "OVER_UNDER") return "Plus/Moins 2.5";
  if (market === "BTTS") return "Les deux équipes marquent";
  return market;
}

function rejectionLabel(reason: string): string {
  if (reason === "ev_above_hard_cap") return "EV au-dessus du plafond dur";
  if (reason === "ev_below_threshold") return "EV insuffisant";
  if (reason === "quality_score_below_threshold")
    return "Score qualité insuffisant";
  if (reason === "probability_too_low")
    return "Probabilité directionnelle insuffisante";
  if (reason === "odds_below_floor") return "Cote trop basse";
  if (reason === "odds_above_cap") return "Cote trop haute";
  if (reason === "market_suspended") return "Marché suspendu";
  return reason;
}

function betStatusLabel(status: string): string {
  if (status === "WON") return "GAGNE";
  if (status === "LOST") return "PERDU";
  if (status === "VOID") return "NUL (remboursé)";
  return "EN COURS";
}

function fmtSigned(n: number, decimals = 4): string {
  const s = n.toFixed(decimals);
  return n >= 0 ? `+${s}` : s;
}

// ── Types features JSON ──────────────────────────────────────────────────────

type RawPick = {
  market: string;
  pick: string;
  comboMarket?: string | null;
  comboPick?: string | null;
  probability: number;
  odds: number;
  ev: number;
  qualityScore: number;
  status?: string;
  rejectionReason?: string;
};

function readPicks(features: unknown, key: string): RawPick[] {
  if (!features || typeof features !== "object") return [];
  const entry = features as Record<string, unknown>;
  const raw = entry[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is RawPick =>
      p !== null &&
      typeof p === "object" &&
      typeof p.market === "string" &&
      typeof p.pick === "string" &&
      typeof p.probability === "number" &&
      typeof p.odds === "number" &&
      typeof p.ev === "number" &&
      typeof p.qualityScore === "number",
  );
}

function readNumber(features: unknown, key: string): number | null {
  if (!features || typeof features !== "object") return null;
  const entry = features as Record<string, unknown>;
  const v = entry[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function readBool(features: unknown, key: string): boolean {
  if (!features || typeof features !== "object") return false;
  const entry = features as Record<string, unknown>;
  return entry[key] === true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rawArg = process.argv[2];
  const date = rawArg ? new Date(`${rawArg}T00:00:00.000Z`) : new Date();
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);
  const dateLabel = dayStart.toISOString().slice(0, 10);

  const fixtures = await prisma.fixture.findMany({
    where: { scheduledAt: { gte: dayStart, lte: dayEnd } },
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      homeHtScore: true,
      awayHtScore: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: {
        select: { competition: { select: { code: true, name: true } } },
      },
      modelRuns: {
        select: {
          decision: true,
          deterministicScore: true,
          finalScore: true,
          features: true,
          analyzedAt: true,
          bets: {
            select: {
              market: true,
              pick: true,
              comboMarket: true,
              comboPick: true,
              ev: true,
              probEstimated: true,
              status: true,
            },
            orderBy: { ev: "desc" },
            take: 1,
          },
        },
        orderBy: { analyzedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [
      { season: { competition: { name: "asc" } } },
      { scheduledAt: "asc" },
    ],
  });

  const lines: string[] = [];
  const w = (s = "") => lines.push(s);

  const generatedAt =
    new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  w("═══════════════════════════════════════════════════════");
  w(`  EVCore — Diagnostics moteur — ${dateLabel}`);
  w(`  Généré : ${generatedAt}`);
  w(`  Fixtures : ${fixtures.length}`);
  w("═══════════════════════════════════════════════════════");
  w();

  // ── Sélections (BET) ────────────────────────────────────────────────────────

  const betFixtures = fixtures.filter(
    (f) => f.modelRuns[0]?.decision === "BET",
  );
  const noBetFixtures = fixtures.filter(
    (f) => f.modelRuns.length > 0 && f.modelRuns[0]?.decision === "NO_BET",
  );
  const noRunFixtures = fixtures.filter((f) => f.modelRuns.length === 0);

  w(`── Sélections BET (${betFixtures.length}) ─────────────────────────────`);

  if (betFixtures.length === 0) {
    w("  Aucune sélection ce jour.");
  }

  let selIdx = 0;
  for (const f of betFixtures) {
    selIdx++;
    const run = f.modelRuns[0]!;
    const bet = run.bets[0] ?? null;
    const feat = run.features;

    const home = f.homeTeam.name;
    const away = f.awayTeam.name;
    const comp = f.season.competition.code;

    const score =
      f.homeScore !== null && f.awayScore !== null
        ? `${f.homeScore} - ${f.awayScore}`
        : null;
    const htScore =
      f.homeHtScore !== null && f.awayHtScore !== null
        ? `MT ${f.homeHtScore} - ${f.awayHtScore}`
        : null;

    const lambdaHome = readNumber(feat, "lambdaHome");
    const lambdaAway = readNumber(feat, "lambdaAway");
    const floorHit = readBool(feat, "lambdaFloorHit");
    const shadowLine = readNumber(feat, "shadow_lineMovement");
    const shadowH2h = readNumber(feat, "shadow_h2h");
    const shadowCong = readNumber(feat, "shadow_congestion");
    const candidatePicks = readPicks(feat, "candidatePicks");
    const evaluatedPicks = readPicks(feat, "evaluatedPicks");

    const detScore = run.deterministicScore
      ? Number(run.deterministicScore).toFixed(3)
      : "—";
    const finalScore = run.finalScore ? Number(run.finalScore).toFixed(3) : "—";

    const betPickLabel = bet
      ? pickLabel(bet.market, bet.pick, bet.comboMarket, bet.comboPick)
      : "—";
    const betMarketLabel = bet ? marketFullLabel(bet.market) : "—";
    const betStatus = bet ? betStatusLabel(bet.status) : "—";
    const betEv = bet ? fmtSigned(Number(bet.ev), 3) : "—";
    const betProb = bet
      ? `${(Number(bet.probEstimated) * 100).toFixed(1)}%`
      : "—";

    const scoreLine = score
      ? htScore
        ? `${betStatus} · ${score} (${htScore})`
        : `${betStatus} · ${score}`
      : "En cours / À jouer";

    w();
    w(`── Sélection ${selIdx} ─────────────────────────────────────────`);
    w(`${home} vs ${away} · ${betMarketLabel} · ${betPickLabel}`);
    w(`[${comp}]  ${scoreLine}`);
    w();
    w("Entrées modèle");
    w(`  Score det / final  : ${detScore} / ${finalScore}`);
    if (bet) {
      w(`  Prob. estimée      : ${betProb}`);
    }
    if (lambdaHome !== null) {
      w(`  λ V1               : ${lambdaHome.toFixed(2)}`);
    }
    if (lambdaAway !== null) {
      w(`  λ V2               : ${lambdaAway.toFixed(2)}`);
    }
    if (lambdaHome !== null && lambdaAway !== null) {
      w(`  Buts attendus      : ${(lambdaHome + lambdaAway).toFixed(2)}`);
    }
    if (floorHit) {
      w(`  lambdaFloorHit     : oui (λ_away plafonné)`);
    }
    if (shadowLine !== null || shadowH2h !== null || shadowCong !== null) {
      w("  Facteurs shadow    :");
      if (shadowLine !== null)
        w(`    lineMovement  : ${shadowLine.toFixed(4)}`);
      if (shadowH2h !== null) w(`    h2h           : ${shadowH2h.toFixed(4)}`);
      if (shadowCong !== null)
        w(`    congestion    : ${shadowCong.toFixed(4)}`);
    }
    if (bet) {
      w(`  EV sélectionné     : ${betEv}`);
    }

    if (candidatePicks.length > 0) {
      w();
      w(`Picks candidats (${candidatePicks.length})`);
      for (const p of candidatePicks) {
        const label = pickLabel(
          p.market,
          p.pick,
          p.comboMarket,
          p.comboPick,
        ).padEnd(28);
        w(
          `  ${label}  Prob.: ${p.probability.toFixed(4)}  Cote: ${p.odds.toFixed(2)}  EV: ${fmtSigned(p.ev, 4)}  Qualité: ${p.qualityScore.toFixed(4)}`,
        );
      }
    }

    if (evaluatedPicks.length > 0) {
      w();
      w(`Picks évalués (${evaluatedPicks.length})`);
      for (const p of evaluatedPicks) {
        const label = pickLabel(
          p.market,
          p.pick,
          p.comboMarket,
          p.comboPick,
        ).padEnd(28);
        const statusLabel =
          p.status === "viable"
            ? "Viable"
            : `Rejeté  (${p.rejectionReason ? rejectionLabel(p.rejectionReason) : "?"})`;
        w(
          `  ${label}  Prob.: ${p.probability.toFixed(4)}  Cote: ${p.odds.toFixed(2)}  EV: ${fmtSigned(p.ev, 4)}  Qualité: ${p.qualityScore.toFixed(4)}  ${statusLabel}`,
        );
      }
    }
  }

  // ── NO_BET — picks évalués pour comprendre le rejet ─────────────────────────

  w();
  w(
    `── NO_BET (${noBetFixtures.length}) — picks évalués ──────────────────────`,
  );

  if (noBetFixtures.length === 0) {
    w("  Aucun.");
  }

  for (const f of noBetFixtures) {
    const run = f.modelRuns[0]!;
    const feat = run.features;
    const home = f.homeTeam.name;
    const away = f.awayTeam.name;
    const comp = f.season.competition.code;
    const score =
      f.homeScore !== null && f.awayScore !== null
        ? `${f.homeScore} - ${f.awayScore}`
        : "—";
    const lambdaHome = readNumber(feat, "lambdaHome");
    const lambdaAway = readNumber(feat, "lambdaAway");
    const evaluatedPicks = readPicks(feat, "evaluatedPicks");
    const detScore = run.deterministicScore
      ? Number(run.deterministicScore).toFixed(3)
      : "—";
    const finalScore = run.finalScore ? Number(run.finalScore).toFixed(3) : "—";

    w();
    const lambdaInfo =
      lambdaHome !== null && lambdaAway !== null
        ? `  λH=${lambdaHome.toFixed(2)}  λA=${lambdaAway.toFixed(2)}  xG=${(lambdaHome + lambdaAway).toFixed(2)}`
        : "";
    w(
      `  [${comp}]  ${home} vs ${away}  ${score}  score=${detScore}→${finalScore}${lambdaInfo}`,
    );

    if (evaluatedPicks.length > 0) {
      for (const p of evaluatedPicks) {
        const label = pickLabel(
          p.market,
          p.pick,
          p.comboMarket,
          p.comboPick,
        ).padEnd(26);
        const statusLabel =
          p.status === "viable"
            ? "Viable"
            : `Rejeté  (${p.rejectionReason ? rejectionLabel(p.rejectionReason) : "?"})`;
        w(
          `    ${label}  EV: ${fmtSigned(p.ev, 4)}  P: ${(p.probability * 100).toFixed(1)}%  ${statusLabel}`,
        );
      }
    } else {
      w("    Aucun pick évalué en base.");
    }
  }

  // ── Sans run ────────────────────────────────────────────────────────────────

  if (noRunFixtures.length > 0) {
    w();
    w(
      `── Sans model run (${noRunFixtures.length}) ────────────────────────────`,
    );
    for (const f of noRunFixtures) {
      const comp = f.season.competition.code;
      w(
        `  [${comp}]  ${f.homeTeam.name} vs ${f.awayTeam.name}  status=${f.status}`,
      );
    }
  }

  w();
  w("═══════════════════════════════════════════════════════");

  const output = lines.join("\n");
  console.log(output);

  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const filePath = join(reportsDir, `audit-fixtures-${dateLabel}.txt`);
  writeFileSync(filePath, output, "utf-8");
  console.log(`\nReport saved → ${filePath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
