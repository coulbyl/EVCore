import { getModelScoreThreshold } from '@modules/betting-engine/ev.constants';
import { extractEvaContextFromFeatures } from '@utils/model-run.utils';
import {
  channelLabel,
  fmtPct,
  fmtSigned,
  pickLabel,
  resultLabel,
} from '@utils/pick-labels.utils';
import type {
  AnalysisSheetFixture,
  AnalysisSheetPriorPass,
} from './analysis-sheet.repository';

export type SheetMeta = {
  generatedAt: string;
  range: { from: string; to: string };
  filters: { competitionCode: string | null; channel: string | null };
};

// One earlier rolling-horizon pass where this channel also had a SELECTED
// pick — oldest first. Lets Eva see line movement (probability/odds/pick
// drift across ADVANCE → PRE_KICKOFF → LIVE re-analyses of the same fixture)
// instead of only the latest snapshot.
export type AnalysisSheetPickHistoryEntry = {
  analyzedAt: string;
  phase: string;
  market: string;
  pick: string;
  probability: number;
  odds: number | null;
  ev: number;
};

export type AnalysisSheetJsonPick = {
  channel: string;
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  probability: number;
  odds: number | null;
  ev: number;
  qualityScore: number | null;
  rank: number;
  result: string | null;
  history: AnalysisSheetPickHistoryEntry[];
};

export type AnalysisSheetRejectionSummary = {
  channel: string;
  status: string;
  count: number;
  topReasonCode: string | null;
};

// One pick that tripped the AVOID gate — model edge (probability − 1/odds)
// reached AVOID_CONFIG.maxEdge, an implausible model↔market divergence.
export type AnalysisSheetAvoidOffender = {
  channel: string;
  market: string;
  pick: string;
  edge: number;
};

// Fixture-level AVOID flag. AVOID is a meta-channel that emits no pick of its
// own (SELECTED with empty selections), so it appears in neither selectedPicks
// nor rejectionSummary — without this field a triggered AVOID is invisible on
// the sheet while the coupon layer silently drops the fixture's picks from
// the staking pool.
export type AnalysisSheetAvoidFlag = {
  reasonCode: string | null;
  maxEdge: number | null;
  offenders: AnalysisSheetAvoidOffender[];
};

// Fixture-level calibration alert (model↔market coherence gate, stored in
// ModelRun.features.calibration_alert). Signals corrupted model inputs —
// the fixture's picks are dropped from the staking pool.
export type AnalysisSheetCalibrationAlert = {
  reasons: string[];
  modelFavorite: string;
  marketFavorite: string;
  modelProbability: number;
  medianImplied: number;
  divergence: number;
  bookmakerCount: number;
};

export type AnalysisSheetJsonFixture = {
  fixtureId: string;
  match: string;
  competition: string;
  kickoff: string;
  status: string;
  score: string | null;
  model: {
    deterministicScore: number;
    finalScore: number;
    scoreThreshold: number;
    predictionSource: string | null;
    lambda: { home: number; away: number; total: number } | null;
    shadowSignals: {
      lineMovement: number | null;
      h2h: number | null;
      congestion: number | null;
    } | null;
    // API-Football /predictions second opinion (shadow-only). `conflict` is
    // true when their Poisson comparison favors the opposite side vs our λ.
    shadowPredictions: {
      winnerName: string | null;
      percent: { home: number; draw: number; away: number };
      poisson: { home: number; away: number };
      conflict: boolean;
    } | null;
  };
  avoidFlag: AnalysisSheetAvoidFlag | null;
  calibrationAlert: AnalysisSheetCalibrationAlert | null;
  selectedPicks: AnalysisSheetJsonPick[];
  rejectionSummary: AnalysisSheetRejectionSummary[];
};

export type AnalysisSheetJson = {
  generatedAt: string;
  range: { from: string; to: string };
  filters: { competitionCode: string | null; channel: string | null };
  summary: {
    fixtureCount: number;
    avoidedFixtureCount: number;
    calibrationAlertCount: number;
    byCompetition: Record<string, number>;
    byChannel: Record<string, number>;
    settledRecord: { won: number; lost: number; pending: number; void: number };
  };
  fixtures: AnalysisSheetJsonFixture[];
};

