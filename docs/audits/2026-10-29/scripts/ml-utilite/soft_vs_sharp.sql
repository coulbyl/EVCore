-- Pour chaque match terminé depuis juillet : le dernier relevé 1xBet avant le coup d'envoi (≥ 1 h avant),
-- le relevé Pinnacle le plus proche dans le temps (≤ 3 h d'écart), sur 1X2 / O-U 2,5 / BTTS.
WITH fx AS (
  SELECT f.id, f."scheduledAt", f."homeScore" hs, f."awayScore" "as", c.code AS competition
  FROM fixture f JOIN season s ON s.id=f."seasonId" JOIN competition c ON c.id=s."competitionId"
  WHERE f.status='FINISHED' AND f."homeScore" IS NOT NULL AND f."scheduledAt" >= '2026-07-01'
),
x1 AS (  -- 1X2
  SELECT fx.id, fx."scheduledAt", fx.hs, fx."as", fx.competition, '1X2' AS market,
         s.bookmaker, s."snapshotAt", s."homeOdds" o_h, s."drawOdds" o_d, s."awayOdds" o_a,
         extract(epoch FROM (fx."scheduledAt" - s."snapshotAt"))/3600 AS h_before
  FROM fx JOIN odds_snapshot s ON s."fixtureId"=fx.id AND s.market='ONE_X_TWO'
  WHERE s."homeOdds">1 AND s."drawOdds">1 AND s."awayOdds">1 AND s.bookmaker IN ('1xBet','Pinnacle')
),
soft AS (SELECT DISTINCT ON (id) * FROM x1 WHERE bookmaker='1xBet' AND h_before >= 1 ORDER BY id, "snapshotAt" DESC),
sharp AS (SELECT * FROM x1 WHERE bookmaker='Pinnacle')
SELECT so.id AS fixture, so."scheduledAt", so.competition, so.market, so.h_before AS h_before_soft,
       extract(epoch FROM (so."snapshotAt" - sh."snapshotAt"))/3600 AS gap_h,
       so.o_h AS soft_h, so.o_d AS soft_d, so.o_a AS soft_a,
       sh.o_h AS sharp_h, sh.o_d AS sharp_d, sh.o_a AS sharp_a,
       so.hs, so."as"
FROM soft so
JOIN LATERAL (SELECT * FROM sharp sh WHERE sh.id=so.id AND abs(extract(epoch FROM (sh."snapshotAt"-so."snapshotAt"))) <= 3*3600
              ORDER BY abs(extract(epoch FROM (sh."snapshotAt"-so."snapshotAt"))) LIMIT 1) sh ON true;
