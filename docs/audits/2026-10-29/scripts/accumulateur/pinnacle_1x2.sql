-- Dernier prix Pinnacle 1X2 d'avant coup d'envoi, tous matchs finis, réglé sur le score.
-- Sortie : day | fixtureId | competition | pick | odds | won  (une ligne par issue).
WITH fx AS (
  SELECT f.id, f."scheduledAt", f."homeScore" hs, f."awayScore" aws, c.code AS competition
  FROM fixture f JOIN season s ON s.id=f."seasonId" JOIN competition c ON c.id=s."competitionId"
  WHERE f.status='FINISHED' AND f."homeScore" IS NOT NULL
),
px AS (
  SELECT DISTINCT ON (o."fixtureId") o."fixtureId", o."homeOdds" h, o."drawOdds" d, o."awayOdds" a
  FROM odds_snapshot o JOIN fx ON fx.id=o."fixtureId"
  WHERE o.market='ONE_X_TWO' AND o.bookmaker='Pinnacle' AND o."snapshotAt" <= fx."scheduledAt"
    AND o."homeOdds">1 AND o."drawOdds">1 AND o."awayOdds">1
  ORDER BY o."fixtureId", o."snapshotAt" DESC
)
SELECT to_char(fx."scheduledAt",'YYYY-MM-DD') AS day, fx.id, fx.competition, p.pick, p.odds,
       CASE p.pick WHEN 'HOME' THEN (fx.hs>fx.aws)::int WHEN 'DRAW' THEN (fx.hs=fx.aws)::int ELSE (fx.aws>fx.hs)::int END AS won
FROM px JOIN fx ON fx.id=px."fixtureId"
CROSS JOIN LATERAL (VALUES ('HOME',px.h),('DRAW',px.d),('AWAY',px.a)) AS p(pick,odds)
ORDER BY 1,2;
