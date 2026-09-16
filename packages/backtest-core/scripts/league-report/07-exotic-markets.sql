-- Piste 1 : les marchés exotiques sont-ils moins bien price que 1X2 /
-- over-under / BTTS / mi-temps ?
--
-- Contrairement au paragraphe 3, la comparaison se fait ici contre la
-- probabilité implicite BRUTE (1 / cote), pas contre l'implicite normalisée :
-- la question n'est pas "le marché est-il calibré" mais "cette jambe
-- est-elle jouable", et certains de ces marchés (TO_WIN_EITHER_HALF) n'ont
-- pas de jeu de choix complémentaire permettant une normalisation.
--
-- profit = ce que rapporte une mise de 1 sur ce choix, marge comprise.
WITH latest_per_book AS (
  SELECT DISTINCT ON (o."fixtureId", o.bookmaker, o.market, o.pick)
    o."fixtureId",
    o.market::text AS market,
    o.pick,
    o.odds
  FROM odds_snapshot o
  JOIN fixture f ON f.id = o."fixtureId"
  WHERE f.status = 'FINISHED'
    AND o."snapshotAt" < f."scheduledAt"
    AND o.pick IS NOT NULL
    AND o.odds > 1
    AND o.market NOT IN ('ONE_X_TWO', 'OVER_UNDER', 'BTTS', 'FIRST_HALF_WINNER')
  ORDER BY
    o."fixtureId", o.bookmaker, o.market, o.pick,
    o."snapshotAt" DESC, o.id DESC
),
consensus AS (
  SELECT
    l."fixtureId",
    l.market,
    l.pick,
    avg(l.odds)::double precision AS odds,
    count(*)::int AS books
  FROM latest_per_book l
  GROUP BY l."fixtureId", l.market, l.pick
),
scored AS (
  SELECT
    c.code AS competition,
    k.market,
    k.pick,
    CASE WHEN f."scheduledAt" < TIMESTAMP '2026-08-25 00:00:00'
      THEN 'A' ELSE 'B' END AS period,
    k.odds,
    res.won
  FROM consensus k
  JOIN fixture f ON f.id = k."fixtureId"
  JOIN season s ON s.id = f."seasonId"
  JOIN competition c ON c.id = s."competitionId"
  CROSS JOIN LATERAL (
    SELECT
      f."homeScore" AS hs,
      f."awayScore" AS "as",
      f."homeHtScore" AS hh,
      f."awayHtScore" AS ah,
      f."homeScore" - f."homeHtScore" AS sh,
      f."awayScore" - f."awayHtScore" AS sa,
      split_part(k.pick, '_', 1) AS part1,
      split_part(k.pick, '_', 2) AS part2,
      replace(right(k.pick, 3), '_', '.')::double precision AS line
  ) AS v
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN k.market = 'DOUBLE_CHANCE' AND k.pick = '1X' THEN v.hs >= v."as"
      WHEN k.market = 'DOUBLE_CHANCE' AND k.pick = '12' THEN v.hs <> v."as"
      WHEN k.market = 'DOUBLE_CHANCE' AND k.pick = 'X2' THEN v.hs <= v."as"
      WHEN k.market = 'DRAW_NO_BET' AND v.hs = v."as" THEN NULL
      WHEN k.market = 'DRAW_NO_BET' AND k.pick = 'HOME' THEN v.hs > v."as"
      WHEN k.market = 'DRAW_NO_BET' AND k.pick = 'AWAY' THEN v.hs < v."as"
      WHEN k.market = 'CLEAN_SHEET_HOME' THEN (v."as" = 0) = (k.pick = 'YES')
      WHEN k.market = 'CLEAN_SHEET_AWAY' THEN (v.hs = 0) = (k.pick = 'YES')
      WHEN k.market = 'WIN_TO_NIL_HOME'
        THEN (v.hs > v."as" AND v."as" = 0) = (k.pick = 'YES')
      WHEN k.market = 'WIN_TO_NIL_AWAY'
        THEN (v."as" > v.hs AND v.hs = 0) = (k.pick = 'YES')
      WHEN k.market = 'TO_WIN_EITHER_HALF' AND k.pick = 'HOME'
        THEN v.hh > v.ah OR v.sh > v.sa
      WHEN k.market = 'TO_WIN_EITHER_HALF' AND k.pick = 'AWAY'
        THEN v.ah > v.hh OR v.sa > v.sh
      WHEN k.market = 'OVER_UNDER_HT' AND v.part1 = 'OVER'
        THEN v.hh + v.ah > v.line
      WHEN k.market = 'OVER_UNDER_HT' AND v.part1 = 'UNDER'
        THEN v.hh + v.ah < v.line
      WHEN k.market = 'TEAM_TOTAL_HOME' AND v.part1 = 'OVER' THEN v.hs > v.line
      WHEN k.market = 'TEAM_TOTAL_HOME' AND v.part1 = 'UNDER' THEN v.hs < v.line
      WHEN k.market = 'TEAM_TOTAL_AWAY' AND v.part1 = 'OVER' THEN v."as" > v.line
      WHEN k.market = 'TEAM_TOTAL_AWAY' AND v.part1 = 'UNDER' THEN v."as" < v.line
      WHEN k.market = 'HALF_TIME_FULL_TIME'
        THEN CASE v.part1
               WHEN 'HOME' THEN v.hh > v.ah
               WHEN 'DRAW' THEN v.hh = v.ah
               ELSE v.hh < v.ah
             END
         AND CASE v.part2
               WHEN 'HOME' THEN v.hs > v."as"
               WHEN 'DRAW' THEN v.hs = v."as"
               ELSE v.hs < v."as"
             END
      WHEN k.market = 'RESULT_BTTS'
        THEN CASE v.part1
               WHEN 'HOME' THEN v.hs > v."as"
               WHEN 'DRAW' THEN v.hs = v."as"
               ELSE v.hs < v."as"
             END
         AND (v.hs > 0 AND v."as" > 0) = (v.part2 = 'YES')
      WHEN k.market = 'RESULT_TOTAL_GOALS'
        THEN CASE v.part1
               WHEN 'HOME' THEN v.hs > v."as"
               WHEN 'DRAW' THEN v.hs = v."as"
               ELSE v.hs < v."as"
             END
         AND CASE v.part2
               WHEN 'OVER' THEN v.hs + v."as" > v.line
               ELSE v.hs + v."as" < v.line
             END
      WHEN k.market = 'CORRECT_SCORE'
        THEN v.hs = split_part(k.pick, ':', 1)::int
         AND v."as" = split_part(k.pick, ':', 2)::int
      ELSE NULL
    END AS won
  ) AS res
  WHERE f."homeScore" IS NOT NULL
    AND f."awayScore" IS NOT NULL
    AND (
      k.market NOT IN (
        'TO_WIN_EITHER_HALF', 'OVER_UNDER_HT', 'HALF_TIME_FULL_TIME'
      )
      OR (f."homeHtScore" IS NOT NULL AND f."awayHtScore" IS NOT NULL)
    )
    AND res.won IS NOT NULL
)
SELECT
  competition,
  market,
  pick,
  period,
  count(*)::int AS n,
  count(*) FILTER (WHERE won)::int AS hits,
  sum(1 / odds)::double precision AS "impliedSum",
  sum(odds)::double precision AS "oddsSum",
  sum(CASE WHEN won THEN odds - 1 ELSE -1 END)::double precision AS profit
FROM scored
GROUP BY competition, market, pick, period
ORDER BY competition, market, pick, period
