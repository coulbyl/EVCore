/// <reference types="node" />
/**
 * Diagnostics moteur par canal — run with: pnpm --filter @evcore/db db:audit:fixtures [YYYY-MM-DD]
 * Affiche les picks groupés par canal : VALUE, SV, BB, NUL, CONF, BUTS.
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
    if (pick === "OVER_1_5") return "PLUS DE 1.5";
    if (pick === "UNDER_1_5") return "MOINS DE 1.5";
    if (pick === "OVER") return "PLUS DE 2.5";
    if (pick === "UNDER") return "MOINS DE 2.5";
    if (pick === "OVER_3_5") return "PLUS DE 3.5";
    if (pick === "UNDER_3_5") return "MOINS DE 3.5";
    if (pick === "OVER_4_5") return "PLUS DE 4.5";
    if (pick === "UNDER_4_5") return "MOINS DE 4.5";
  }
  if (market === "BTTS") {
    if (pick === "YES") return "BB OUI";
    if (pick === "NO") return "BB NON";
  }
  if (market === "OVER_UNDER_HT") {
    if (pick === "OVER_0_5") return "PLUS DE 0.5 MT";
    if (pick === "UNDER_0_5") return "MOINS DE 0.5 MT";
    if (pick === "OVER_1_5") return "PLUS DE 1.5 MT";
    if (pick === "UNDER_1_5") return "MOINS DE 1.5 MT";
  }
  if (market === "FIRST_HALF_WINNER") {
    if (pick === "HOME") return "MT V1";
    if (pick === "DRAW") return "MT NUL";
    if (pick === "AWAY") return "MT V2";
  }
  if (market === "HALF_TIME_FULL_TIME") {
    if (pick === "HOME_HOME") return "V1 / V1";
    if (pick === "HOME_DRAW") return "V1 / NUL";
    if (pick === "HOME_AWAY") return "V1 / V2";
    if (pick === "DRAW_HOME") return "NUL / V1";
    if (pick === "DRAW_DRAW") return "NUL / NUL";
    if (pick === "DRAW_AWAY") return "NUL / V2";
    if (pick === "AWAY_HOME") return "V2 / V1";
    if (pick === "AWAY_DRAW") return "V2 / NUL";
    if (pick === "AWAY_AWAY") return "V2 / V2";
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
  if (reason === "under_high_lambda") return "Under rejeté (λ élevé)";
  return reason;
}

function betStatusLabel(status: string): string {
  if (status === "WON") return "GAGNÉ ✓";
  if (status === "LOST") return "PERDU ✗";
  if (status === "VOID") return "NUL (remboursé)";
  return "En cours";
}

function predResultLabel(correct: boolean | null): string {
  if (correct === true) return "CORRECT ✓";
  if (correct === false) return "INCORRECT ✗";
  return "En cours";
}

function channelLabel(channel: string): string {
  if (channel === "VALUE") return "EV";
  if (channel === "SAFE") return "SV";
  if (channel === "BTTS") return "BB";
  if (channel === "DRAW") return "NUL";
  if (channel === "DOMINANT") return "CONF";
  if (channel === "GOALS") return "BUTS";
  return channel;
}

// Mirrors GOALS_PICK in packages/analysis-core/src/strategies/goals.strategy.ts
// — the 2.5 line keeps the bare OVER/UNDER pick strings for historical reasons.
const GOALS_PICK_LINE: Record<
  string,
  { side: "OVER" | "UNDER"; line: number }
> = {
  OVER_1_5: { side: "OVER", line: 1.5 },
  UNDER_1_5: { side: "UNDER", line: 1.5 },
  OVER: { side: "OVER", line: 2.5 },
  UNDER: { side: "UNDER", line: 2.5 },
  OVER_3_5: { side: "OVER", line: 3.5 },
  UNDER_3_5: { side: "UNDER", line: 3.5 },
  OVER_4_5: { side: "OVER", line: 4.5 },
  UNDER_4_5: { side: "UNDER", line: 4.5 },
};

function parseGoalsPick(
  pick: string,
): { side: "OVER" | "UNDER"; line: number } | null {
  return GOALS_PICK_LINE[pick] ?? null;
}

function fmtSigned(n: number, decimals = 4): string {
  const s = n.toFixed(decimals);
  return n >= 0 ? `+${s}` : s;
}

function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
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

function readString(features: unknown, key: string): string | null {
  if (!features || typeof features !== "object") return null;
  const entry = features as Record<string, unknown>;
  const value = entry[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNullableBool(features: unknown, key: string): boolean | null {
  if (!features || typeof features !== "object") return null;
  const entry = features as Record<string, unknown>;
  const value = entry[key];
  return typeof value === "boolean" ? value : null;
}

// Keep in sync with MODEL_SCORE_THRESHOLD_MAP in ev.constants.ts
function getModelScoreThreshold(code: string): number {
  const map: Record<string, number> = {
    PL: 0.58,
    SA: 0.6,
    BL1: 0.55,
    LL: 0.58,
    L1: 0.58,
    J1: 0.55,
    MX1: 0.55,
    CH: 0.5,
    D2: 0.55,
    F2: 0.58,
    SP2: 0.62,
    I2: 0.6,
    EL1: 0.5,
    EL2: 0.45,
    UCL: 0.45,
    LDC: 0.45,
    UEL: 0.55,
    UECL: 0.45,
    WCQE: 0.6,
    FRI: 0.45,
    UNL: 0.6,
  };
  return map[code] ?? 0.6;
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderFixtureHeader(
  home: string,
  away: string,
  comp: string,
  homeScore: number | null,
  awayScore: number | null,
  homeHtScore: number | null,
  awayHtScore: number | null,
): string {
  const score =
    homeScore !== null && awayScore !== null
      ? `${homeScore} - ${awayScore}`
      : null;
  const htScore =
    homeHtScore !== null && awayHtScore !== null
      ? `MT ${homeHtScore}-${awayHtScore}`
      : null;
  const scoreStr = score
    ? htScore
      ? `${score} (${htScore})`
      : score
    : "À jouer";
  return `[${comp}] ${home} vs ${away}  ${scoreStr}`;
}

function renderModelContext(
  feat: unknown,
  comp: string,
  detScore: string,
  finalScore: string,
): string[] {
  const out: string[] = [];
  const modelThreshold = getModelScoreThreshold(comp).toFixed(2);
  const lambdaHome = readNumber(feat, "lambdaHome");
  const lambdaAway = readNumber(feat, "lambdaAway");
  const predictionSource = readString(feat, "predictionSource");
  const floorHit = readBool(feat, "lambdaFloorHit");
  const shadowLine = readNumber(feat, "shadow_lineMovement");
  const shadowH2h = readNumber(feat, "shadow_h2h");
  const shadowCong = readNumber(feat, "shadow_congestion");

  const srcPart = predictionSource ? `  source=${predictionSource}` : "";
  out.push(
    `  Modèle   : det=${detScore} → final=${finalScore}  seuil=${modelThreshold}${srcPart}`,
  );

  if (lambdaHome !== null && lambdaAway !== null) {
    const floor = floorHit ? " [λ_away plafonné]" : "";
    out.push(
      `  Poisson  : λV1=${lambdaHome.toFixed(2)}  λV2=${lambdaAway.toFixed(2)}  xG=${(lambdaHome + lambdaAway).toFixed(2)}${floor}`,
    );
  } else if (lambdaHome !== null) {
    out.push(`  λV1      : ${lambdaHome.toFixed(2)}`);
  } else if (lambdaAway !== null) {
    out.push(`  λV2      : ${lambdaAway.toFixed(2)}`);
  }

  const shadowParts: string[] = [];
  if (shadowLine !== null) shadowParts.push(`line=${fmtSigned(shadowLine, 4)}`);
  if (shadowH2h !== null) shadowParts.push(`h2h=${fmtSigned(shadowH2h, 4)}`);
  if (shadowCong !== null) shadowParts.push(`cong=${fmtSigned(shadowCong, 4)}`);
  if (shadowParts.length > 0) {
    out.push(`  Shadow   : ${shadowParts.join("  ")}`);
  }

  return out;
}

function renderSelectionPickLine(selection: {
  channel: string;
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  ev: unknown;
  qualityScore: unknown;
  probability: unknown;
  odds: unknown;
  result: string | null;
}): string {
  const label = pickLabel(
    selection.market,
    selection.pick,
    selection.comboMarket,
    selection.comboPick,
  );
  const ev = selection.ev != null ? Number(selection.ev) : 0;
  const prob = Number(selection.probability);
  const qs =
    selection.qualityScore != null
      ? Number(selection.qualityScore).toFixed(4)
      : "—";
  const odds = selection.odds != null ? Number(selection.odds).toFixed(2) : "—";
  const canal = `[${channelLabel(selection.channel)}]`;
  return `  Pick ${canal}  ${label.padEnd(28)}  Prob: ${fmtPct(prob)}  Cote: ${odds}  EV: ${fmtSigned(ev, 3)}  Qualité: ${qs}  ${betStatusLabel(selection.result ?? "PENDING")}`;
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
          deterministicScore: true,
          finalScore: true,
          features: true,
          analyzedAt: true,
          channelDecisions: {
            select: {
              channel: true,
              status: true,
              selections: {
                select: {
                  id: true,
                  market: true,
                  pick: true,
                  comboMarket: true,
                  comboPick: true,
                  ev: true,
                  qualityScore: true,
                  probability: true,
                  odds: true,
                  result: true,
                },
                orderBy: [
                  { qualityScore: { sort: "desc", nulls: "last" } },
                  { ev: { sort: "desc", nulls: "last" } },
                ],
              },
            },
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

  // ── Catégoriser ──────────────────────────────────────────────────────────────

  const selectedByChannel = (
    fixture: (typeof fixtures)[number],
    channel: string,
  ) =>
    fixture.modelRuns[0]?.channelDecisions
      .filter((decision) => decision.channel === channel)
      .flatMap((decision) =>
        decision.selections.map((selection) => ({
          ...selection,
          channel: decision.channel,
        })),
      ) ?? [];

  const evFixtures = fixtures.filter(
    (f) => selectedByChannel(f, "VALUE").length > 0,
  );
  const svFixtures = fixtures.filter(
    (f) => selectedByChannel(f, "SAFE").length > 0,
  );
  const bttsFixtures = fixtures.filter(
    (f) => selectedByChannel(f, "BTTS").length > 0,
  );
  const drawFixtures = fixtures.filter(
    (f) => selectedByChannel(f, "DRAW").length > 0,
  );
  const confFixtures = fixtures.filter(
    (f) => selectedByChannel(f, "DOMINANT").length > 0,
  );
  const goalsFixtures = fixtures.filter(
    (f) => selectedByChannel(f, "GOALS").length > 0,
  );
  const noBetFixtures = fixtures.filter(
    (f) => f.modelRuns.length > 0 && selectedByChannel(f, "VALUE").length === 0,
  );
  const noRunFixtures = fixtures.filter((f) => f.modelRuns.length === 0);

  const betFixtureCount = evFixtures.length;

  // ── Résumé canaux ─────────────────────────────────────────────────────────

  const evSelections = evFixtures.flatMap((f) => selectedByChannel(f, "VALUE"));
  const svSelections = svFixtures.flatMap((f) => selectedByChannel(f, "SAFE"));
  const bttsSelections = bttsFixtures.flatMap((f) =>
    selectedByChannel(f, "BTTS"),
  );
  const drawSelections = drawFixtures.flatMap((f) =>
    selectedByChannel(f, "DRAW"),
  );
  const confSelections = confFixtures.flatMap((f) =>
    selectedByChannel(f, "DOMINANT"),
  );
  const goalsSelections = goalsFixtures.flatMap((f) =>
    selectedByChannel(f, "GOALS"),
  );

  function countSelectionRes(selections: Array<{ result: string | null }>) {
    return {
      won: selections.filter((selection) => selection.result === "WON").length,
      lost: selections.filter((selection) => selection.result === "LOST")
        .length,
      pending: selections.filter(
        (selection) =>
          selection.result !== "WON" &&
          selection.result !== "LOST" &&
          selection.result !== "VOID",
      ).length,
    };
  }

  const evStats = countSelectionRes(evSelections);
  const svStats = countSelectionRes(svSelections);
  const bttsStats = countSelectionRes(bttsSelections);
  const drawStats = countSelectionRes(drawSelections);
  const confStats = countSelectionRes(confSelections);
  const goalsStats = countSelectionRes(goalsSelections);

  // ── En-tête ───────────────────────────────────────────────────────────────

  w("═══════════════════════════════════════════════════════");
  w(`  EVCore — Picks par canal — ${dateLabel}`);
  w(`  Généré : ${generatedAt}`);
  w(
    `  Fixtures : ${fixtures.length}  |  EV: ${betFixtureCount}  Sans EV: ${noBetFixtures.length}  Sans run: ${noRunFixtures.length}`,
  );
  w("═══════════════════════════════════════════════════════");
  w();

  const p = (s: string, n: number) => s.padEnd(n);
  const pL = (s: string, n: number) => s.padStart(n);

  w(
    "── Résumé canaux ──────────────────────────────────────────────────────────",
  );
  w();
  w(
    `  ${p("Canal", 8)}${pL("Picks", 7)}${pL("Correct", 9)}${pL("Incorrect", 11)}${pL("En cours", 10)}`,
  );
  w("  " + "─".repeat(45));

  const cRow = (
    label: string,
    count: number,
    won: number,
    lost: number,
    pending: number,
  ) =>
    w(
      `  ${p(label, 8)}${pL(String(count), 7)}${pL(String(won), 9)}${pL(String(lost), 11)}${pL(String(pending), 10)}`,
    );

  cRow("EV", evSelections.length, evStats.won, evStats.lost, evStats.pending);
  cRow("SV", svSelections.length, svStats.won, svStats.lost, svStats.pending);
  cRow(
    "BB",
    bttsSelections.length,
    bttsStats.won,
    bttsStats.lost,
    bttsStats.pending,
  );
  cRow(
    "NUL",
    drawSelections.length,
    drawStats.won,
    drawStats.lost,
    drawStats.pending,
  );
  cRow(
    "CONF",
    confSelections.length,
    confStats.won,
    confStats.lost,
    confStats.pending,
  );
  cRow(
    "BUTS",
    goalsSelections.length,
    goalsStats.won,
    goalsStats.lost,
    goalsStats.pending,
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // EV — Expected Value
  // ─────────────────────────────────────────────────────────────────────────────

  w();
  w(
    `━━━ EV — Expected Value (${evSelections.length} picks, ${evFixtures.length} matchs) ━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  );

  if (evFixtures.length === 0) {
    w("  Aucune sélection EV ce jour.");
  }

  let idx = 0;
  for (const f of evFixtures) {
    idx++;
    const run = f.modelRuns[0]!;
    const feat = run.features;
    const comp = f.season.competition.code;
    const detScore = run.deterministicScore
      ? Number(run.deterministicScore).toFixed(3)
      : "—";
    const finalScore = run.finalScore ? Number(run.finalScore).toFixed(3) : "—";

    w();
    w(
      `  [${idx}] ${renderFixtureHeader(f.homeTeam.name, f.awayTeam.name, comp, f.homeScore, f.awayScore, f.homeHtScore, f.awayHtScore)}`,
    );

    for (const selection of selectedByChannel(f, "VALUE")) {
      w(renderSelectionPickLine(selection));
    }
    for (const line of renderModelContext(feat, comp, detScore, finalScore)) {
      w(line);
    }

    const evaluatedPicks = readPicks(feat, "evaluatedPicks");
    if (evaluatedPicks.length > 0) {
      w(`  Évalués (${evaluatedPicks.length}) :`);
      for (const ep of evaluatedPicks) {
        const label = pickLabel(
          ep.market,
          ep.pick,
          ep.comboMarket,
          ep.comboPick,
        ).padEnd(26);
        const st =
          ep.status === "viable"
            ? "Viable"
            : `Rejeté (${ep.rejectionReason ? rejectionLabel(ep.rejectionReason) : "?"})`;
        w(
          `    ${label}  P: ${fmtPct(ep.probability)}  Cote: ${ep.odds.toFixed(2)}  EV: ${fmtSigned(ep.ev, 3)}  ${st}`,
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SV — Safe Value
  // ─────────────────────────────────────────────────────────────────────────────

  w();
  w(
    `━━━ SV — Safe Value (${svSelections.length} picks, ${svFixtures.length} matchs) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  );

  if (svFixtures.length === 0) {
    w("  Aucune sélection SV ce jour.");
  }

  idx = 0;
  for (const f of svFixtures) {
    idx++;
    const run = f.modelRuns[0]!;
    const feat = run.features;
    const comp = f.season.competition.code;
    const detScore = run.deterministicScore
      ? Number(run.deterministicScore).toFixed(3)
      : "—";
    const finalScore = run.finalScore ? Number(run.finalScore).toFixed(3) : "—";

    w();
    w(
      `  [${idx}] ${renderFixtureHeader(f.homeTeam.name, f.awayTeam.name, comp, f.homeScore, f.awayScore, f.homeHtScore, f.awayHtScore)}`,
    );

    for (const selection of selectedByChannel(f, "SAFE")) {
      w(renderSelectionPickLine(selection));
    }
    for (const line of renderModelContext(feat, comp, detScore, finalScore)) {
      w(line);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BB — Les deux équipes marquent (BTTS)
  // ─────────────────────────────────────────────────────────────────────────────

  w();
  w(
    `━━━ BB — Les deux équipes marquent (${bttsSelections.length} picks, ${bttsFixtures.length} matchs) ━━━━━━━━━━━━`,
  );

  if (bttsFixtures.length === 0) {
    w("  Aucun pronostic BB ce jour.");
  }

  idx = 0;
  for (const f of bttsFixtures) {
    idx++;
    const selection = selectedByChannel(f, "BTTS")[0]!;
    const run = f.modelRuns[0];
    const feat = run?.features;
    const comp = f.season.competition.code;
    const prob = Number(selection.probability);
    const lambdaHome = readNumber(feat, "lambdaHome");
    const lambdaAway = readNumber(feat, "lambdaAway");
    const floorHit = readBool(feat, "lambdaFloorHit");
    const source = readString(feat, "predictionSource");

    const pickLbl =
      selection.pick === "YES"
        ? "BB OUI"
        : selection.pick === "NO"
          ? "BB NON"
          : selection.pick;

    // Validate result from actual score
    let resultHint = "";
    if (f.homeScore !== null && f.awayScore !== null) {
      const bothScored = f.homeScore > 0 && f.awayScore > 0;
      if (selection.pick === "YES" && bothScored)
        resultHint = "  ← Les deux ont marqué ✓";
      else if (selection.pick === "YES" && !bothScored)
        resultHint = "  ← Pas les deux ✗";
      else if (selection.pick === "NO" && !bothScored)
        resultHint = "  ← Correct ✓";
      else if (selection.pick === "NO" && bothScored)
        resultHint = "  ← Les deux ont marqué ✗";
    }

    w();
    w(
      `  [${idx}] ${renderFixtureHeader(f.homeTeam.name, f.awayTeam.name, comp, f.homeScore, f.awayScore, f.homeHtScore, f.awayHtScore)}`,
    );
    w(
      `  Pick     : ${pickLbl.padEnd(12)}  P=${fmtPct(prob)}  ${predResultLabel(selection.result === "WON" ? true : selection.result === "LOST" ? false : null)}${resultHint}`,
    );

    if (lambdaHome !== null && lambdaAway !== null) {
      const xg = lambdaHome + lambdaAway;
      const floor = floorHit ? " [λ_away plafonné]" : "";
      w(
        `  Poisson  : λV1=${lambdaHome.toFixed(2)}  λV2=${lambdaAway.toFixed(2)}  xG=${xg.toFixed(2)}${floor}`,
      );
      const lambdaMin = Math.min(lambdaHome, lambdaAway);
      const hint =
        xg >= 2.5 && lambdaMin >= 0.7
          ? "↑ xG élevé + λ_min solide → BB fort"
          : lambdaMin < 0.5
            ? "↓ λ_min faible → équipe peu prolixe"
            : xg < 1.8
              ? "↓ xG faible → pick BB risqué"
              : "~ Signal BB modéré";
      w(`  Signal   : ${hint}`);
    }
    if (source) w(`  Source   : ${source}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NUL — Match nul (DRAW)
  // ─────────────────────────────────────────────────────────────────────────────

  w();
  w(
    `━━━ NUL — Match nul (${drawSelections.length} picks, ${drawFixtures.length} matchs) ━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  );

  if (drawFixtures.length === 0) {
    w("  Aucun pronostic NUL ce jour.");
  }

  idx = 0;
  for (const f of drawFixtures) {
    idx++;
    const selection = selectedByChannel(f, "DRAW")[0]!;
    const run = f.modelRuns[0];
    const feat = run?.features;
    const comp = f.season.competition.code;
    const prob = Number(selection.probability);
    const lambdaHome = readNumber(feat, "lambdaHome");
    const lambdaAway = readNumber(feat, "lambdaAway");
    const source = readString(feat, "predictionSource");

    let resultHint = "";
    if (f.homeScore !== null && f.awayScore !== null) {
      const isDraw = f.homeScore === f.awayScore;
      resultHint = isDraw
        ? "  ← Match nul ✓"
        : `  ← ${f.homeScore}-${f.awayScore} ✗`;
    }

    w();
    w(
      `  [${idx}] ${renderFixtureHeader(f.homeTeam.name, f.awayTeam.name, comp, f.homeScore, f.awayScore, f.homeHtScore, f.awayHtScore)}`,
    );
    w(
      `  Pick     : NUL  P=${fmtPct(prob)}  ${predResultLabel(selection.result === "WON" ? true : selection.result === "LOST" ? false : null)}${resultHint}`,
    );

    if (lambdaHome !== null && lambdaAway !== null) {
      const xg = lambdaHome + lambdaAway;
      const balance = Math.abs(lambdaHome - lambdaAway);
      w(
        `  Poisson  : λV1=${lambdaHome.toFixed(2)}  λV2=${lambdaAway.toFixed(2)}  xG=${xg.toFixed(2)}  |Δλ|=${balance.toFixed(2)}`,
      );
      const hint =
        balance <= 0.2 && xg < 2.2
          ? "↑ Équilibre fort + faible xG → NUL solide"
          : balance <= 0.3
            ? "~ Bon équilibre λ"
            : balance > 0.6
              ? "↓ Déséquilibre λ élevé → NUL improbable"
              : "~ Signal NUL modéré";
      w(`  Signal   : ${hint}`);
    }
    if (source) w(`  Source   : ${source}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONF — Confiance (argmax 1X2)
  // ─────────────────────────────────────────────────────────────────────────────

  w();
  w(
    `━━━ CONF — Confiance (${confSelections.length} picks, ${confFixtures.length} matchs) ━━━━━━━━━━━━━━━━━━━━━━━━━`,
  );

  if (confFixtures.length === 0) {
    w("  Aucun pronostic CONF ce jour.");
  }

  idx = 0;
  for (const f of confFixtures) {
    idx++;
    const selection = selectedByChannel(f, "DOMINANT")[0]!;
    const run = f.modelRuns[0];
    const feat = run?.features;
    const comp = f.season.competition.code;
    const prob = Number(selection.probability);
    const modelThreshold = getModelScoreThreshold(comp);
    const lambdaHome = readNumber(feat, "lambdaHome");
    const lambdaAway = readNumber(feat, "lambdaAway");
    const source = readString(feat, "predictionSource");

    w();
    w(
      `  [${idx}] ${renderFixtureHeader(f.homeTeam.name, f.awayTeam.name, comp, f.homeScore, f.awayScore, f.homeHtScore, f.awayHtScore)}`,
    );
    w(
      `  Pick     : ${singlePickLabel(selection.market, selection.pick).padEnd(10)}  P=${fmtPct(prob)}  seuil ligue=${modelThreshold.toFixed(2)}  ${predResultLabel(selection.result === "WON" ? true : selection.result === "LOST" ? false : null)}`,
    );

    if (lambdaHome !== null && lambdaAway !== null) {
      w(
        `  Poisson  : λV1=${lambdaHome.toFixed(2)}  λV2=${lambdaAway.toFixed(2)}  xG=${(lambdaHome + lambdaAway).toFixed(2)}`,
      );
    }

    if (run) {
      const detScore = run.deterministicScore
        ? Number(run.deterministicScore).toFixed(3)
        : "—";
      const finalScoreStr = run.finalScore
        ? Number(run.finalScore).toFixed(3)
        : "—";
      const finalScoreNum = run.finalScore ? Number(run.finalScore) : null;
      const flag =
        finalScoreNum !== null
          ? finalScoreNum >= modelThreshold
            ? "✓ score > seuil"
            : "✗ score < seuil"
          : "";
      w(`  Modèle   : det=${detScore} → final=${finalScoreStr}  ${flag}`);
    }
    if (source) w(`  Source   : ${source}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BUTS — Total de buts (GOALS)
  // ─────────────────────────────────────────────────────────────────────────────

  w();
  w(
    `━━━ BUTS — Total de buts (${goalsSelections.length} picks, ${goalsFixtures.length} matchs) ━━━━━━━━━━━━━━━━━━━━━━━━━`,
  );

  if (goalsFixtures.length === 0) {
    w("  Aucun pronostic BUTS ce jour.");
  }

  idx = 0;
  for (const f of goalsFixtures) {
    idx++;
    const selection = selectedByChannel(f, "GOALS")[0]!;
    const run = f.modelRuns[0];
    const feat = run?.features;
    const comp = f.season.competition.code;
    const prob = Number(selection.probability);
    const lambdaHome = readNumber(feat, "lambdaHome");
    const lambdaAway = readNumber(feat, "lambdaAway");
    const source = readString(feat, "predictionSource");
    const goalsPick = parseGoalsPick(selection.pick);

    let resultHint = "";
    if (goalsPick && f.homeScore !== null && f.awayScore !== null) {
      const totalGoals = f.homeScore + f.awayScore;
      const correct =
        goalsPick.side === "OVER"
          ? totalGoals > goalsPick.line
          : totalGoals < goalsPick.line;
      resultHint = correct
        ? `  ← ${totalGoals} but${totalGoals > 1 ? "s" : ""} ✓`
        : `  ← ${totalGoals} but${totalGoals > 1 ? "s" : ""} ✗`;
    }

    w();
    w(
      `  [${idx}] ${renderFixtureHeader(f.homeTeam.name, f.awayTeam.name, comp, f.homeScore, f.awayScore, f.homeHtScore, f.awayHtScore)}`,
    );
    w(
      `  Pick     : ${singlePickLabel(selection.market, selection.pick).padEnd(14)}  P=${fmtPct(prob)}  ${predResultLabel(selection.result === "WON" ? true : selection.result === "LOST" ? false : null)}${resultHint}`,
    );

    if (lambdaHome !== null && lambdaAway !== null) {
      w(
        `  Poisson  : λV1=${lambdaHome.toFixed(2)}  λV2=${lambdaAway.toFixed(2)}  xG=${(lambdaHome + lambdaAway).toFixed(2)}`,
      );
    }
    if (source) w(`  Source   : ${source}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sans sélection EV — picks évalués pour comprendre le rejet
  // ─────────────────────────────────────────────────────────────────────────────

  w();
  w(
    `── Sans sélection EV (${noBetFixtures.length}) — raisons de rejet ────────────────────────────────────`,
  );

  if (noBetFixtures.length === 0) {
    w("  Aucun.");
  }

  for (const f of noBetFixtures) {
    const run = f.modelRuns[0]!;
    const feat = run.features;
    const comp = f.season.competition.code;
    const score =
      f.homeScore !== null && f.awayScore !== null
        ? `${f.homeScore} - ${f.awayScore}`
        : "—";
    const lambdaHome = readNumber(feat, "lambdaHome");
    const lambdaAway = readNumber(feat, "lambdaAway");
    const predictionSource = readString(feat, "predictionSource");
    const fallbackReason = readString(feat, "fallbackReason");
    const evaluatedPicks = readPicks(feat, "evaluatedPicks");
    const isSenior = readNullableBool(feat, "isSeniorNationalFixture");
    const hasMarketOdds = readNullableBool(feat, "hasMarketOdds");
    const hasPinnacleOdds = readNullableBool(feat, "hasPinnacleOdds");
    const hasHomeElo = readNullableBool(feat, "hasHomeElo");
    const hasAwayElo = readNullableBool(feat, "hasAwayElo");
    const detScore = run.deterministicScore
      ? Number(run.deterministicScore).toFixed(3)
      : "—";
    const finalScore = run.finalScore ? Number(run.finalScore).toFixed(3) : "—";
    const finalScoreNum = run.finalScore ? Number(run.finalScore) : null;
    const modelThreshold = getModelScoreThreshold(comp);

    w();
    const lambdaInfo =
      lambdaHome !== null && lambdaAway !== null
        ? `  λV1=${lambdaHome.toFixed(2)}  λV2=${lambdaAway.toFixed(2)}  xG=${(lambdaHome + lambdaAway).toFixed(2)}`
        : "";
    w(
      `  [${comp}] ${f.homeTeam.name} vs ${f.awayTeam.name}  ${score}  score=${detScore}→${finalScore}${lambdaInfo}`,
    );
    if (predictionSource) w(`    source=${predictionSource}`);
    if (fallbackReason) w(`    fallback=${fallbackReason}`);
    if (
      isSenior !== null ||
      hasMarketOdds !== null ||
      hasPinnacleOdds !== null ||
      hasHomeElo !== null ||
      hasAwayElo !== null
    ) {
      w(
        `    contexte: senior=${isSenior ?? "?"}  marketOdds=${hasMarketOdds ?? "?"}  pinnacle=${hasPinnacleOdds ?? "?"}  eloHome=${hasHomeElo ?? "?"}  eloAway=${hasAwayElo ?? "?"}`,
      );
    }

    const scoreFlag =
      finalScoreNum !== null && finalScoreNum < modelThreshold
        ? ` (score < seuil ${modelThreshold.toFixed(2)})`
        : "";

    for (const ep of evaluatedPicks) {
      const label = pickLabel(
        ep.market,
        ep.pick,
        ep.comboMarket,
        ep.comboPick,
      ).padEnd(26);
      const st =
        ep.status === "viable"
          ? `Viable pick-level${scoreFlag}`
          : `Rejeté (${ep.rejectionReason ? rejectionLabel(ep.rejectionReason) : "?"})`;
      w(
        `    ${label}  EV: ${fmtSigned(ep.ev, 3)}  P: ${fmtPct(ep.probability)}  ${st}`,
      );
    }
    if (evaluatedPicks.length === 0) {
      w("    Aucun pick évalué.");
    }
  }

  // ── Sans run ──────────────────────────────────────────────────────────────

  if (noRunFixtures.length > 0) {
    w();
    w(
      `── Sans model run (${noRunFixtures.length}) ───────────────────────────────────────────────────────`,
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
