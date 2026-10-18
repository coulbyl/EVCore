import { createHash } from "node:crypto";
import type { Logger } from "pino";
import {
  COMBO_COUPON_CLASS,
  eligibleComboLegs,
  STRATEGY_CHANNEL,
  type CalibrationCell,
  type ComboCandidate,
} from "@evcore/analysis-core";
import { requestVantageCompletion, type LlmClients } from "../groq/client";
import { OPERATOR_MIN_ODDS, operatorQuoteKey } from "./combo-calibration-query";
import { sanitizeReasonText } from "../vantage/sanitize-reason";
import type {
  CouponLlmProvenance,
  SelectedLeg,
} from "./generate-coupon-selection";
import type { ScoredCandidate } from "./score-candidates";
import { buildCouponSelectionSchema } from "./selection-schema";
import {
  buildComboSystemPrompt,
  buildComboUserPrompt,
  COMBO_LLM_LEGS,
} from "./combo-prompt";
import type { ComposedCoupon } from "./validate-coupon-selection";

/** Jamais dans un combiné : le canal LLM lui-même (un LLM qui lit un LLM) et
 * le score exact (0,73 de l'annoncé). Même liste que le combiné du moteur. */
const EXCLUDED_CHANNELS: ReadonlySet<string> = new Set([
  STRATEGY_CHANNEL.VANTAGE,
  STRATEGY_CHANNEL.CORRECT_SCORE,
]);

/** Au-delà, la liste n'apprend rien de plus au modèle et coûte des tokens. */
const MAX_LISTED = 30;
const DEFAULT_MAX_ATTEMPTS = 3;

export type ComposeLlmComboResult =
  | { outcome: "empty_pool"; eligibleCount: number }
  | { outcome: "no_coupon"; reasonDetails: string; eligibleCount: number }
  | {
      outcome: "gave_up";
      attempts: number;
      lastReason: string;
      eligibleCount: number;
    }
  | {
      outcome: "composed";
      coupon: ComposedCoupon;
      reasonDetails: string;
      eligibleCount: number;
    };

function candidateKey(c: {
  fixtureId: string;
  channel?: string;
  canal?: string;
  market: string;
  pick: string;
}): string {
  return `${c.fixtureId}|${c.channel ?? c.canal}|${c.market}|${c.pick}`;
}

/**
 * Le vivier du combiné : les sélections retenues par un canal (jamais une
 * issue seulement évaluée), avec une cote, hors canaux exclus — la même
 * matière que le combiné du moteur, pour que les deux soient comparables
 * jambe à jambe.
 */