function toJsonFixture(
  fixture: AnalysisSheetFixture,
): AnalysisSheetJsonFixture {
  const context = extractEvaContextFromFeatures(fixture.features);
  const scoreThreshold = getModelScoreThreshold(
    fixture.competitionCode,
  ).toNumber();
  const hasShadowSignals =
    context.shadowLineMovement !== null ||
    context.shadowH2h !== null ||
    context.shadowCongestion !== null;

  const selectedPicks: AnalysisSheetJsonPick[] = fixture.selections
    .filter((s) => s.decisionStatus === 'SELECTED' && s.market && s.pick)
    .map((s) => ({
      channel: s.channel,
      market: s.market!,
      pick: s.pick!,
      comboMarket: s.comboMarket,
      comboPick: s.comboPick,
      probability: s.probability ?? 0,
      odds: s.odds,
      ev: s.ev ?? 0,
      qualityScore: s.qualityScore,
      rank: s.rank ?? 1,
      result: s.result,
      history: buildPickHistory(fixture.priorPasses, s.channel),
    }));

  const rejectionSummary = buildRejectionSummary(fixture.selections);
  const avoidFlag = buildAvoidFlag(fixture.selections);
  const calibrationAlert = buildCalibrationAlert(fixture.features);

  return {
    fixtureId: fixture.fixtureId,
    match: `${fixture.homeTeam} - ${fixture.awayTeam}`,
    competition: fixture.competitionCode,
    kickoff: fixture.scheduledAt.toISOString(),
    status: fixture.status,
    score:
      fixture.homeScore !== null && fixture.awayScore !== null
        ? `${fixture.homeScore}-${fixture.awayScore}`
        : null,
    model: {
      deterministicScore: fixture.deterministicScore,
      finalScore: fixture.finalScore,
      scoreThreshold,
      predictionSource: context.predictionSource,
      lambda:
        context.lambdaHome !== null && context.lambdaAway !== null
          ? {
              home: context.lambdaHome,
              away: context.lambdaAway,
              total: context.lambdaHome + context.lambdaAway,
            }
          : null,
      shadowSignals: hasShadowSignals
        ? {
            lineMovement: context.shadowLineMovement,
            h2h: context.shadowH2h,
            congestion: context.shadowCongestion,
          }
        : null,
      shadowPredictions: buildShadowPredictions(fixture.features),
    },
    avoidFlag,
    calibrationAlert,
    selectedPicks,
    rejectionSummary,
  };
}

// Parses ModelRun.features.shadow_predictions (API-Football second opinion,
// shadow-only). Defensive: malformed payloads yield null.
function buildShadowPredictions(
  features: unknown,
): AnalysisSheetJsonFixture['model']['shadowPredictions'] {
  if (!features || typeof features !== 'object') return null;
  const raw = (features as Record<string, unknown>)['shadow_predictions'];
  if (!raw || typeof raw !== 'object') return null;

  const p = raw as {
    winnerName?: unknown;
    percent?: unknown;
    poisson?: unknown;
    conflict?: unknown;
  };
  const percent = asTriple(p.percent, ['home', 'draw', 'away']);
  const poisson = asTriple(p.poisson, ['home', 'away']);
  if (percent === null || poisson === null || typeof p.conflict !== 'boolean') {
    return null;
  }

  return {
    winnerName: typeof p.winnerName === 'string' ? p.winnerName : null,
    percent: percent as { home: number; draw: number; away: number },
    poisson: poisson as { home: number; away: number },
    conflict: p.conflict,
  };
}

function asTriple(
  value: unknown,
  keys: string[],
): Record<string, number> | null {
  if (!value || typeof value !== 'object') return null;
  const out: Record<string, number> = {};
  for (const key of keys) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    out[key] = v;
  }
  return out;
}

