import Decimal from "decimal.js";
import { asNumber, clamp } from "../math";
import type { MatchProbabilities } from "../selection/types";

export type TeamStatsInput = {
  recentForm: unknown;
  xgFor: unknown;
  xgAgainst: unknown;
  homeWinRate: unknown;
  awayWinRate: unknown;
  drawRate: unknown;
  leagueVolatility: unknown;
};

export type MatchupFeatures = {
  recentForm: Decimal;
  xg: Decimal;
  domExtPerf: Decimal;
  leagueVolat: Decimal;
};

// League-specific tuning injected by the app; the core only does arithmetic.
export type LambdaConfig = {
  meanLambda: number;
  homeAdvFactor: number;
  awayDisadvFactor: number;
  // Per-league goal-level correction applied to both lambdas. Corrects a
  // structural bias where the xG-shrinkage goal expectation is systematically
  // too high/low for a league (measured 2026-06-30: stable across seasons).
  // Optional, default 1.0 (no change) for unlisted leagues.
  lambdaScale?: number;
};

// Bayesian shrinkage weight toward the league mean lambda.
export const LAMBDA_SHRINKAGE_FACTOR = 0.7;

export function mapProbabilitiesToNumber(
  probabilities: MatchProbabilities,
): Record<string, number | Record<string, number>> {
  return {
    home: probabilities.home.toNumber(),
    draw: probabilities.draw.toNumber(),
    away: probabilities.away.toNumber(),
    over15: probabilities.over15.toNumber(),
    under15: probabilities.under15.toNumber(),
    over25: probabilities.over25.toNumber(),
    under25: probabilities.under25.toNumber(),
    over35: probabilities.over35.toNumber(),
    under35: probabilities.under35.toNumber(),
    over45: probabilities.over45.toNumber(),
    under45: probabilities.under45.toNumber(),
    bttsYes: probabilities.bttsYes.toNumber(),
    bttsNo: probabilities.bttsNo.toNumber(),
    dc1X: probabilities.dc1X.toNumber(),
    dcX2: probabilities.dcX2.toNumber(),
    dc12: probabilities.dc12.toNumber(),
    dnbHome: probabilities.dnbHome.toNumber(),
    dnbAway: probabilities.dnbAway.toNumber(),
    teamTotalHome: Object.fromEntries(
      Object.entries(probabilities.teamTotalHome).map(([pick, value]) => [
        pick,
        value?.toNumber() ?? 0,
      ]),
    ),
    teamTotalAway: Object.fromEntries(
      Object.entries(probabilities.teamTotalAway).map(([pick, value]) => [
        pick,
        value?.toNumber() ?? 0,
      ]),
    ),
    cleanSheetHome: probabilities.cleanSheetHome.toNumber(),
    cleanSheetAway: probabilities.cleanSheetAway.toNumber(),
    winToNilHome: probabilities.winToNilHome.toNumber(),
    winToNilAway: probabilities.winToNilAway.toNumber(),
    winEitherHalfHome: probabilities.winEitherHalfHome.toNumber(),
    winEitherHalfAway: probabilities.winEitherHalfAway.toNumber(),
    htft: Object.fromEntries(
      Object.entries(probabilities.htft).map(([pick, value]) => [
        pick,
        value.toNumber(),
      ]),
    ),
    ouHT: Object.fromEntries(
      Object.entries(probabilities.ouHT).map(([pick, value]) => [
        pick,
        value?.toNumber() ?? 0,
      ]),
    ),
    firstHalfWinner: {
      home: probabilities.firstHalfWinner.home.toNumber(),
      draw: probabilities.firstHalfWinner.draw.toNumber(),
      away: probabilities.firstHalfWinner.away.toNumber(),
    },
    secondHalfWinner: {
      home: probabilities.secondHalfWinner.home.toNumber(),
      draw: probabilities.secondHalfWinner.draw.toNumber(),
      away: probabilities.secondHalfWinner.away.toNumber(),
    },
    resultTotalGoals: Object.fromEntries(
      Object.entries(probabilities.resultTotalGoals).map(([pick, value]) => [
        pick,
        value?.toNumber() ?? 0,
      ]),
    ),
    resultBtts: Object.fromEntries(
      Object.entries(probabilities.resultBtts).map(([pick, value]) => [
        pick,
        value?.toNumber() ?? 0,
      ]),
    ),
  };
}

