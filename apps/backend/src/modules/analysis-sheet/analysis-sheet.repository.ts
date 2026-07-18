import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { round, toDecimal, type DecimalLike } from '@utils/decimal.utils';

export type AnalysisSheetSelection = {
  channel: string;
  decisionStatus: string;
  reasonCode: string | null;
  // ChannelDecision.reasonDetails (Json) — carries the AVOID offenders payload.
  reasonDetails: unknown;
  market: string | null;
  pick: string | null;
  probability: number | null;
  odds: number | null;
  ev: number | null;
  qualityScore: number | null;
  rank: number | null;
  result: string | null;
};

// One earlier analysis pass for a fixture (ModelRun.phase ADVANCE/PRE_KICKOFF
// ahead of the current/latest one) — only its SELECTED picks are kept, so
// Eva can see how a channel's pick/probability/odds moved between passes
// (line movement) without the full per-pass rejection noise.
export type AnalysisSheetPriorPass = {
  modelRunId: string;
  analyzedAt: Date;
  phase: string;
  selectedPicks: AnalysisSheetSelection[];
};

export type AnalysisSheetFixture = {
  fixtureId: string;
  scheduledAt: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: string;
  awayTeam: string;
  competitionCode: string;
  competitionName: string;
  modelRunId: string;
  analyzedAt: Date;
  deterministicScore: number;
  finalScore: number;
  features: unknown;
  selections: AnalysisSheetSelection[];
  priorPasses: AnalysisSheetPriorPass[];
};

// Raw row shape as it comes back from Postgres — numeric columns folded into
// `selections` via json_build_object may come back as JSON numbers or
// strings depending on precision; toDecimal()/round() below handle both.
type RawSelection = {
  channel: string;
  decisionStatus: string;
  reasonCode: string | null;
  reasonDetails: unknown;
  market: string | null;
  pick: string | null;
  probability: DecimalLike | null;
  odds: DecimalLike | null;
  ev: DecimalLike | null;
  qualityScore: DecimalLike | null;
  rank: number | null;
  result: string | null;
};

// One row per (fixture, analysis pass) — a fixture with 3 ModelRuns
// (ADVANCE/PRE_KICKOFF/LIVE) yields 3 rows here, collapsed into one
// AnalysisSheetFixture (latest pass) + priorPasses (earlier ones) in mapRows.
type AnalysisSheetRow = {
  fixture_id: string;
  scheduled_at: Date;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: string;
  away_team: string;
  competition_code: string;
  competition_name: string;
  model_run_id: string;
  analyzed_at: Date;
  phase: string;
  deterministic_score: DecimalLike;
  final_score: DecimalLike;
  features: unknown;
  selections: RawSelection[];
};