export function eligibleLlmComboLegs(
  scoredPool: readonly ScoredCandidate[],
  calibration: readonly CalibrationCell[],
  /** Prix chez le book de l'utilisateur par choix ; une jambe sous son
   * minimum n'est jamais proposée (même garde que le moteur). */
  operatorQuotes: ReadonlyMap<string, number> = new Map(),
): ScoredCandidate[] {
  const byKey = new Map<string, ScoredCandidate>();
  const candidates: ComboCandidate[] = [];
  for (const c of scoredPool) {
    if (c.pickSource !== "STAKED" || c.channelSelectionId === null) continue;
    if (c.oddsSnapshot === null || EXCLUDED_CHANNELS.has(c.canal)) continue;
    const operator = operatorQuotes.get(
      operatorQuoteKey({
        fixtureId: c.fixtureId,
        market: c.market,
        pick: c.pick,
      }),
    );
    if (operator !== undefined && operator < OPERATOR_MIN_ODDS) continue;
    const candidate: ComboCandidate = {
      fixtureId: c.fixtureId,
      competition: c.competition,
      channel: c.canal,
      market: c.market,
      pick: c.pick,
      odds: c.oddsSnapshot,
      probability: c.probability,
    };
    byKey.set(candidateKey(candidate), c);
    candidates.push(candidate);
  }
  return eligibleComboLegs(candidates, calibration)
    .map((leg) => byKey.get(candidateKey(leg)))
    .filter((c): c is ScoredCandidate => c !== undefined);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Les trois règles que le modèle doit respecter, vérifiées ici quoi qu'il
 * dise : trois numéros valides et distincts, trois matchs, trois
 * championnats, cote combinée dans la bande de la classe. */
function validate(
  legs: readonly SelectedLeg[],
): { ok: true; combinedOdds: number } | { ok: false; reason: string } {
  if (legs.length !== COMBO_LLM_LEGS) {
    return {
      ok: false,
      reason: `${legs.length} jambes au lieu de ${COMBO_LLM_LEGS}`,
    };
  }
  const fixtures = new Set(legs.map((l) => l.candidate.fixtureId));
  if (fixtures.size !== legs.length) {
    return { ok: false, reason: "deux jambes sur le même match" };
  }
  const competitions = new Set(legs.map((l) => l.candidate.competition));
  if (competitions.size !== legs.length) {
    return { ok: false, reason: "deux jambes dans le même championnat" };
  }
  const combinedOdds = legs.reduce(
    (acc, l) => acc * (l.candidate.oddsSnapshot ?? 1),
    1,
  );
  if (
    combinedOdds < COMBO_COUPON_CLASS.targetOddsMin ||
    combinedOdds > COMBO_COUPON_CLASS.targetOddsMax
  ) {
    return {
      ok: false,
      reason: `cote combinée ${combinedOdds.toFixed(2)} hors de la bande ${COMBO_COUPON_CLASS.targetOddsMin}–${COMBO_COUPON_CLASS.targetOddsMax}`,
    };
  }
  return { ok: true, combinedOdds };
}

export async function composeLlmCombo(
  scoredPool: readonly ScoredCandidate[],
  calibration: readonly CalibrationCell[],
  clients: LlmClients,
  logger: Logger,
  opts: {
    maxAttempts?: number;
    operatorQuotes?: ReadonlyMap<string, number>;
    onCompletion?: (provenance: CouponLlmProvenance) => void;
  } = {},
): Promise<ComposeLlmComboResult> {
  const eligible = eligibleLlmComboLegs(
    scoredPool,
    calibration,
    opts.operatorQuotes,
  );
  const eligibleCount = eligible.length;
  if (eligibleCount < COMBO_LLM_LEGS) {
    logger.info(
      { eligibleCount },
      "coupon: fewer than three eligible legs, skipping the LLM call",
    );
    return { outcome: "empty_pool", eligibleCount };
  }
  const listed = eligible.slice(0, MAX_LISTED);
  const schema = buildCouponSelectionSchema({
    minLegs: COMBO_LLM_LEGS,
    maxLegs: COMBO_LLM_LEGS,
  });
  const systemPrompt = buildComboSystemPrompt();
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let feedback: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const userPrompt = buildComboUserPrompt(listed, feedback);
    const raw = await requestVantageCompletion(
      clients,
      systemPrompt,
      userPrompt,
      logger,
      (meta) =>
        opts.onCompletion?.({
          ...meta,
          systemPromptSha256: sha256(systemPrompt),
          userPromptSha256: sha256(userPrompt),
        }),
    );

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      feedback = "réponse précédente illisible (JSON invalide)";
      logger.warn(
        { attempt, raw },
        "coupon: combo response was not valid JSON",
      );
      continue;
    }
    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      feedback = `réponse précédente invalide (${parsed.error.issues.map((i) => i.message).join("; ")})`;
      logger.warn(
        { attempt, issues: parsed.error.issues },
        "coupon: combo response failed schema validation",
      );
      continue;
    }
    if (parsed.data.verdict === "no_coupon") {
      return {
        outcome: "no_coupon",
        reasonDetails: sanitizeReasonText(parsed.data.reasonDetails),
        eligibleCount,
      };
    }

    const legs: SelectedLeg[] = [];
    let indexError: string | null = null;
    const seen = new Set<number>();
    for (const leg of parsed.data.legs) {
      const candidate = listed[leg.index - 1];
      if (!candidate || seen.has(leg.index)) {
        indexError = `numéro ${leg.index} hors liste ou répété`;
        break;
      }
      seen.add(leg.index);
      legs.push({ candidate, reasoning: sanitizeReasonText(leg.reasoning) });
    }
    if (indexError) {
      feedback = indexError;
      logger.warn(
        { attempt, reason: indexError },
        "coupon: combo selection rejected",
      );
      continue;
    }

    const verdict = validate(legs);
    if (!verdict.ok) {
      feedback = verdict.reason;
      logger.warn(
        { attempt, reason: verdict.reason },
        "coupon: combo selection rejected",
      );
      continue;
    }

    // Probabilité jointe sous indépendance, sur ce que les canaux annoncent
    // (et non la courbe de Platt : les jambes sont déjà calibrées par
    // construction, et le combiné du moteur annonce la même chose).
    const jointProbability = legs.reduce(
      (acc, l) => acc * l.candidate.probability,
      1,
    );
    return {
      outcome: "composed",
      coupon: {
        legs,
        combinedOdds: verdict.combinedOdds,
        rawJointProbability: jointProbability,
        jointProbability,
        couponEV: jointProbability * verdict.combinedOdds - 1,
      },
      reasonDetails: sanitizeReasonText(parsed.data.reasonDetails),
      eligibleCount,
    };
  }

  logger.warn(
    { maxAttempts, lastReason: feedback },
    "coupon: gave up on the combo after max attempts",
  );
  return {
    outcome: "gave_up",
    attempts: maxAttempts,
    lastReason: feedback ?? "no attempt produced a usable response",
    eligibleCount,
  };
}