// Parses ModelRun.features.calibration_alert (written by the betting engine's
// market-coherence gate). Defensive: malformed payloads yield null.
function buildCalibrationAlert(
  features: unknown,
): AnalysisSheetCalibrationAlert | null {
  if (!features || typeof features !== 'object') return null;
  const raw = (features as Record<string, unknown>)['calibration_alert'];
  if (!raw || typeof raw !== 'object') return null;

  const alert = raw as Record<string, unknown>;
  if (
    !Array.isArray(alert.reasons) ||
    typeof alert.modelFavorite !== 'string' ||
    typeof alert.marketFavorite !== 'string' ||
    typeof alert.modelProbability !== 'number' ||
    typeof alert.medianImplied !== 'number' ||
    typeof alert.divergence !== 'number' ||
    typeof alert.bookmakerCount !== 'number'
  ) {
    return null;
  }

  return {
    reasons: alert.reasons.filter((r): r is string => typeof r === 'string'),
    modelFavorite: alert.modelFavorite,
    marketFavorite: alert.marketFavorite,
    modelProbability: alert.modelProbability,
    medianImplied: alert.medianImplied,
    divergence: alert.divergence,
    bookmakerCount: alert.bookmakerCount,
  };
}

// AVOID SELECTED = the fixture is flagged (the "selection" is the avoidance
// itself, with the offending picks in reasonDetails). It carries no
// market/pick, so it must be surfaced here explicitly.
function buildAvoidFlag(
  selections: AnalysisSheetFixture['selections'],
): AnalysisSheetAvoidFlag | null {
  const avoid = selections.find(
    (s) => s.channel === 'AVOID' && s.decisionStatus === 'SELECTED',
  );
  if (!avoid) return null;

  const details =
    avoid.reasonDetails && typeof avoid.reasonDetails === 'object'
      ? (avoid.reasonDetails as {
          maxEdge?: unknown;
          offenders?: unknown;
        })
      : {};

  const offenders: AnalysisSheetAvoidOffender[] = Array.isArray(
    details.offenders,
  )
    ? details.offenders.flatMap((o: unknown) => {
        if (!o || typeof o !== 'object') return [];
        const raw = o as Record<string, unknown>;
        if (
          typeof raw.channel !== 'string' ||
          typeof raw.market !== 'string' ||
          typeof raw.pick !== 'string' ||
          typeof raw.edge !== 'number'
        ) {
          return [];
        }
        return [
          {
            channel: raw.channel,
            market: raw.market,
            pick: raw.pick,
            edge: raw.edge,
          },
        ];
      })
    : [];

  return {
    reasonCode: avoid.reasonCode,
    maxEdge: typeof details.maxEdge === 'number' ? details.maxEdge : null,
    offenders,
  };
}

// Earlier rolling-horizon passes (oldest first) where this exact channel
// also had a SELECTED pick — this is the line-movement trail.
function buildPickHistory(
  priorPasses: AnalysisSheetPriorPass[],
  channel: string,
): AnalysisSheetPickHistoryEntry[] {
  return priorPasses.flatMap((pass) => {
    const pick = pass.selectedPicks.find((s) => s.channel === channel);
    if (!pick || !pick.market || !pick.pick) return [];
    return [
      {
        analyzedAt: pass.analyzedAt.toISOString(),
        phase: pass.phase,
        market: pick.market,
        pick: pick.pick,
        probability: pick.probability ?? 0,
        odds: pick.odds,
        ev: pick.ev ?? 0,
      },
    ];
  });
}

function buildRejectionSummary(
  selections: AnalysisSheetFixture['selections'],
): AnalysisSheetRejectionSummary[] {
  const groups = new Map<
    string,
    {
      channel: string;
      status: string;
      count: number;
      reasons: Map<string, number>;
    }
  >();

  for (const s of selections) {
    if (s.decisionStatus === 'SELECTED') continue;
    const key = `${s.channel}:${s.decisionStatus}`;
    const group = groups.get(key) ?? {
      channel: s.channel,
      status: s.decisionStatus,
      count: 0,
      reasons: new Map<string, number>(),
    };
    group.count += 1;
    if (s.reasonCode) {
      group.reasons.set(
        s.reasonCode,
        (group.reasons.get(s.reasonCode) ?? 0) + 1,
      );
    }
    groups.set(key, group);
  }

  return [...groups.values()].map((g) => {
    const topReason = [...g.reasons.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      channel: g.channel,
      status: g.status,
      count: g.count,
      topReasonCode: topReason ? topReason[0] : null,
    };
  });
}

