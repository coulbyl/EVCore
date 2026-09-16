import { Prisma } from "./generated/prisma/client";

/** Latest decision first, including rejections; rank-one settled observations only.
 * Current kickoff is used: historical schedule revisions cannot be reconstructed.
 * VANTAGE mutable decisions are excluded until an immutable event is selected.
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
