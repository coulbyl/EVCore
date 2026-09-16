SELECT
  c.code AS competition,
  c.name,
  c.country,
  count(DISTINCT s.id)::int AS seasons,
  count(f.id)::int AS finished,
  count(f."homeHtScore")::int AS "withHalfTime",
  min(f."scheduledAt") AS "firstKickoff",
  max(f."scheduledAt") AS "lastKickoff"
FROM competition c
JOIN season s ON s."competitionId" = c.id
JOIN fixture f ON f."seasonId" = s.id
WHERE f.status = 'FINISHED'
  AND f."homeScore" IS NOT NULL
  AND f."awayScore" IS NOT NULL
GROUP BY c.code, c.name, c.country
ORDER BY c.code