export function deriveLambdas(
  homeStats: TeamStatsInput,
  awayStats: TeamStatsInput,
  config: LambdaConfig,
): { home: number; away: number } {
  const homeXgFor = asNumber(homeStats.xgFor);
  const awayXgFor = asNumber(awayStats.xgFor);
  const homeXgAgainst = asNumber(homeStats.xgAgainst);
  const awayXgAgainst = asNumber(awayStats.xgAgainst);

  const leagueAvg = Math.max(
    0.5,
    (homeXgFor + awayXgFor + homeXgAgainst + awayXgAgainst) / 4,
  );

  const rawHome =
    LAMBDA_SHRINKAGE_FACTOR * ((homeXgFor * awayXgAgainst) / leagueAvg) +
    (1 - LAMBDA_SHRINKAGE_FACTOR) * config.meanLambda;
  const rawAway =
    LAMBDA_SHRINKAGE_FACTOR * ((awayXgFor * homeXgAgainst) / leagueAvg) +
    (1 - LAMBDA_SHRINKAGE_FACTOR) * config.meanLambda;

  const scale = config.lambdaScale ?? 1;
  return {
    home: clamp(rawHome * config.homeAdvFactor * scale, 0.05, 5),
    away: clamp(rawAway * config.awayDisadvFactor * scale, 0.05, 5),
  };
}

export type OffensiveBalanceClassification =
  | "BALANCED"
  | "ASYMMETRIC"
  | "STRONGLY_ASYMMETRIC";

export type OffensiveBalance = {
  ratio: number;
  classification: OffensiveBalanceClassification;
};

// Ratio of the weaker attack to the stronger one (1 = both teams carry equal
// offensive threat, near 0 = one team carries essentially all of it).
// Informational only — not consumed by any strategy threshold, exposed via
// ModelRun.features to the Eva analysis sheet to help distinguish Over/team
// total picks (asymmetric attack) from BTTS (balanced attack), per
// analyse-fiche-evcore-avec-gpt.md §12. Classification bounds are a
// reasonable placeholder, not backtested.
export function computeOffensiveBalance(
  lambdaHome: number,
  lambdaAway: number,
): OffensiveBalance {
  const stronger = Math.max(lambdaHome, lambdaAway);
  const weaker = Math.min(lambdaHome, lambdaAway);
  const ratio = stronger > 0 ? weaker / stronger : 1;
  const classification: OffensiveBalanceClassification =
    ratio >= 0.5
      ? "BALANCED"
      : ratio >= 0.25
        ? "ASYMMETRIC"
        : "STRONGLY_ASYMMETRIC";
  return { ratio, classification };
}

