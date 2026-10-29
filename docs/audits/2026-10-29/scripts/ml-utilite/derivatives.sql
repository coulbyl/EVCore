-- Matchs terminés depuis le 01/09 cotés par 1xBet : dernier relevé 1xBet ≥ 1 h avant le coup d'envoi par (marché, pick, ligne),
-- et le relevé Pinnacle le plus proche dans le temps (≤ 3 h) par (marché, pick, ligne).
WITH fx AS (
  SELECT f.id, f."scheduledAt", f."homeScore" hs, f."awayScore" "as", f."homeHtScore" hths, f."awayHtScore" aths, c.code AS competition
  FROM fixture f JOIN season s ON s.id=f."seasonId" JOIN competition c ON c.id=s."competitionId"
  WHERE f.status='FINISHED' AND f."homeScore" IS NOT NULL AND f."scheduledAt" >= '2026-09-01'
),
soft AS (
  SELECT DISTINCT ON (o."fixtureId", o.market, o.pick, o.line)
         o."fixtureId", o.market, o.pick, o.line, o.odds, o."homeOdds", o."drawOdds", o."awayOdds", o."snapshotAt"
  FROM odds_snapshot o JOIN fx ON fx.id=o."fixtureId"
  WHERE o.bookmaker='1xBet' AND o."snapshotAt" <= fx."scheduledAt" - interval '1 hour'
  ORDER BY o."fixtureId", o.market, o.pick, o.line, o."snapshotAt" DESC
),
t_soft AS (SELECT "fixtureId", "snapshotAt" AS t FROM soft WHERE market='ONE_X_TWO'),
sharp AS (
  SELECT DISTINCT ON (o."fixtureId", o.market, o.pick, o.line)
         o."fixtureId", o.market, o.pick, o.line, o.odds, o."homeOdds", o."drawOdds", o."awayOdds", o."snapshotAt"
  FROM odds_snapshot o JOIN t_soft ts ON ts."fixtureId"=o."fixtureId"
  WHERE o.bookmaker='Pinnacle' AND abs(extract(epoch FROM (o."snapshotAt"-ts.t))) <= 3*3600
  ORDER BY o."fixtureId", o.market, o.pick, o.line, abs(extract(epoch FROM (o."snapshotAt"-ts.t)))
)
SELECT fx.id AS fixture, fx."scheduledAt", fx.competition, fx.hs, fx."as", fx.hths, fx.aths, '1xBet' AS bookmaker,
       s.market, s.pick, s.line, s.odds, s."homeOdds", s."drawOdds", s."awayOdds", s."snapshotAt"
FROM soft s JOIN fx ON fx.id=s."fixtureId"
UNION ALL
SELECT fx.id, fx."scheduledAt", fx.competition, fx.hs, fx."as", fx.hths, fx.aths, 'Pinnacle',
       s.market, s.pick, s.line, s.odds, s."homeOdds", s."drawOdds", s."awayOdds", s."snapshotAt"
FROM sharp s JOIN fx ON fx.id=s."fixtureId"
ORDER BY 1, 8, 9, 10, 11;
