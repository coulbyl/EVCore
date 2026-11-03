# Archivage des cotes — `odds_snapshot` partitionnée, l'historique en Parquet

_Branche `feat/odds-archive`, depuis `main` (540283d7). Mesures sur la prod (tunnel en lecture seule, 03/11) et sur la copie locale du dump du 03/11 04:01. Décision du 03/11 : archiver plutôt que supprimer, des solutions durables (natives Postgres), pas de nouvelle base (Mongo écarté)._

## 1. Le constat

| Mesure                                                                                      | Valeur                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Taille de `odds_snapshot` en prod                                                           | 7,1 Go (3,3 Go de données, 3,8 Go d'index) sur une base de 9,2 Go ; 26,2 M lignes                                            |
| Croissance                                                                                  | ~4 M lignes par semaine depuis le 05/10 (0,7 M fin août), soit ~1 Go par semaine                                             |
| Lignes par match joué (300 matchs tirés au hasard, 60 derniers jours)                       | 5 509 : ~811 combinaisons bookmaker × marché × choix × ligne, relevées 6,8 fois chacune                                      |
| Âge des lignes (échantillon 0,5 %)                                                          | 85 % de matchs joués depuis plus de 7 jours, 14 % joués cette semaine, 1 % à venir                                           |
| Lignes gardées si l'on ne conserve qu'ouverture + clôture (`PREMATCH`) et tout `HISTORICAL` | 29 % (71 % archivables)                                                                                                      |
| Parquet (zstd)                                                                              | 18 octets par ligne, contre ~284 dans Postgres index compris : 16 fois moins ; une semaine (1,45 M lignes) exportée en 2,1 s |

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

- **`odds_snapshot` partitionnée par mois de `snapshotAt`** (`PARTITION BY RANGE`, migration `20261103120000`). Les clés uniques d'une table partitionnée incluent la clé de partition : la clé primaire devient `(id, snapshotAt)` (Prisma `@@id([id, snapshotAt])`) ; la clé unique `(fixtureId, bookmaker, market, pick, line, snapshotAt)` la contient déjà. Les six mises à jour par `id` de `fixture.repository.ts` passent à la clé composée (elles connaissent le `snapshotAt`). Le déclencheur `odds_latest` est posé sur la table mère, chaque partition en hérite ; les deux vues sont relues sur elle.
- **Archive** : un fichier Parquet (zstd) par mois, `odds_snapshot/AAAA-MM.parquet` dans le bucket `evcore-odds-archive` de RustFS. Le worker lit les lignes par un curseur Postgres (en texte), DuckDB (`@duckdb/node-api`, local, **sans extension**) les reçoit et écrit le fichier, le client S3 existant le dépose. Relu par DuckDB pour les études (`DuckDbOddsArchive`, `packages/backtest-core`).
- **Job quotidien** dans le worker (`OddsArchiveService`, file `odds-archive`, 03:30 UTC) :
  1. créer d'avance les partitions du mois en cours et des deux suivants (une partition par défaut existe, qui doit rester vide ; la console la surveille) ;
  2. pour chaque partition finie depuis 14 jours et absente du journal : exporter toutes ses lignes, mois par mois, dans **un seul instantané** en lecture seule (`REPEATABLE READ`) ; relire chaque fichier et comparer à la base : nombre de lignes, somme des `odds`, premier et dernier `snapshotAt` ; déposer, puis comparer la taille stockée ;
  3. construire à côté une table compacte avec les lignes gardées (règle § 3, plus toutes les lignes d'un match joué il y a moins de 7 jours), ses clés, ses index, sa clé étrangère et une contrainte de borne, pour que l'attachement ne relise rien ;
  4. dans une transaction courte : verrouiller la table mère, vérifier que la partition n'a pas bougé depuis l'export (nombre de lignes, dernière observation), détacher et supprimer l'ancienne, attacher la compacte sous le même nom, écrire le journal `odds_archive_month` (mois, fichier, octets, lignes avant et après, somme de contrôle). Un écart : rien n'est touché, la nuit suivante recommence ;
  5. un mois noté au journal n'est jamais refait.
- **Interrupteur** : la file est coupée avec les autres par « Passes planifiées » ; l'échange attend au plus 30 s son verrou.

## 5. La conversion initiale

Pas de recopie : la migration renomme l'ancienne table en `odds_snapshot_legacy`, passe sa clé primaire à `(id, snapshotAt)`, déplace les lignes de novembre (0,7 M sur la copie) dans leur partition, et l'attache comme partition de tout ce qui précède le 1er novembre 2026 ; ses index sont repris tels quels. **35 s sur la copie du 03/11**, dont 10 s pour l'index de la clé composée et 16 s pour novembre ; la table est verrouillée pendant ce temps (passes de cotes en attente). L'ancienne partition est archivée par le même job dès le 15/11, puis remplacée par `odds_snapshot_history`.

## 6. Ce qui ne change pas

Les écrans, le moteur, le règlement, le CLV et les coupons lisent les mêmes tables et vues, avec les mêmes lignes pour tout ce dont ils ont besoin. Les scripts d'étude qui lisent une cote à un instant précis passent par `PointInTimeLoader` (`packages/backtest-core`), qui fusionne la base et les fichiers Parquet ligne par ligne quand `ODDS_ARCHIVE_DIR` désigne une copie locale du bucket. L'extraction de l'`apps/ml-worker` (Python, non déployé depuis le 01/11) n'est pas branchée : à faire avec le lot ML v2.

## 7. Mesures sur la copie locale (dump du 03/11)

- **Migration** : 35 s, table verrouillée (index de la clé composée 10 s, déplacement de novembre 16 s, contrainte de borne 1 s, attachement 4 ms). Aucune dérive Prisma ; toutes les migrations passent sur une base vide.
- **Archive de l'ancienne partition** (passe simulée au 16/11) : 25,5 M lignes en 47 mois, exportées, relues et déposées en ~4 min 30 ; compactage ~4 min ; échange en moins d'une seconde. **8 min 40 au total.** 8,52 M lignes gardées (33 %), partition de 2,1 Go ; archive de **435 Mo** (17 octets par ligne).
- **Mêmes réponses avant et après**, sur les matchs du 01/10 au 20/10 (empreinte md5 de chaque lecture) : `odds_closing_line` (1 226 783 lignes), `odds_opening_line` (1 228 778), dernière cote par `snapshotAt` (1 228 856), cote connue à la publication des 17 989 couples coupon × prix : identiques.
- **Lecture d'étude** : un match d'octobre relu dans les fichiers, 9 047 lignes, autant qu'en base avant l'archive, en 89 ms.
- **Seconde passe** : rien à refaire (0 s). Passe simulée au 02/01/2027 : partitions de février et mars créées, novembre (0,7 M lignes) archivé en 12 s.
- **Croissance ensuite** : environ un tiers des ~4 M lignes hebdomadaires reste en base une fois le mois archivé, soit ~0,35 Go par semaine au lieu de ~1.

## 8. Les lignes de travail (un commit chacune)

1. `feat(db): odds_snapshot partitioned by month` — migration (conversion comprise, pas de script à part), `@@id([id, snapshotAt])`, mises à jour par clé composée, journal `odds_archive_month`.
2. `feat(etl): nightly odds archive to Parquet on RustFS` — `OddsArchiveService` : partitions d'avance, export DuckDB vérifié, compactage, échange.
3. `feat(console): odds archive in Exploitation` — la file, le dernier mois archivé, la taille de la table et de l'archive, la partition par défaut.
4. `feat(backtest): read archived odds` — `DuckDbOddsArchive` et `PointInTimeLoader`, branchés sur les trois scripts de rejeu (`ODDS_ARCHIVE_DIR`).
5. `docs: exploitation — odds archive`.

## 9. Décidé le 03/11

1. **Délai** : un mois est archivé 14 jours après sa fin ; les lignes d'un match joué il y a moins de 7 jours restent entières.
2. **Rétention de l'archive** : tout garder (~0,5 Go par an au rythme actuel).
3. **Conversion** : dans la migration, au déploiement, hors des passes du soir.
