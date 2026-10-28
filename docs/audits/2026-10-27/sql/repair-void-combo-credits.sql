-- Régularisation des combinés à jambe remboursée jamais crédités au solde.
--
-- Avant le commit 056fb37e (2026-10-27), le règlement ne créditait un
-- combiné que si toutes ses jambes étaient gagnées. Un combiné « gagné +
-- remboursé » n'était jamais payé, un combiné entièrement remboursé ne
-- rendait pas sa mise. Cette requête écrit le mouvement manquant, avec la
-- règle désormais appliquée : une jambe remboursée compte pour une cote de 1.
--
-- Rejouable : un combiné qui a déjà un BET_WON ou un BET_VOID sur l'une de
-- ses jambes est ignoré. À lancer par l'utilisateur, en production, une fois
-- le backend déployé (sinon un règlement en cours pourrait écrire le même
-- mouvement entre-temps, ce qui est sans effet ici grâce au NOT EXISTS).
BEGIN;

WITH combo AS (
  SELECT bs.id, bs."userId", bs."unitStake",
         bool_or(b.status = 'LOST')    AS any_lost,
         bool_or(b.status = 'PENDING') AS any_pending,
         bool_or(b.status = 'VOID')    AS any_void,
         bool_and(b.status = 'VOID')   AS all_void,
         bool_or(b.status = 'WON' AND b."oddsSnapshot" IS NULL) AS won_without_odds,
         exp(sum(ln(b."oddsSnapshot")) FILTER (WHERE b.status = 'WON')) AS won_odds,
         array_agg(b.id) AS bet_ids
  FROM bet_slip bs
  JOIN bet_slip_item i ON i."betSlipId" = bs.id
  JOIN bet b ON b.id = i."betId"
  WHERE bs.type = 'COMBO'
  GROUP BY bs.id, bs."userId", bs."unitStake"
),
target AS (
  SELECT c.*,
         -- Le mouvement est rattaché à la jambe qui porte la mise du combiné.
         (SELECT t."betId" FROM bankroll_transaction t
           WHERE t."userId" = c."userId" AND t.type = 'BET_PLACED'
             AND t."betId" = ANY (c.bet_ids)
           ORDER BY t."createdAt" LIMIT 1) AS placed_bet_id
  FROM combo c
  WHERE c.any_void AND NOT c.any_lost AND NOT c.any_pending
    AND NOT c.won_without_odds
    AND NOT EXISTS (
      SELECT 1 FROM bankroll_transaction t
      WHERE t."userId" = c."userId"
        AND t.type IN ('BET_WON', 'BET_VOID')
        AND t."betId" = ANY (c.bet_ids)
    )
)
INSERT INTO bankroll_transaction ("userId", type, amount, "betId", note)
SELECT "userId",
       CASE WHEN all_void THEN 'BET_VOID' ELSE 'BET_WON' END::"BankrollTransactionType",
       CASE WHEN all_void THEN "unitStake"
            ELSE round("unitStake" * won_odds, 2) END,
       placed_bet_id,
       'Régularisation : jambe remboursée comptée à 1 (2026-10-27)'
FROM target
WHERE placed_bet_id IS NOT NULL
RETURNING "userId", type, amount, "betId";

COMMIT;
