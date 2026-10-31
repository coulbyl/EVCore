WITH fx AS (
  SELECT f.id, f."scheduledAt", f."homeScore" hs, f."awayScore" "as", c.code AS competition
  FROM fixture f JOIN season s ON s.id=f."seasonId" JOIN competition c ON c.id=s."competitionId"
  WHERE f.status='FINISHED' AND f."homeScore" IS NOT NULL AND f."scheduledAt" >= '2026-07-01'
),
soft AS (
  SELECT DISTINCT ON (o."fixtureId", o.bookmaker) o."fixtureId", o.bookmaker, o."homeOdds", o."drawOdds", o."awayOdds", o."snapshotAt"
  FROM odds_snapshot o JOIN fx ON fx.id=o."fixtureId"
  WHERE o.market='ONE_X_TWO' AND o.bookmaker<>'Pinnacle' AND o."snapshotAt" <= fx."scheduledAt" - interval '1 hour'
    AND o."homeOdds">1 AND o."drawOdds">1 AND o."awayOdds">1
  ORDER BY o."fixtureId", o.bookmaker, o."snapshotAt" DESC
)
SELECT fx.id AS fixture, fx."scheduledAt", fx.competition, '1X2' AS market, so.bookmaker,
       extract(epoch FROM (fx."scheduledAt"-so."snapshotAt"))/3600 AS h_before_soft,
       extract(epoch FROM (so."snapshotAt"-p."snapshotAt"))/3600 AS gap_h,
       so."homeOdds" soft_h, so."drawOdds" soft_d, so."awayOdds" soft_a, p."homeOdds" sharp_h, p."drawOdds" sharp_d, p."awayOdds" sharp_a, fx.hs, fx."as"
FROM soft so JOIN fx ON fx.id=so."fixtureId"
JOIN LATERAL (SELECT o."homeOdds", o."drawOdds", o."awayOdds", o."snapshotAt" FROM odds_snapshot o
              WHERE o."fixtureId"=so."fixtureId" AND o.bookmaker='Pinnacle' AND o.market='ONE_X_TWO' AND o."homeOdds">1 AND o."drawOdds">1 AND o."awayOdds">1
                AND abs(extract(epoch FROM (o."snapshotAt"-so."snapshotAt")))<=3*3600
              ORDER BY abs(extract(epoch FROM (o."snapshotAt"-so."snapshotAt"))) LIMIT 1) p ON true;