export function buildJsonSheet(
  fixtures: AnalysisSheetFixture[],
  meta: SheetMeta,
): AnalysisSheetJson {
  const jsonFixtures = fixtures.map(toJsonFixture);

  const byCompetition: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const settledRecord = { won: 0, lost: 0, pending: 0, void: 0 };

  for (const f of jsonFixtures) {
    byCompetition[f.competition] = (byCompetition[f.competition] ?? 0) + 1;
    for (const pick of f.selectedPicks) {
      byChannel[pick.channel] = (byChannel[pick.channel] ?? 0) + 1;
      if (pick.result === 'WON') settledRecord.won += 1;
      else if (pick.result === 'LOST') settledRecord.lost += 1;
      else if (pick.result === 'VOID') settledRecord.void += 1;
      else settledRecord.pending += 1;
    }
  }

  return {
    generatedAt: meta.generatedAt,
    range: meta.range,
    filters: meta.filters,
    summary: {
      fixtureCount: jsonFixtures.length,
      avoidedFixtureCount: jsonFixtures.filter((f) => f.avoidFlag !== null)
        .length,
      calibrationAlertCount: jsonFixtures.filter(
        (f) => f.calibrationAlert !== null,
      ).length,
      byCompetition,
      byChannel,
      settledRecord,
    },
    fixtures: jsonFixtures,
  };
}