export function rebalanceThreeWayProbabilities(input: {
  probabilities: MatchProbabilities;
  homeStats: TeamStatsInput;
  awayStats: TeamStatsInput;
  blendWeight: Decimal;
}): MatchProbabilities {
  const { probabilities, homeStats, awayStats, blendWeight } = input;
  if (blendWeight.lte(0)) return probabilities;

  const targetDraw = clamp(
    (clamp(asNumber(homeStats.drawRate), 0.05, 0.6) +
      clamp(asNumber(awayStats.drawRate), 0.05, 0.6)) /
      2,
    0.05,
    0.6,
  );
  const homeWinRate = clamp(asNumber(homeStats.homeWinRate), 0.01, 0.95);
  const awayWinRate = clamp(asNumber(awayStats.awayWinRate), 0.01, 0.95);
  const directionalTargetBase = homeWinRate + awayWinRate;
  if (directionalTargetBase <= 0) return probabilities;

  const targetHomeShare = homeWinRate / directionalTargetBase;
  const targetHome = (1 - targetDraw) * targetHomeShare;
  const targetAway = 1 - targetDraw - targetHome;
  const weight = blendWeight.toNumber();

  const home = new Decimal(
    probabilities.home.toNumber() * (1 - weight) + targetHome * weight,
  );
  const draw = new Decimal(
    probabilities.draw.toNumber() * (1 - weight) + targetDraw * weight,
  );
  const away = new Decimal(
    probabilities.away.toNumber() * (1 - weight) + targetAway * weight,
  );

  const nonDrawMass = home.plus(away);

  // resultTotalGoals' UNDER picks are pure joint-distribution sums
  // (unaffected by rebalancing); OVER = oneXTwo[side] - UNDER, so only OVER
  // needs recomputing against the rebalanced home/draw/away to stay
  // internally consistent (under+over must still equal that side's mass).
  const sideProbability = { HOME: home, DRAW: draw, AWAY: away } as const;
  const resultTotalGoals = Object.fromEntries(
    Object.entries(probabilities.resultTotalGoals).map(([pick, under]) => {
      if (!pick.includes("_OVER_") || under === undefined) {
        return [pick, under];
      }
      const side = pick.split("_")[0] as keyof typeof sideProbability;
      const line = pick.replace(`${side}_OVER_`, "");
      const underPick = `${side}_UNDER_${line}`;
      const underValue =
        probabilities.resultTotalGoals[
          underPick as keyof typeof probabilities.resultTotalGoals
        ];
      if (underValue === undefined) return [pick, under];
      return [pick, Decimal.max(0, sideProbability[side].minus(underValue))];
    }),
  ) as MatchProbabilities["resultTotalGoals"];

  return {
    ...probabilities,
    home,
    draw,
    away,
    dc1X: home.plus(draw),
    dcX2: draw.plus(away),
    dc12: home.plus(away),
    dnbHome: nonDrawMass.isZero() ? new Decimal(0.5) : home.div(nonDrawMass),
    dnbAway: nonDrawMass.isZero() ? new Decimal(0.5) : away.div(nonDrawMass),
    resultTotalGoals,
  };
}

