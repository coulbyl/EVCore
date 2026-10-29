-- Fenêtre des compositions : pour chaque match terminé depuis le 10/10, prix Pinnacle et 1xBet relevés
-- à T−60 (50–65 min) et T−10 (4–14 min), sur 1X2 et O/U 2,5. Une ligne par (match, book, fenêtre).
WITH fx AS (
  SELECT f.id, f."scheduledAt", f."homeScore" hs, f."awayScore" "as", c.code AS competition
  FROM fixture f JOIN season s ON s.id=f."seasonId" JOIN competition c ON c.id=s."competitionId"
  WHERE f.status='FINISHED' AND f."homeScore" IS NOT NULL AND f."scheduledAt" >= '2026-10-10'
),
snaps AS (
  SELECT fx.id AS fixture, fx."scheduledAt", fx.competition, fx.hs, fx."as", o.bookmaker, o.market, o.pick, o.line,
         o.odds, o."homeOdds", o."drawOdds", o."awayOdds", COALESCE(o."observedAt", o."snapshotAt") AS seen,
         extract(epoch FROM (fx."scheduledAt" - COALESCE(o."observedAt", o."snapshotAt")))/60 AS min_before
  FROM odds_snapshot o JOIN fx ON fx.id=o."fixtureId"
  WHERE o.bookmaker IN ('Pinnacle','1xBet')
    AND ((o.market='ONE_X_TWO') OR (o.market='OVER_UNDER' AND o.pick IN ('OVER','UNDER') AND o.line IS NULL))
),
win AS (
  SELECT *, CASE WHEN min_before BETWEEN 45 AND 70 THEN 'T60' WHEN min_before BETWEEN 3 AND 15 THEN 'T10' WHEN min_before BETWEEN 900 AND 2200 THEN 'J1' END AS w
  FROM snaps
)
SELECT DISTINCT ON (fixture, bookmaker, market, pick, w)
       fixture, "scheduledAt", competition, hs, "as", bookmaker, market, pick, w, min_before, odds, "homeOdds", "drawOdds", "awayOdds"
FROM win WHERE w IS NOT NULL
ORDER BY fixture, bookmaker, market, pick, w, abs(min_before - CASE w WHEN 'T60' THEN 60 WHEN 'J1' THEN 1440 ELSE 10 END);
