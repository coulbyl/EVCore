// I/O Prisma du schéma v2 — aucune logique de calcul ici.
//
// Garantie anti-fuite : toutes les requêtes de contexte sont bornées sur des
// matchs ANTÉRIEURS au coup d'envoi. La borne est posée ici, dans le SQL, et
// non dans le code appelant, pour qu'elle soit vérifiable d'un seul coup d'œil
// et impossible à contourner par erreur en aval.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { round, type DecimalLike } from '@utils/decimal.utils';
import type { BookmakerQuote } from './market/market-block.builder';
import type { H2HFixtureRow } from './context/h2h-context.builder';
import type { StandingFixture } from './context/standing.builder';

/** Un match terminé, non orienté — l'orientation par équipe se fait en mémoire. */
export type FinishedFixtureRow = {
  fixtureId: string;
  scheduledAt: Date;
  competitionCode: string;
  competitionName: string;
  seasonId: string;
  seasonName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
  homeXg: number | null;
  awayXg: number | null;
};

/** Un match proche (passé ou à venir) servant à la densité de calendrier. */
export type NearbyFixtureRow = {
  fixtureId: string;
  scheduledAt: Date;
  competitionCode: string;
  homeTeamId: string;
  awayTeamId: string;
};

/** Agrégat de calibration, une ligne par (marché × compétition). */
export type CalibrationRow = {
  market: string;
  competitionCode: string;
  competitionName: string;
  n: number;
  wins: number;
  losses: number;
  sumProbability: number;
  sumBrier: number;
  sumReturn: number;
};

export type LambdaBiasRow = {
  competitionCode: string;
  competitionName: string;
  n: number;
  avgPredictedGoals: number | null;
  avgActualGoals: number | null;
};

export type CalibrationExclusions = {
  observationOnly: number;
  voided: number;
  withoutOdds: number;
};

/** Nombre de matchs d'historique chargés par équipe — borne la volumétrie. */
const TEAM_HISTORY_LIMIT = 120;
/** Profondeur d'historique pour le H2H exposé (10 confrontations demandées). */
const H2H_ROW_LIMIT = 10;

function toNumber(value: DecimalLike | null): number | null {
  return value === null ? null : round(value);
}