export function buildMatchupFeatures(
  homeStats: TeamStatsInput,
  awayStats: TeamStatsInput,
): MatchupFeatures {
  const recentForm = clamp01(
    (asNumber(homeStats.recentForm) + (1 - asNumber(awayStats.recentForm))) / 2,
  );
  const xg = clamp01(
    asNumber(homeStats.xgFor) /
      Math.max(0.1, asNumber(homeStats.xgFor) + asNumber(awayStats.xgFor)),
  );
  const domExtPerf = clamp01(
    (asNumber(homeStats.homeWinRate) + (1 - asNumber(awayStats.awayWinRate))) /
      2,
  );
  const leagueVolat = clamp01(
    Math.max(
      asNumber(homeStats.leagueVolatility),
      asNumber(awayStats.leagueVolatility),
    ) / 3,
  );

  return {
    recentForm: new Decimal(recentForm),
    xg: new Decimal(xg),
    domExtPerf: new Decimal(domExtPerf),
    leagueVolat: new Decimal(leagueVolat),
  };
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

type BlendTeamStatsInput = {
  primary: TeamStatsInput;
  secondary: TeamStatsInput;
  formWeight: number;
  xgWeight: number;
};

export function blendTeamStats({
  primary,
  secondary,
  formWeight,
  xgWeight,
}: BlendTeamStatsInput): TeamStatsInput {
  const fw1 = 1 - formWeight;
  const xw1 = 1 - xgWeight;
  return {
    recentForm:
      asNumber(primary.recentForm) * formWeight +
      asNumber(secondary.recentForm) * fw1,
    xgFor: asNumber(primary.xgFor) * xgWeight + asNumber(secondary.xgFor) * xw1,
    xgAgainst:
      asNumber(primary.xgAgainst) * xgWeight +
      asNumber(secondary.xgAgainst) * xw1,
    homeWinRate: secondary.homeWinRate,
    awayWinRate: secondary.awayWinRate,
    drawRate: secondary.drawRate,
    leagueVolatility: primary.leagueVolatility,
  };
}

// ─────────────────────────────────────────────
// Per-league weight for rebalanceThreeWayProbabilities above — moved
// 2026-08-19 from apps/backend/.../ev.constants.ts (THREE_WAY_EMPIRICAL_
// BLEND_WEIGHT_MAP), where it had accumulated alongside genuinely
// VALUE-specific config despite calibrating the shared 1X2 probability
// every channel reads (DOMINANT, VALUE, SAFE, CONSENSUS...), not a staking
// decision — same category as OU_SHRINKAGE_CONFIG (ou-shrinkage.ts).
// ─────────────────────────────────────────────

// League-specific 1X2 empirical rebalance applied after Poisson computation.
// The Poisson core remains the primary signal; this weight blends the raw
// HOME/DRAW/AWAY vector toward empirical team rates derived from TeamStats.
// Use sparingly for leagues where xG-only probabilities stay miscalibrated.
const THREE_WAY_EMPIRICAL_BLEND_WEIGHT_MAP: Record<string, Decimal> = {
  // I2 backtest 2026-04-24: after lowering lambda and neutralizing HA, ROI
  // became healthy again but Brier still failed at 0.669 and calibration at
  // 0.056. The remaining issue is the 1X2 distribution: TeamStats already
  // carries homeWinRate / awayWinRate / drawRate, but Poisson uses only xG.
  // Blend 45% toward those empirical rates to reduce over-confident tails
  // without disturbing totals markets, which are already the profitable axis.
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): re-fit à 0.40 (ΔBrier test -0.0065, n train=675/test=340).
  I2: new Decimal("0.40"),
  // D2 audit 2026-04-25: S2 (2024-25) Brier 0.6915 vs floor 0.6416 — the model
  // over-predicts away wins (S1 had 32.7% away rate; S2 collapsed to 28.7%).
  // The Poisson core doesn't see team roster changes at season boundaries; the
  // empirical blend pulls 1X2 toward per-team actual rates, reducing S2 noise.
  // Tested 0.25/0.35/0.45: 0.30 is the Brier optimum (0.651 overall).
  // Side-effect: DRAW picks at ~4.0 odds emerge (6 bets 3W/3L, +99% ROI).
  // D2 retiré 2026-08-19 (db:backtest:three-way-empirical-blend-calibration) : le meilleur poids trouvé par grid-search sur le train (ci-dessus) ne généralise pas au hors-échantillon (ΔBrier test négatif à tout poids testé, walk-forward saisonnier) — le réglage ci-dessus reposait sur un diagnostic ponctuel, jamais validé walk-forward. Retombe sur le défaut 0 (getLeagueThreeWayEmpiricalBlendWeight).
  // F2 audit 2026-04-24: the league fails Brier by a narrow margin (0.659 vs
  // 0.65) while 1X2 HOME remains profitable. Test a light empirical rebalance
  // before touching home-advantage or selection filters.
  // F2 retiré 2026-08-19 (db:backtest:three-way-empirical-blend-calibration) : le meilleur poids trouvé par grid-search sur le train (ci-dessus) ne généralise pas au hors-échantillon (ΔBrier test négatif à tout poids testé, walk-forward saisonnier) — le réglage ci-dessus reposait sur un diagnostic ponctuel, jamais validé walk-forward. Retombe sur le défaut 0 (getLeagueThreeWayEmpiricalBlendWeight).
  // J1 audit 2026-04-25: Brier 0.6741 (FAIL). Actual J1 rates: 41.4%H/26.5%D/32.1%A.
  // Model over-predicts HOME wins — high-EV picks lose more than low-EV (0.328 vs 0.245).
  // Blend 0.30 improved Brier to 0.6659 but S4 (early-season 2026, Brier 0.7157) keeps
  // the average above 0.65. Blend 0.40 applies stronger correction to reduce the
  // systematic HOME over-confidence across all seasons.
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente, fenêtre récente): re-fit à 0.30 (ΔBrier test -0.0127, n train=918/test=148).
  J1: new Decimal("0.30"),
  // Backtest 2026-04-30: SUI1 Brier 0.6503 (FAIL, threshold 0.65). S2 drives it up
  // (0.6599). Poisson over-predicts HOME wins in the balanced Swiss league — blend
  // toward empirical team win-rates to reduce the directional bias.
  // SUI1 retiré 2026-08-19 (db:backtest:three-way-empirical-blend-calibration) : le meilleur poids trouvé par grid-search sur le train (ci-dessus) ne généralise pas au hors-échantillon (ΔBrier test négatif à tout poids testé, walk-forward saisonnier) — le réglage ci-dessus reposait sur un diagnostic ponctuel, jamais validé walk-forward. Retombe sur le défaut 0 (getLeagueThreeWayEmpiricalBlendWeight).
  // Backtest 2026-04-30: UEL Brier 0.659, CalibErr 0.057 (both FAIL). Poisson
  // over-predicts HOME probability (modeled ~43% vs actual ~30% win rate). HOME
  // blocked in PICK_EV_FLOOR_MAP — only DRAW survives (+89.8% ROI, 6b).
  // Diagnostic 2026-06-30 (1y, n=152): still FAIL (ECE 0.050). Bias flipped to
  // over-DRAW (+8pp: pred 25% vs real 17%) and under-HOME (39% vs 49% — strong
  // home teams in continental cups). Blend 0.20 → 0.35 to pull toward empirical.
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): re-fit à 0.20 (ΔBrier test -0.0069, n train=149/test=106).
  UEL: new Decimal("0.20"),
  // Backtest 2026-04-30: POL1 Brier 0.6710 (FAIL). Poisson over-predicts HOME in
  // the balanced Polish Ekstraklasa. Blend 0.20 améliore partiellement.
  // Diagnostic 2026-06-30 (1y, n=250): worst league (Brier 0.688, ECE 0.074),
  // over-AWAY +7pp (pred 33% vs real 26%), under-DRAW (25% vs 30%). 0.20 proven
  // insufficient → 0.40 (same magnitude as J1's HOME-overprediction fix).
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): re-fit à 0.45 (ΔBrier test -0.0150, n train=516/test=257).
  POL1: new Decimal("0.45"),
  // Diagnostic 2026-06-30 (1y, n=141): NOR1 fails ECE (0.053) and is the largest
  // model↔market gap (+0.104). Poisson badly under-models Norwegian home
  // advantage — pred 40% HOME vs real 56% (over-AWAY +11pp). Strong empirical
  // pull warranted. Starting 0.40; confirm Brier/ECE post-rebuild.
  // NOR1 retiré 2026-08-19 (db:backtest:three-way-empirical-blend-calibration) : le meilleur poids trouvé par grid-search sur le train (ci-dessus) ne généralise pas au hors-échantillon (ΔBrier test négatif à tout poids testé, walk-forward saisonnier) — le réglage ci-dessus reposait sur un diagnostic ponctuel, jamais validé walk-forward. Retombe sur le défaut 0 (getLeagueThreeWayEmpiricalBlendWeight).
  // Diagnostic 2026-06-30 (1y, n=90): UECL fails ECE (0.054). Same cup pattern as
  // UEL — under-HOME (pred 39% vs real 52%), over-DRAW (+7pp). Starting 0.35.
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): re-fit à 0.20 (ΔBrier test -0.0114, n train=155/test=92).
  UECL: new Decimal("0.20"),
  // Diagnostic 2026-06-30 (1y, n=71): CSL fails ECE (0.060). Mild over-AWAY (+6pp,
  // pred 36% vs real 30%). Light empirical pull — starting 0.25.
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): re-fit à 0.10 (ΔBrier test -0.0089, n train=600/test=34).
  CSL: new Decimal("0.10"),
  // Diagnostic 2026-06-30 (1y, n=300): MLS fails Brier (0.659) but ECE is fine
  // (0.036) → mostly a discrimination/parity problem (MLS is structurally
  // balanced), not a systematic bias. Mild over-AWAY (+5pp). Trial 0.25; expect
  // limited gain — if Brier stays > 0.65 post-rebuild, accept MLS as a hard league.
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): re-fit à 0.35 (ΔBrier test -0.0130, n train=910/test=53).
  MLS: new Decimal("0.35"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.40 (ΔBrier test -0.0073, n train=1049/test=254).
  ARG1: new Decimal("0.40"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.50 (ΔBrier test -0.0152, n train=1766/test=350).
  ARG2: new Decimal("0.50"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.25 (ΔBrier test -0.0063, n train=543/test=272).
  BEL1: new Decimal("0.25"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.10 (ΔBrier test -0.0013, n train=522/test=261).
  BL1: new Decimal("0.10"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.20 (ΔBrier test -0.0041, n train=597/test=109).
  CHI1: new Decimal("0.20"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.25 (ΔBrier test -0.0042, n train=660/test=330).
  D3: new Decimal("0.25"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.15 (ΔBrier test -0.0024, n train=992/test=496).
  EL1: new Decimal("0.15"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.10 (ΔBrier test -0.0019, n train=525/test=261).
  ERD: new Decimal("0.10"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.25 (ΔBrier test -0.0011, n train=405/test=200).
  GRE1: new Decimal("0.25"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente, fenêtre récente): blendWeight=0.25 (ΔBrier test -0.0067, n train=462/test=109).
  IRL1: new Decimal("0.25"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.20 (ΔBrier test -0.0104, n train=396/test=32).
  ISL1: new Decimal("0.20"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.25 (ΔBrier test -0.0040, n train=644/test=131).
  KOR2: new Decimal("0.25"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.30 (ΔBrier test -0.0061, n train=659/test=329).
  LL: new Decimal("0.30"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.30 (ΔBrier test -0.0104, n train=584/test=290).
  MX1: new Decimal("0.30"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.10 (ΔBrier test -0.0074, n train=607/test=53).
  NOR2: new Decimal("0.10"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.20 (ΔBrier test -0.0038, n train=989/test=330).
  PL: new Decimal("0.20"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.30 (ΔBrier test -0.0058, n train=400/test=200).
  RUS1: new Decimal("0.30"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.20 (ΔBrier test -0.0065, n train=660/test=329).
  SA: new Decimal("0.20"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.15 (ΔBrier test -0.0025, n train=396/test=198).
  SCO1: new Decimal("0.15"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.25 (ΔBrier test -0.0117, n train=508/test=249).
  SRB1: new Decimal("0.25"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.35 (ΔBrier test -0.0034, n train=310/test=153).
  SUI2: new Decimal("0.35"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.15 (ΔBrier test -0.0025, n train=309/test=133).
  SVN1: new Decimal("0.15"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente, fenêtre récente): blendWeight=0.25 (ΔBrier test -0.0089, n train=600/test=56).
  SWE2: new Decimal("0.25"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.20 (ΔBrier test -0.0051, n train=600/test=335).
  TUR2: new Decimal("0.20"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.30 (ΔBrier test -0.0119, n train=1026/test=170).
  USA2: new Decimal("0.30"),
  // Walk-forward 2026-08-19 (db:backtest:three-way-empirical-blend-calibration, train=toutes saisons sauf la + récente, test=la + récente): blendWeight=0.40 (ΔBrier test -0.0392, n train=64/test=65).
  WCQSA: new Decimal("0.40"),
};

export function getLeagueThreeWayEmpiricalBlendWeight(
  competitionCode: string | null | undefined,
): Decimal {
  if (
    competitionCode != null &&
    competitionCode in THREE_WAY_EMPIRICAL_BLEND_WEIGHT_MAP
  ) {
    return THREE_WAY_EMPIRICAL_BLEND_WEIGHT_MAP[competitionCode]!;
  }
  return new Decimal(0);
}
