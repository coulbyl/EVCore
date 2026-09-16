-- Lignes d'ouverture et de clôture (chantier B, tâches B-3 et B-4).
--
-- Des vues plutôt qu'une colonne `isClosing` : la clôture est une propriété
-- DÉRIVÉE — c'est le dernier relevé d'avant coup d'envoi — et une colonne
-- exigerait de réécrire la ligne précédente à chaque nouveau relevé, sur une
-- table de 5,5 M lignes, avec le risque qu'un échec laisse deux clôtures ou
-- aucune. La vue ne peut pas se désynchroniser.
--
-- `hoursBeforeKickoff` est indispensable : sans balayage proche du coup
-- d'envoi, le « dernier relevé » peut dater de 24 h et n'est alors pas une
-- ligne de clôture. Tout consommateur doit filtrer là-dessus plutôt que de
-- supposer la fraîcheur.

CREATE OR REPLACE VIEW "odds_closing_line" AS
SELECT DISTINCT ON (o."fixtureId", o.bookmaker, o.market, o.pick, o.line)
  o."fixtureId",
  o.bookmaker,
  o.market,
  o.pick,
  o.line,
  o."homeOdds",
  o."drawOdds",
  o."awayOdds",
  o.odds,
  o."snapshotAt",
  EXTRACT(EPOCH FROM (f."scheduledAt" - o."snapshotAt")) / 3600
    AS "hoursBeforeKickoff"
FROM odds_snapshot o
JOIN fixture f ON f.id = o."fixtureId"
WHERE o."snapshotAt" < f."scheduledAt"
ORDER BY
  o."fixtureId", o.bookmaker, o.market, o.pick, o.line,
  o."snapshotAt" DESC, o.id DESC;

CREATE OR REPLACE VIEW "odds_opening_line" AS
SELECT DISTINCT ON (o."fixtureId", o.bookmaker, o.market, o.pick, o.line)
  o."fixtureId",
  o.bookmaker,
  o.market,
  o.pick,
  o.line,
  o."homeOdds",
  o."drawOdds",
  o."awayOdds",
  o.odds,
  o."snapshotAt",
  EXTRACT(EPOCH FROM (f."scheduledAt" - o."snapshotAt")) / 3600
    AS "hoursBeforeKickoff"
FROM odds_snapshot o
JOIN fixture f ON f.id = o."fixtureId"
WHERE o."snapshotAt" < f."scheduledAt"
ORDER BY
  o."fixtureId", o.bookmaker, o.market, o.pick, o.line,
  o."snapshotAt" ASC, o.id ASC;

COMMENT ON VIEW "odds_closing_line" IS
  'Dernier prix d''avant coup d''envoi par rencontre, book, marché, choix et ligne. Référence du CLV. Filtrer sur hoursBeforeKickoff : un dernier relevé à 24 h n''est pas une clôture.';

COMMENT ON VIEW "odds_opening_line" IS
  'Premier prix connu d''avant coup d''envoi, même grain. Sert à mesurer la dérive ouverture vers clôture (B-10).';
