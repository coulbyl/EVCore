# Archivage des cotes — `odds_snapshot` partitionnée, l'historique en Parquet

_Branche `feat/odds-archive`, depuis `main` (540283d7). Mesures sur la prod (tunnel en lecture seule, 03/11) et sur la copie locale du dump du 03/11 04:01. Décision du 03/11 : archiver plutôt que supprimer, des solutions durables (natives Postgres), pas de nouvelle base (Mongo écarté)._

## 1. Le constat

| Mesure | Valeur |
| --- | --- |
| Taille de `odds_snapshot` en prod | 7,1 Go (3,3 Go de données, 3,8 Go d'index) sur une base de 9,2 Go ; 26,2 M lignes |
| Croissance | ~4 M lignes par semaine depuis le 05/10 (0,7 M fin août), soit ~1 Go par semaine |
| Lignes par match joué (300 matchs tirés au hasard, 60 derniers jours) | 5 509 : ~811 combinaisons bookmaker × marché × choix × ligne, relevées 6,8 fois chacune |
| Âge des lignes (échantillon 0,5 %) | 85 % de matchs joués depuis plus de 7 jours, 14 % joués cette semaine, 1 % à venir |
| Lignes gardées si l'on ne conserve qu'ouverture + clôture (`PREMATCH`) et tout `HISTORICAL` | 29 % (71 % archivables) |
| Parquet (zstd) | 18 octets par ligne, contre ~284 dans Postgres index compris : 16 fois moins ; une semaine (1,45 M lignes) exportée en 2,1 s |

## 2. Qui lit l'historique

Inventaire complet des lecteurs (23 à l'exécution, ~15 scripts, 2 vues, 1 déclencheur ; **aucune clé étrangère** vers `odds_snapshot.id`).

- **La base suffit** (clôture, ouverture, dernières cotes, ou matchs à venir) : moteur et passes du jour, `odds_latest`, vues `odds_closing_line` / `odds_opening_line`, CLV au règlement, écrans Matchs / fiche / ticket, coupons du soir, VANTAGE, imports historiques.
- **Une cote à un instant précédant la clôture** :
  - règlement d'une plage (`settleRange` → `priceUnpricedLegs`, `asOf = coupon.generatedAt`) : **argent** ; la ligne en vigueur à la génération de chaque coupon est **gardée en base** ;
  - comparaison à T−7 j du moteur (ombre, rejeu d'un vieux match seulement), backtest à T−1 h (`scripts/backtest-strategy-ranking.ts`), extraction ML (`apps/ml-worker`, au moment de l'analyse), scripts d'audit à T−60 / T−10 : **études**, elles lisent l'archive.
- **Tout l'historique** (comptes, médianes de relevés) : `analysis-sheet` v2 (`snapshotCount`), `backtest-calibration-alert-over-under.ts`, `10-odds-freshness.sql`, `db-stats` : lisent l'archive ou comptent sur la fenêtre récente.

Deux pièges relevés par l'inventaire, dont la règle de conservation tient compte :

1. Les lignes `HISTORICAL` portent les mêmes noms de bookmaker que les `PREMATCH` : l'ouverture et la clôture se calculent **parmi les `PREMATCH` seules**, sinon une ligne historique prend la place de la clôture et la vraie est archivée.
2. « Clôture » a deux définitions dans le code : la vue trie par heure d'observation (`COALESCE(observedAt, createdAt)`), `odds_latest` et la plupart des lecteurs par `snapshotAt`. **On garde les deux** quand elles diffèrent ; idem pour l'ouverture (la vue trie par `createdAt`).

## 3. La règle de conservation en base

Pour une partition mensuelle close (tous ses matchs joués depuis plus de 7 jours), on garde :

- toutes les lignes `HISTORICAL` ;
- par (match, bookmaker, marché, choix, ligne), parmi les `PREMATCH` d'avant le coup d'envoi : la dernière par heure d'observation, la dernière par `snapshotAt`, la première par `createdAt` ;
- pour chaque jambe de coupon (`coupon_proposal_leg`), la ligne en vigueur à `generatedAt` du coupon pour son (match, marché, choix, ligne) chez les bookmakers opérateurs ;
- rien d'autre : les relevés intermédiaires et les relevés d'après le coup d'envoi (0,9 %) partent dans l'archive.

## 4. La mécanique — native, sans extension

- **`odds_snapshot` partitionnée par mois de `snapshotAt`** (`PARTITION BY RANGE`). Les clés uniques d'une table partitionnée incluent la clé de partition : la clé primaire devient `(id, snapshotAt)` (Prisma `@@id([id, snapshotAt])`) ; la clé unique `(fixtureId, bookmaker, market, pick, line, snapshotAt)` la contient déjà. Les six mises à jour par `id` de `fixture.repository.ts` passent à la clé composée (elles lisent la ligne juste avant). Le déclencheur `odds_latest` et les deux vues restent sur la table mère, inchangés.
- **Archive** : un fichier Parquet par mois, `odds-archive/odds_snapshot/YYYY-MM.parquet` sur RustFS (bucket dédié), écrit par DuckDB (`@duckdb/node-api`) qui lit la partition par l'extension `postgres` ; relu par DuckDB pour les études (`read_parquet('s3://…')`).
- **Job mensuel** dans le worker (`OddsArchiveScheduler`, le 20 de chaque mois) pour le mois M−1 dont tous les matchs ont plus de 7 jours (une cote est prise au plus ~10 jours avant le match ; le 20, le mois précédent est clos depuis 20 jours) :
  1. exporter toute la partition en Parquet, puis **vérifier** : même nombre de lignes, même somme de contrôle (`count`, `min/max(snapshotAt)`, somme des `odds`) relus depuis le fichier ;
  2. construire une table compacte avec les seules lignes gardées (règle § 3), ses index ;
  3. dans une transaction courte : détacher l'ancienne partition, attacher la compacte, supprimer l'ancienne ; la place est rendue tout de suite, sans `DELETE` ni `VACUUM FULL` ;
  4. noter le mois archivé (`odds_archive_month` : mois, lignes avant / après, fichier, somme de contrôle) ; un mois déjà noté n'est jamais refait ;
  5. créer d'avance les partitions des deux mois à venir (et une partition par défaut qui ne doit rester vide, surveillée par la console).
- **Interrupteur** : le job respecte « Passes planifiées » ; une passe de cotes qui tombe pendant l'échange attend son verrou (quelques secondes).

## 5. La conversion initiale (une fois)

Fenêtre courte, passes planifiées coupées dans l'admin :

1. créer la table mère partitionnée et les partitions mensuelles depuis la plus ancienne cote ;
2. exporter en Parquet tous les mois clos, vérifiés comme au § 4 ;
3. copier dans les partitions : tout pour les mois récents, les seules lignes gardées pour les mois clos ;
4. échanger les noms (`odds_snapshot` → `odds_snapshot_legacy`, la nouvelle prend le nom), recréer le déclencheur et les vues ;
5. contrôler (comptes par mois, clôtures identiques sur un échantillon, `odds_latest` inchangée), puis supprimer `odds_snapshot_legacy` après une semaine.

La migration Prisma ne contient que le schéma ; la copie est un script (`packages/db/scripts/partition-odds-snapshot.ts`) lancé par l'utilisateur, répété d'abord sur la copie locale. Durée mesurée sur la copie locale : voir § 7.

## 6. Ce qui ne change pas

Les écrans, le moteur, le règlement, le CLV et les coupons lisent les mêmes tables et vues, avec les mêmes lignes pour tout ce dont ils ont besoin. Les scripts d'étude qui lisent une cote à un instant précis ou tout l'historique passent par un lecteur commun (`packages/backtest-core`, `loadArchivedOdds`) qui interroge Parquet pour les mois archivés et la base pour le reste.

## 7. Mesures sur la copie locale (à compléter)

- Sélection des lignes gardées (règle § 3 hors ancres de coupon, négligeables) : **11,19 M lignes gardées sur 26,2 M (43 %), 15,0 M archivées (57 %)**, en 1 min 56 s. Plus que les 29 % de l'échantillon : la semaine en cours est gardée entière, et les deux définitions de la clôture le sont quand elles diffèrent.
- Place attendue : ~4 Go rendus sur 7,1 (lignes et index au prorata) ; archive Parquet ~270 Mo.
- Conversion complète (copie de 11,2 M lignes, index, échange) : estimée à une dizaine de minutes ; mesurée par le script de la ligne 2 avant toute fenêtre en prod.
- Croissance ensuite : ~43 % des ~4 M lignes hebdomadaires restent, soit ~0,45 Go par semaine au lieu de ~1, et rien ne s'accumule au-delà d'un mois clos.

## 8. Les lignes de travail (un commit chacune)

1. `feat(db): odds_snapshot partitioned by month` — migration du schéma, `@@id([id, snapshotAt])`, mises à jour par clé composée, tests du dépôt.
2. `feat(db): one-off partitioning script` — conversion, vérifications, mesurée sur la copie locale.
3. `feat(etl): monthly odds archive to Parquet on RustFS` — export DuckDB, vérification, compactage, échange, journal `odds_archive_month`, partitions à venir.
4. `feat(console): odds archive in Exploitation` — dernier mois archivé, taille, partition par défaut vide.
5. `feat(backtest): read archived odds` — lecteur commun base + Parquet, branché sur les scripts point-in-time et l'extraction ML.
6. `docs: exploitation — odds archive` — lancer la conversion, relire un mois, restaurer un mois depuis Parquet.

## 9. À décider

1. **Délai** : 7 jours après le match (proposé) — le règlement et le CLV sont faits bien avant.
2. **Rétention de l'archive** : tout garder (proposé ; ~1 Go par an au rythme actuel).
3. **Fenêtre de la conversion initiale** : de nuit, passes coupées ; durée au § 7.
