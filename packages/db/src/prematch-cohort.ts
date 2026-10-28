import { Prisma } from "./generated/prisma/client";

/** Latest decision first, including rejections; rank-one settled observations only.
 * Current kickoff is used: historical schedule revisions cannot be reconstructed.
 * VANTAGE's live decisions are mutable: its cohort is vantageCohortSql below.
 */
export function prematchCohortSql(options: {
  asOf: Date;
  since?: Date;
  until?: Date;
  configVersion?: string;
}): Prisma.Sql {
  return Prisma.sql`
    WITH latest AS (
      SELECT DISTINCT ON (mr."fixtureId", cd.channel) cd.id, f."scheduledAt"
      FROM channel_decision cd
      JOIN model_run mr ON mr.id = cd."modelRunId"
      JOIN fixture f ON f.id = mr."fixtureId"
      WHERE f.status = 'FINISHED'
        AND f."scheduledAt" < ${options.asOf}
        AND mr."analyzedAt" < f."scheduledAt"
        AND mr."createdAt" < f."scheduledAt"
        AND cd."createdAt" < f."scheduledAt"
        AND cd.channel <> 'VANTAGE'
        ${options.since ? Prisma.sql`AND f."scheduledAt" >= ${options.since}` : Prisma.empty}
        ${options.until ? Prisma.sql`AND f."scheduledAt" <= ${options.until}` : Prisma.empty}
      ORDER BY mr."fixtureId", cd.channel, mr."analyzedAt" DESC, cd."createdAt" DESC, cd.id DESC
    )
    SELECT cs.id FROM latest l
    JOIN channel_decision cd ON cd.id = l.id
    JOIN channel_selection cs ON cs."channelDecisionId" = cd.id
    WHERE cd.status = 'SELECTED' AND cs.rank = 1
      AND cs."createdAt" < l."scheduledAt"
      AND cs."settledAt" < ${options.asOf}
      AND cs.result IN ('WON', 'LOST', 'VOID') AND cs.odds > 1
      ${options.configVersion ? Prisma.sql`AND cd."configVersion" = ${options.configVersion}` : Prisma.empty}
  `;
}

/**
 * Avis VANTAGE comptés (2026-10-29) : par match fini, la dernière ligne de
 * l'historique en ajout seul (`vantage_decision_history`) écrite avant le
 * coup d'envoi ; elle compte si c'est un avis avec marché et pari, réglé.
 * La ligne vivante de channel_decision est réécrite par upsert, parfois après
 * le coup d'envoi : elle n'entre jamais dans un bilan.
 */
export function vantageCohortSql(options: {
  asOf: Date;
  since?: Date;
  until?: Date;
  configVersion?: string;
}): Prisma.Sql {
  return Prisma.sql`
    WITH latest AS (
      SELECT DISTINCT ON (h."fixtureId") h.id, h.status, h.market, h.pick,
             h.result, h."settledAt", h.odds, h."configVersion"
      FROM vantage_decision_history h
      JOIN fixture f ON f.id = h."fixtureId"
      WHERE f.status = 'FINISHED'
        AND f."scheduledAt" < ${options.asOf}
        AND h."createdAt" < f."scheduledAt"
        ${options.since ? Prisma.sql`AND f."scheduledAt" >= ${options.since}` : Prisma.empty}
        ${options.until ? Prisma.sql`AND f."scheduledAt" <= ${options.until}` : Prisma.empty}
      ORDER BY h."fixtureId", h."createdAt" DESC, h.id DESC
    )
    SELECT l.id FROM latest l
    WHERE l.status = 'SELECTED' AND l.market IS NOT NULL AND l.pick IS NOT NULL
      AND l."settledAt" < ${options.asOf}
      AND l.result IN ('WON', 'LOST', 'VOID') AND l.odds > 1
      ${options.configVersion ? Prisma.sql`AND l."configVersion" = ${options.configVersion}` : Prisma.empty}
  `;
}