export function buildTxtSheet(
  fixtures: AnalysisSheetFixture[],
  meta: SheetMeta,
): string {
  const sheet = buildJsonSheet(fixtures, meta);
  const lines: string[] = [];
  const w = (s = '') => lines.push(s);

  w(`FICHE D'ANALYSE EVCORE — ${sheet.range.from} -> ${sheet.range.to}`);
  w(
    `Filtres : competition=${sheet.filters.competitionCode ?? '(toutes)'}, canal=${
      sheet.filters.channel ?? '(tous)'
    }`,
  );
  w(`Genere le ${sheet.generatedAt} — ${sheet.summary.fixtureCount} fixtures`);
  w(
    "Note : chaque fixture peut être analysée plusieurs fois avant le coup d'envoi (rolling horizon). \"Historique [canal]\" sous un pick liste prob/cote à chaque analyse antérieure, dans l'ordre chronologique, jusqu'à la valeur actuelle — utile pour repérer un mouvement de ligne.",
  );
  w();

  w('=== Résumé ===');
  const byCompetition = Object.entries(sheet.summary.byCompetition)
    .map(([code, count]) => `${code} ${count}`)
    .join(', ');
  w(`Par compétition : ${byCompetition || '—'}`);
  const byChannel = Object.entries(sheet.summary.byChannel)
    .map(([channel, count]) => `${channelLabel(channel)} ${count}`)
    .join(', ');
  w(`Par canal (picks retenus) : ${byChannel || '—'}`);
  const { won, lost, pending, void: voided } = sheet.summary.settledRecord;
  w(
    `Réglé : ${won} gagnés / ${lost} perdus / ${pending} en attente / ${voided} annulés`,
  );
  if (sheet.summary.avoidedFixtureCount > 0) {
    w(
      `Fixtures flaguées AVOID : ${sheet.summary.avoidedFixtureCount} (divergence modèle/marché implausible — picks exclus du staking)`,
    );
  }
  if (sheet.summary.calibrationAlertCount > 0) {
    w(
      `Alertes calibration : ${sheet.summary.calibrationAlertCount} (données modèle suspectes vs marché — picks exclus du staking)`,
    );
  }
  w();

  w('=== Fixtures ===');
  if (sheet.fixtures.length === 0) {
    w('Aucune fixture sur cette période.');
  }

  for (const f of sheet.fixtures) {
    const kickoff = f.kickoff.slice(0, 16).replace('T', ' ');
    const scoreStr = f.score ? `${f.status} ${f.score}` : 'À jouer';
    w();
    w(`[${kickoff}] ${f.match} (${f.competition}) — ${scoreStr}`);

    const { model } = f;
    const lambdaStr = model.lambda
      ? `  λ: ${model.lambda.home.toFixed(2)}/${model.lambda.away.toFixed(2)} (${model.lambda.total.toFixed(2)})`
      : '';
    const sourceStr = model.predictionSource
      ? `  Source: ${model.predictionSource}`
      : '';
    w(
      `  Score modèle : ${model.finalScore.toFixed(3)} (seuil ${f.competition} ${model.scoreThreshold.toFixed(2)})${sourceStr}${lambdaStr}`,
    );
    if (model.shadowSignals) {
      const parts: string[] = [];
      if (model.shadowSignals.lineMovement !== null)
        parts.push(`line=${fmtSigned(model.shadowSignals.lineMovement, 4)}`);
      if (model.shadowSignals.h2h !== null)
        parts.push(`h2h=${fmtSigned(model.shadowSignals.h2h, 4)}`);
      if (model.shadowSignals.congestion !== null)
        parts.push(`cong=${fmtSigned(model.shadowSignals.congestion, 4)}`);
      if (parts.length > 0) w(`  Shadow : ${parts.join('  ')}`);
    }

    if (f.avoidFlag) {
      const cap =
        f.avoidFlag.maxEdge !== null
          ? ` (edge ≥ ${f.avoidFlag.maxEdge.toFixed(2)})`
          : '';
      w(
        `  ⚠ AVOID${f.avoidFlag.reasonCode ? ` [${f.avoidFlag.reasonCode}]` : ''} — divergence modèle/marché implausible${cap} ; picks exclus du staking`,
      );
      for (const o of f.avoidFlag.offenders) {
        const label = pickLabel({
          market: o.market,
          pick: o.pick,
          comboMarket: null,
          comboPick: null,
        });
        w(
          `    Offender [${channelLabel(o.channel)}]  ${label}  edge ${fmtSigned(o.edge, 3)}`,
        );
      }
    }

    if (model.shadowPredictions) {
      const sp = model.shadowPredictions;
      const conflictStr = sp.conflict ? '  ⚠ CONFLIT de direction avec λ' : '';
      w(
        `  2e avis (API-Football) : ${sp.winnerName ?? '—'}  1X2 ${sp.percent.home}/${sp.percent.draw}/${sp.percent.away}%  poisson ${sp.poisson.home}/${sp.poisson.away}${conflictStr}`,
      );
    }

    if (f.calibrationAlert) {
      const a = f.calibrationAlert;
      w(
        `  ⚠ Calibration [${a.reasons.join(', ')}] — favori modèle ${a.modelFavorite} (${fmtPct(a.modelProbability)}) vs marché ${a.marketFavorite} (implied ${fmtPct(a.medianImplied)}, ${a.bookmakerCount} books) ; données suspectes, picks exclus du staking`,
      );
    }

    if (f.selectedPicks.length === 0) {
      w('  Aucun pick retenu.');
    }
    for (const pick of f.selectedPicks) {
      const label = pickLabel({
        market: pick.market,
        pick: pick.pick,
        comboMarket: pick.comboMarket,
        comboPick: pick.comboPick,
      });
      const odds = pick.odds !== null ? pick.odds.toFixed(2) : '—';
      const qs =
        pick.qualityScore !== null ? pick.qualityScore.toFixed(4) : '—';
      w(
        `  Pick [${channelLabel(pick.channel)}]  ${label.padEnd(26)}  Prob: ${fmtPct(pick.probability)}  Cote: ${odds}  EV: ${fmtSigned(pick.ev, 3)}  Qualité: ${qs}  ${resultLabel(pick.result)}`,
      );
      if (pick.history.length > 0) {
        const trail = [...pick.history, pick]
          .map(
            (entry) =>
              `${fmtPct(entry.probability)}/${entry.odds !== null ? entry.odds.toFixed(2) : '—'}`,
          )
          .join(' → ');
        w(
          `    Historique [${channelLabel(pick.channel)}] (${pick.history.length + 1} analyses) : ${trail}`,
        );
      }
    }

    if (f.rejectionSummary.length > 0) {
      const rejectStr = f.rejectionSummary
        .map((r) => {
          const reason = r.topReasonCode
            ? ` (${r.topReasonCode}${r.count > 1 ? ` x${r.count}` : ''})`
            : '';
          return `${channelLabel(r.channel)} ${r.count}${reason}`;
        })
        .join(', ');
      w(`  Rejets : ${rejectStr}`);
    }
  }

  return lines.join('\n');
}
