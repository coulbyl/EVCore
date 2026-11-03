-- Dernier avis joué de l'IA avant le coup d'envoi, par match fini.
-- docker exec evcore-postgres psql -U postgres -d evcore -c "\copy (<cette requête>) to stdout csv header" > ai_plays.csv
-- python3 -I ai-combo.py ai_plays.csv
SELECT DISTINCT ON (h."fixtureId")
       h."fixtureId", f."scheduledAt", s."competitionId", h."configVersion",
       h.market, h.pick, h.probability, h.odds, h."oddsBookmaker",
       h."marginPaid", h.result
FROM vantage_decision_history h
JOIN fixture f ON f.id = h."fixtureId"
JOIN season s ON s.id = f."seasonId"
WHERE h.status = 'SELECTED'
  AND h."createdAt" < f."scheduledAt"
  AND f.status = 'FINISHED'
ORDER BY h."fixtureId", h."createdAt" DESC;