@Injectable()
export class AnalysisSheetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getFixturesInRange(input: {
    range: { from: Date; to: Date };
    competitionCode?: string;
    channel?: string;
  }): Promise<AnalysisSheetFixture[]> {
    const { range, competitionCode = null, channel = null } = input;

    // `latest_run`: one model_run per fixture (the most recently analyzed —
    // a fixture can have ADVANCE/PRE_KICKOFF/LIVE rolling-horizon passes).
    // DISTINCT ON avoids a correlated subquery. Used only to decide which
    // FIXTURES are eligible (date range + filters apply to the fixture's
    // current/latest state) — `eligible_fixtures` below.
    //
    // The main query then joins ALL model_run passes (not just the latest)
    // for each eligible fixture, so the mapping step can build a compact
    // line-movement history per channel (see mapRows/buildPriorPasses).
    //
    // Channel filter restricts WHICH FIXTURES are included (via EXISTS on
    // the latest pass), never which selection rows get joined — the LEFT
    // JOIN stays unconditional so every channel's picks remain visible on an
    // included fixture. Losing that would defeat the whole point of the
    // sheet: spotting coherence/incoherence ACROSS channels on one fixture.
    const rows = await this.prisma.client.$queryRaw<AnalysisSheetRow[]>`
      WITH latest_run AS (
        SELECT DISTINCT ON (mr."fixtureId") mr.*
        FROM model_run mr
        ORDER BY mr."fixtureId", mr."analyzedAt" DESC
      ),
      eligible_fixtures AS (
        SELECT lr."fixtureId" AS fixture_id
        FROM latest_run lr
        JOIN fixture f     ON f.id = lr."fixtureId"
        JOIN season s      ON s.id = f."seasonId"
        JOIN competition c ON c.id = s."competitionId"
        WHERE f."scheduledAt" >= ${range.from}
          AND f."scheduledAt" <= ${range.to}
          AND (${competitionCode}::text IS NULL OR c.code = ${competitionCode})
          AND (
            ${channel}::text IS NULL OR EXISTS (
              SELECT 1 FROM channel_decision cd2
              WHERE cd2."modelRunId" = lr.id
                AND cd2.channel::text = ${channel}
                AND cd2.status = 'SELECTED'
            )
          )
      )
      SELECT
        f.id                              AS fixture_id,
        f."scheduledAt"                   AS scheduled_at,
        f.status                          AS status,
        f."homeScore"                     AS home_score,
        f."awayScore"                     AS away_score,
        ht.name                           AS home_team,
        at.name                           AS away_team,
        c.code                            AS competition_code,
        c.name                            AS competition_name,
        mr.id                             AS model_run_id,
        mr."analyzedAt"                  AS analyzed_at,
        mr.phase                          AS phase,
        mr."deterministicScore"          AS deterministic_score,
        mr."finalScore"                  AS final_score,
        mr.features                      AS features,
        COALESCE(
          json_agg(
            json_build_object(
              'channel',        cd.channel,
              'decisionStatus', cd.status,
              'reasonCode',     cd."reasonCode",
              'reasonDetails',  cd."reasonDetails",
              'market',         cs.market,
              'pick',           cs.pick,
              'probability',    cs.probability,
              'odds',           cs.odds,
              'ev',             cs.ev,
              'qualityScore',   cs."qualityScore",
              'rank',           cs.rank,
              'result',         cs.result
            )
            ORDER BY cs."qualityScore" DESC NULLS LAST, cs.ev DESC NULLS LAST
          ) FILTER (WHERE cd.id IS NOT NULL),
          '[]'
        )                                 AS selections
      FROM eligible_fixtures ef
      JOIN fixture f                 ON f.id = ef.fixture_id
      JOIN team ht                   ON ht.id = f."homeTeamId"
      JOIN team at                   ON at.id = f."awayTeamId"
      JOIN season s                  ON s.id = f."seasonId"
      JOIN competition c             ON c.id = s."competitionId"
      JOIN model_run mr              ON mr."fixtureId" = f.id
      LEFT JOIN channel_decision cd  ON cd."modelRunId" = mr.id
      LEFT JOIN channel_selection cs ON cs."channelDecisionId" = cd.id
      GROUP BY f.id, f."scheduledAt", f.status, f."homeScore", f."awayScore",
               ht.name, at.name, c.code, c.name,
               mr.id, mr."analyzedAt", mr.phase, mr."deterministicScore", mr."finalScore", mr.features
      ORDER BY f."scheduledAt" ASC, mr."analyzedAt" ASC
    `;

    return groupRowsByFixture(rows);
  }
}

// Collapses N (fixture, pass) rows into one AnalysisSheetFixture per fixture:
// the LAST pass (rows are ordered by analyzedAt ASC per fixture) is the
// current state; earlier passes become compact priorPasses entries.
function groupRowsByFixture(rows: AnalysisSheetRow[]): AnalysisSheetFixture[] {
  const byFixture = new Map<string, AnalysisSheetRow[]>();
  for (const row of rows) {
    const passes = byFixture.get(row.fixture_id) ?? [];
    passes.push(row);
    byFixture.set(row.fixture_id, passes);
  }

  return [...byFixture.values()].map((passes) => {
    const latest = passes[passes.length - 1];
    const priorPasses: AnalysisSheetPriorPass[] = passes
      .slice(0, -1)
      .map((pass) => ({
        modelRunId: pass.model_run_id,
        analyzedAt: pass.analyzed_at,
        phase: pass.phase,
        selectedPicks: pass.selections
          .filter((s) => s.decisionStatus === 'SELECTED')
          .map(mapSelection),
      }));

    return {
      fixtureId: latest.fixture_id,
      scheduledAt: latest.scheduled_at,
      status: latest.status,
      homeScore: latest.home_score,
      awayScore: latest.away_score,
      homeTeam: latest.home_team,
      awayTeam: latest.away_team,
      competitionCode: latest.competition_code,
      competitionName: latest.competition_name,
      modelRunId: latest.model_run_id,
      analyzedAt: latest.analyzed_at,
      deterministicScore: round(latest.deterministic_score),
      finalScore: round(latest.final_score),
      features: latest.features,
      selections: latest.selections.map(mapSelection),
      priorPasses,
    };
  });
}

function mapSelection(selection: RawSelection): AnalysisSheetSelection {
  return {
    channel: selection.channel,
    decisionStatus: selection.decisionStatus,
    reasonCode: selection.reasonCode,
    reasonDetails: selection.reasonDetails ?? null,
    market: selection.market,
    pick: selection.pick,
    probability:
      selection.probability != null ? round(selection.probability) : null,
    odds: selection.odds != null ? round(selection.odds) : null,
    ev: selection.ev != null ? round(selection.ev) : null,
    qualityScore:
      selection.qualityScore != null ? round(selection.qualityScore) : null,
    rank: selection.rank,
    result: selection.result,
  };
}

// Re-export for callers that need to build a Decimal directly (e.g. tests).
export { toDecimal };