@Injectable()
export class AnalysisSheetV2Repository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Historique récent des équipes demandées, borné à `before`.
   *
   * Un LATERAL par équipe avec LIMIT évite qu'une plage large ne tire tout
   * l'historique de la base : chaque équipe rend au plus TEAM_HISTORY_LIMIT
   * matchs, ce qui couvre largement « 10 derniers » et « deux saisons ».
   */
  async getFinishedFixturesForTeams(input: {
    teamIds: readonly string[];
    before: Date;
  }): Promise<FinishedFixtureRow[]> {
    if (input.teamIds.length === 0) return [];

    const rows = await this.prisma.client.$queryRaw<
      {
        fixture_id: string;
        scheduled_at: Date;
        competition_code: string;
        competition_name: string;
        season_id: string;
        season_name: string;
        home_team_id: string;
        away_team_id: string;
        home_score: number;
        away_score: number;
        home_ht_score: number | null;
        away_ht_score: number | null;
        home_xg: DecimalLike | null;
        away_xg: DecimalLike | null;
      }[]
    >`
      SELECT DISTINCT
        f.id              AS fixture_id,
        f."scheduledAt"   AS scheduled_at,
        c.code            AS competition_code,
        c.name            AS competition_name,
        s.id              AS season_id,
        s.name            AS season_name,
        f."homeTeamId"    AS home_team_id,
        f."awayTeamId"    AS away_team_id,
        f."homeScore"     AS home_score,
        f."awayScore"     AS away_score,
        f."homeHtScore"   AS home_ht_score,
        f."awayHtScore"   AS away_ht_score,
        f."homeXg"        AS home_xg,
        f."awayXg"        AS away_xg
      FROM (SELECT unnest(ARRAY[${Prisma.join([...input.teamIds])}]::uuid[]) AS team_id) t
      CROSS JOIN LATERAL (
        SELECT fx.*
        FROM fixture fx
        WHERE (fx."homeTeamId" = t.team_id OR fx."awayTeamId" = t.team_id)
          AND fx.status = 'FINISHED'
          AND fx."homeScore" IS NOT NULL
          AND fx."awayScore" IS NOT NULL
          AND fx."scheduledAt" < ${input.before}
        ORDER BY fx."scheduledAt" DESC
        LIMIT ${TEAM_HISTORY_LIMIT}
      ) f
      JOIN season s      ON s.id = f."seasonId"
      JOIN competition c ON c.id = s."competitionId"
    `;

    return rows.map((row) => ({
      fixtureId: row.fixture_id,
      scheduledAt: row.scheduled_at,
      competitionCode: row.competition_code,
      competitionName: row.competition_name,
      seasonId: row.season_id,
      seasonName: row.season_name,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      homeScore: row.home_score,
      awayScore: row.away_score,
      homeHtScore: row.home_ht_score,
      awayHtScore: row.away_ht_score,
      homeXg: toNumber(row.home_xg),
      awayXg: toNumber(row.away_xg),
    }));
  }

  /**
   * Matchs des équipes dans une fenêtre temporelle, tous statuts confondus —
   * sert la densité de calendrier (`context.schedule`), qui doit voir aussi
   * bien les matchs joués juste avant que ceux programmés juste après.
   */
  async getNearbyFixturesForTeams(input: {
    teamIds: readonly string[];
    from: Date;
    to: Date;
  }): Promise<NearbyFixtureRow[]> {
    if (input.teamIds.length === 0) return [];

    const rows = await this.prisma.client.$queryRaw<
      {
        fixture_id: string;
        scheduled_at: Date;
        competition_code: string;
        home_team_id: string;
        away_team_id: string;
      }[]
    >`
      SELECT
        f.id            AS fixture_id,
        f."scheduledAt" AS scheduled_at,
        c.code          AS competition_code,
        f."homeTeamId"  AS home_team_id,
        f."awayTeamId"  AS away_team_id
      FROM fixture f
      JOIN season s      ON s.id = f."seasonId"
      JOIN competition c ON c.id = s."competitionId"
      WHERE f."scheduledAt" >= ${input.from}
        AND f."scheduledAt" <= ${input.to}
        AND (
          f."homeTeamId" = ANY(ARRAY[${Prisma.join([...input.teamIds])}]::uuid[])
          OR f."awayTeamId" = ANY(ARRAY[${Prisma.join([...input.teamIds])}]::uuid[])
        )
    `;

    return rows.map((row) => ({
      fixtureId: row.fixture_id,
      scheduledAt: row.scheduled_at,
      competitionCode: row.competition_code,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
    }));
  }

  /**
   * Jusqu'à 10 confrontations directes par paire, antérieures au coup d'envoi
   * de la rencontre concernée.
   *
   * La borne temporelle est portée par la paire elle-même (`before`), pas par
   * une date globale : deux matchs du même export peuvent avoir des coups
   * d'envoi différents et ne doivent pas partager la même fenêtre.
   */
  async getH2HRows(
    pairs: readonly { homeTeamId: string; awayTeamId: string; before: Date }[],
  ): Promise<Map<string, H2HFixtureRow[]>> {
    const result = new Map<string, H2HFixtureRow[]>();
    if (pairs.length === 0) return result;

    const values = pairs.map(
      (p) =>
        Prisma.sql`(${p.homeTeamId}::uuid, ${p.awayTeamId}::uuid, ${p.before}::timestamptz)`,
    );

    const rows = await this.prisma.client.$queryRaw<
      {
        pair_home: string;
        pair_away: string;
        fixture_id: string;
        scheduled_at: Date;
        competition_code: string;
        competition_name: string;
        home_team_id: string;
        away_team_id: string;
        home_score: number;
        away_score: number;
        home_ht_score: number | null;
        away_ht_score: number | null;
      }[]
    >`
      SELECT
        p.home_team_id  AS pair_home,
        p.away_team_id  AS pair_away,
        f.id            AS fixture_id,
        f."scheduledAt" AS scheduled_at,
        c.code          AS competition_code,
        c.name          AS competition_name,
        f."homeTeamId"  AS home_team_id,
        f."awayTeamId"  AS away_team_id,
        f."homeScore"   AS home_score,
        f."awayScore"   AS away_score,
        f."homeHtScore" AS home_ht_score,
        f."awayHtScore" AS away_ht_score
      FROM (VALUES ${Prisma.join(values)})
        AS p(home_team_id, away_team_id, before)
      CROSS JOIN LATERAL (
        SELECT fx.*
        FROM fixture fx
        WHERE fx.status = 'FINISHED'
          AND fx."homeScore" IS NOT NULL
          AND fx."awayScore" IS NOT NULL
          AND fx."scheduledAt" < p.before
          AND (
            (fx."homeTeamId" = p.home_team_id AND fx."awayTeamId" = p.away_team_id)
            OR (fx."homeTeamId" = p.away_team_id AND fx."awayTeamId" = p.home_team_id)
          )
        ORDER BY fx."scheduledAt" DESC
        LIMIT ${H2H_ROW_LIMIT}
      ) f
      JOIN season s      ON s.id = f."seasonId"
      JOIN competition c ON c.id = s."competitionId"
      ORDER BY f."scheduledAt" DESC
    `;

    for (const row of rows) {
      const key = `${row.pair_home}:${row.pair_away}`;
      const list = result.get(key) ?? [];
      list.push({
        fixtureId: row.fixture_id,
        scheduledAt: row.scheduled_at,
        competitionCode: row.competition_code,
        competitionName: row.competition_name,
        homeTeamId: row.home_team_id,
        awayTeamId: row.away_team_id,
        homeScore: row.home_score,
        awayScore: row.away_score,
        homeHtScore: row.home_ht_score,
        awayHtScore: row.away_ht_score,
      });
      result.set(key, list);
    }

    return result;
  }

  /**
   * Matchs terminés d'une saison avant une date donnée — matière première du
   * classement dérivé (la table `standing` n'est plus alimentée).
   */
  async getSeasonFixturesBefore(input: {
    seasonIds: readonly string[];
    before: Date;
  }): Promise<Map<string, StandingFixture[]>> {
    const result = new Map<string, StandingFixture[]>();
    if (input.seasonIds.length === 0) return result;

    const rows = await this.prisma.client.$queryRaw<
      {
        season_id: string;
        home_team_id: string;
        away_team_id: string;
        home_score: number;
        away_score: number;
      }[]
    >`
      SELECT
        f."seasonId"   AS season_id,
        f."homeTeamId" AS home_team_id,
        f."awayTeamId" AS away_team_id,
        f."homeScore"  AS home_score,
        f."awayScore"  AS away_score
      FROM fixture f
      WHERE f."seasonId" = ANY(ARRAY[${Prisma.join([...input.seasonIds])}]::uuid[])
        AND f.status = 'FINISHED'
        AND f."homeScore" IS NOT NULL
        AND f."awayScore" IS NOT NULL
        AND f."scheduledAt" < ${input.before}
    `;

    for (const row of rows) {
      const list = result.get(row.season_id) ?? [];
      list.push({
        homeTeamId: row.home_team_id,
        awayTeamId: row.away_team_id,
        homeScore: row.home_score,
        awayScore: row.away_score,
      });
      result.set(row.season_id, list);
    }

    return result;
  }

  /**
   * Cotes des marchés cibles ET de leurs compléments, réduites à deux bornes
   * par (match, marché, pick, bookmaker) : le snapshot le plus récent et le
   * premier observé.
   *
   * Les compléments (DRAW, NO, UNDER…) ne sont pas des marchés cibles mais sont
   * indispensables pour estimer la marge du bookmaker — sans eux, pas de
   * probabilité implicite dé-marginalisée.
   *
   * ONE_X_TWO stocke ses trois cotes en colonnes (`pick` est NULL) alors que les
   * autres marchés utilisent `pick` + `odds` : la première branche du UNION
   * dépivote la première forme vers la seconde.
   */
  async getTargetMarketOdds(
    fixtureIds: readonly string[],
  ): Promise<Map<string, BookmakerQuote[]>> {
    const result = new Map<string, BookmakerQuote[]>();
    if (fixtureIds.length === 0) return result;

    const ids = Prisma.sql`ANY(ARRAY[${Prisma.join([...fixtureIds])}]::uuid[])`;

    const rows = await this.prisma.client.$queryRaw<
      {
        fixture_id: string;
        market: string;
        pick: string;
        bookmaker: string;
        latest_odds: DecimalLike;
        latest_at: Date;
        first_odds: DecimalLike;
        first_at: Date;
        snapshot_count: bigint;
      }[]
    >`
      WITH expanded AS (
        SELECT
          o."fixtureId"  AS fixture_id,
          'ONE_X_TWO'    AS market,
          v.pick         AS pick,
          v.odds         AS odds,
          o.bookmaker    AS bookmaker,
          o."snapshotAt" AS snapshot_at
        FROM odds_snapshot o
        CROSS JOIN LATERAL (VALUES
          ('HOME', o."homeOdds"),
          ('DRAW', o."drawOdds"),
          ('AWAY', o."awayOdds")
        ) AS v(pick, odds)
        WHERE o."fixtureId" = ${ids}
          AND o.market = 'ONE_X_TWO'
          AND v.odds IS NOT NULL
          AND v.odds > 1

        UNION ALL

        SELECT
          o."fixtureId",
          o.market::text,
          o.pick,
          o.odds,
          o.bookmaker,
          o."snapshotAt"
        FROM odds_snapshot o
        WHERE o."fixtureId" = ${ids}
          AND o.market IN ('BTTS', 'OVER_UNDER', 'TO_WIN_EITHER_HALF')
          AND o.pick IN ('YES', 'NO', 'OVER', 'UNDER', 'OVER_1_5', 'UNDER_1_5', 'HOME', 'AWAY')
          AND o.odds IS NOT NULL
          AND o.odds > 1
      )
      SELECT
        fixture_id,
        market,
        pick,
        bookmaker,
        (array_agg(odds        ORDER BY snapshot_at DESC))[1] AS latest_odds,
        (array_agg(snapshot_at ORDER BY snapshot_at DESC))[1] AS latest_at,
        (array_agg(odds        ORDER BY snapshot_at ASC))[1]  AS first_odds,
        (array_agg(snapshot_at ORDER BY snapshot_at ASC))[1]  AS first_at,
        count(DISTINCT snapshot_at)                           AS snapshot_count
      FROM expanded
      GROUP BY fixture_id, market, pick, bookmaker
    `;

    for (const row of rows) {
      const list = result.get(row.fixture_id) ?? [];
      list.push({
        market: row.market,
        pick: row.pick,
        bookmaker: row.bookmaker,
        latestOdds: round(row.latest_odds),
        latestSnapshotAt: row.latest_at,
        firstOdds: round(row.first_odds),
        firstSnapshotAt: row.first_at,
        snapshotCount: Number(row.snapshot_count),
      });
      result.set(row.fixture_id, list);
    }

    return result;
  }

  /**
   * Calibration par (marché × compétition) sur tout l'historique réglé.
   *
   * Périmètre : uniquement les sélections RÉGLÉES (WON/LOST) issues d'une
   * décision SELECTED, avec une cote. Sont exclus : CORRECT_SCORE et toute
   * sélection sans cote (`observationOnly` — jamais jouable), et les VOID
   * (remboursées : ni gagnées ni perdues).
   *
   * Les sommes brutes sont rendues telles quelles ; les taux, le Brier et le
   * ROI sont dérivés côté calcul, pour que l'agrégat SQL reste vérifiable.
   */
  async getCalibrationRows(): Promise<CalibrationRow[]> {
    const rows = await this.prisma.client.$queryRaw<
      {
        market: string;
        competition_code: string;
        competition_name: string;
        n: bigint;
        wins: bigint;
        losses: bigint;
        sum_probability: DecimalLike;
        sum_brier: DecimalLike;
        sum_return: DecimalLike;
      }[]
    >`
      SELECT
        cs.market::text AS market,
        c.code          AS competition_code,
        c.name          AS competition_name,
        count(*)                                                    AS n,
        count(*) FILTER (WHERE cs.result = 'WON')                   AS wins,
        count(*) FILTER (WHERE cs.result = 'LOST')                  AS losses,
        sum(cs.probability)                                         AS sum_probability,
        sum(
          power(
            cs.probability - (CASE WHEN cs.result = 'WON' THEN 1 ELSE 0 END),
            2
          )
        )                                                           AS sum_brier,
        sum(
          CASE WHEN cs.result = 'WON' THEN cs.odds - 1 ELSE -1 END
        )                                                           AS sum_return
      FROM channel_selection cs
      JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
      JOIN model_run mr        ON mr.id = cd."modelRunId"
      JOIN fixture f           ON f.id = mr."fixtureId"
      JOIN season s            ON s.id = f."seasonId"
      JOIN competition c       ON c.id = s."competitionId"
      WHERE cs.result IN ('WON', 'LOST')
        AND cs.odds IS NOT NULL
        AND cd.channel <> 'CORRECT_SCORE'
      GROUP BY cs.market, c.code, c.name
      HAVING count(*) > 0
      ORDER BY c.code, cs.market
    `;

    return rows.map((row) => ({
      market: row.market,
      competitionCode: row.competition_code,
      competitionName: row.competition_name,
      n: Number(row.n),
      wins: Number(row.wins),
      losses: Number(row.losses),
      sumProbability: round(row.sum_probability),
      sumBrier: round(row.sum_brier),
      sumReturn: round(row.sum_return),
    }));
  }

  /** Ce que la calibration écarte, et pourquoi — pour rendre le périmètre auditable. */
  async getCalibrationExclusions(): Promise<CalibrationExclusions> {
    const rows = await this.prisma.client.$queryRaw<
      {
        observation_only: bigint;
        voided: bigint;
        without_odds: bigint;
      }[]
    >`
      SELECT
        count(*) FILTER (WHERE cd.channel = 'CORRECT_SCORE')                 AS observation_only,
        count(*) FILTER (WHERE cs.result = 'VOID')                           AS voided,
        count(*) FILTER (WHERE cs.odds IS NULL AND cd.channel <> 'CORRECT_SCORE') AS without_odds
      FROM channel_selection cs
      JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
      WHERE cs.result IS NOT NULL
    `;

    const row = rows[0];
    return {
      observationOnly: row ? Number(row.observation_only) : 0,
      voided: row ? Number(row.voided) : 0,
      withoutOdds: row ? Number(row.without_odds) : 0,
    };
  }

  /**
   * Biais du λ par compétition : buts prédits (λ_home + λ_away) contre buts
   * réellement marqués, sur les matchs terminés analysés.
   *
   * Un seul ModelRun par match (le plus récent) pour éviter qu'un match
   * ré-analysé trois fois ne pèse trois fois dans la moyenne.
   */
  async getLambdaBiasRows(): Promise<LambdaBiasRow[]> {
    const rows = await this.prisma.client.$queryRaw<
      {
        competition_code: string;
        competition_name: string;
        n: bigint;
        avg_predicted: number | null;
        avg_actual: number | null;
      }[]
    >`
      WITH latest_run AS (
        SELECT DISTINCT ON (mr."fixtureId")
          mr."fixtureId" AS fixture_id,
          (mr.features->>'lambdaHome')::float8 AS lambda_home,
          (mr.features->>'lambdaAway')::float8 AS lambda_away
        FROM model_run mr
        WHERE mr.features->>'lambdaHome' IS NOT NULL
          AND mr.features->>'lambdaAway' IS NOT NULL
        ORDER BY mr."fixtureId", mr."analyzedAt" DESC
      )
      SELECT
        c.code AS competition_code,
        c.name AS competition_name,
        count(*) AS n,
        avg(lr.lambda_home + lr.lambda_away)      AS avg_predicted,
        avg(f."homeScore" + f."awayScore")::float8 AS avg_actual
      FROM latest_run lr
      JOIN fixture f     ON f.id = lr.fixture_id
      JOIN season s      ON s.id = f."seasonId"
      JOIN competition c ON c.id = s."competitionId"
      WHERE f.status = 'FINISHED'
        AND f."homeScore" IS NOT NULL
        AND f."awayScore" IS NOT NULL
      GROUP BY c.code, c.name
      ORDER BY c.code
    `;

    return rows.map((row) => ({
      competitionCode: row.competition_code,
      competitionName: row.competition_name,
      n: Number(row.n),
      avgPredictedGoals:
        row.avg_predicted === null ? null : round(row.avg_predicted),
      avgActualGoals: row.avg_actual === null ? null : round(row.avg_actual),
    }));
  }
}
