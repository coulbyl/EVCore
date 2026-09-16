# Plan de rentabilité EVCore

> Document vivant. Source de vérité pour le chantier « devenir rentable ».
> Ouvert le 2026-09-15 après l'audit complet du moteur, des canaux, des
> championnats, des marchés et de l'ingestion.
>
> Conventions : `[ ]` à faire · `[x]` terminé · `[~]` en cours · `[-]` annulé.
> Chaque tâche porte un identifiant stable (`A-12`), une dépendance quand elle
> en a une, et un **critère d'acceptation mesurable**. Une tâche sans critère
> mesurable n'est pas une tâche, c'est une intention.

---

## 0. Constat — ce que l'audit a établi

Rapports sources, tous régénérables :

| Rapport                                                                | Commande                | Contenu                                                                 |
| ---------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| [LEAGUE-REPORT.md](audits/2026-09-15/LEAGUE-REPORT.md)                 | `report:league`         | 68 championnats, taux de base, calibration moteur, efficience du marché |
| [DAILY-COUPON-BACKTEST.md](audits/2026-09-15/DAILY-COUPON-BACKTEST.md) | `backtest:daily-coupon` | 1 267 jours, coupons jour par jour, arithmétique de la marge            |
| [GENERATOR.md](audits/2026-09-15/GENERATOR.md)                         | `backtest:generator`    | Générateur déterministe, sélection et validation                        |

### 0.1 Ce qui est fermé par la mesure

| Piste                                   | Verdict                     | Preuve                                                                                                                                               |
| --------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choisir le bon championnat              | **Fermée**                  | 255 cellules ligue × marché : 49,8 % battent l'implicite, 6 significatives pour 6,4 attendues par hasard, écart moyen +0,00 pt sur 220 204 issues    |
| Aller vers les marchés exotiques        | **Fermée**                  | ROI d'entrée : OVER_UNDER_HT −8,0 %, TEAM_TOTAL −16 à −19 %, HTFT −25,2 %, CORRECT_SCORE −55,9 %. 0 cellule significative sur 169 pour 4,2 attendues |
| Exploiter l'edge annoncé par le moteur  | **Fermée**                  | Le réalisé suit l'implicite, pas l'annoncé. Décile 10 : +23,4 pts d'edge annoncé, réalisé 37,8 % contre 40,5 % d'implicite                           |
| Le moteur discrimine à cote égale       | **Fermée**                  | Dans les 5 tranches de cote, le tercile de plus fort edge annoncé n'est jamais meilleur                                                              |
| Cote 5 rentable la plupart des semaines | **Impossible**              | Il faut 2 gagnants sur 7 ; P(≥2 \| p=0,20) = 42,3 % **même avec marge nulle**                                                                        |
| Mouvement de cote                       | **Sans signal exploitable** | Non monotone sur 5 735 rencontres ; la clôture reste le meilleur estimateur                                                                          |
| Portefeuille de favoris                 | **Négatif**                 | Tous les favoris qualifiés : ROI −0,22 % sur 2 074 paris                                                                                             |

### 0.2 Ce qui reste ouvert

| Levier                    | Mesure                                                                                                                                                                                                                                                      | Statut                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Biais favori/outsider     | +2,4 pts sous cote 1,25 → −1,7 pt au-delà de 8, monotone sur 285 758 jambes                                                                                                                                                                                 | **Réel, exploité partiellement**                                       |
| Marge payée vs disponible | Dépend fortement du championnat : sur 12 rencontres de grands championnats, 1xBet Match Winner est à **2,77 %** ; sur 40 rencontres tous championnats confondus, le moins cher est **Pinnacle Asian Handicap à 4,11 %** contre 4,52 % pour son Match Winner | **Partiellement exploité — gain réel plus étroit qu'estimé au départ** |
| Features point-in-time    | xG différentiel +1,8 pt, repos domicile +2,0 pt, répliqués sur les deux moitiés                                                                                                                                                                             | **Réel, sous le seuil de marge**                                       |
| Team news                 | Blessures réduites à un compteur, compositions jamais collectées                                                                                                                                                                                            | **Jamais testé, faute de données**                                     |

### 0.3 Le diagnostic

Le blocage n'est pas dans le modèle, il est dans **ce qu'on collecte et à quel
prix on parie**.

- L'API sert **33 books** et **338 types de paris**. L'ETL en stocke **4** et
  **~18**. Sur une rencontre réelle, 9 books cotent ; on en garde 4, et pas
  les moins chers.
- Le coût d'entrée dépend du championnat et du marché. Sur les grands
  championnats, des books non collectés descendent à 2,77 % ; tous
  championnats confondus, le plancher est l'**Asian Handicap de Pinnacle à
  4,11 %**, contre 4,52 % pour son Match Winner. Le gain est donc **réel mais
  étroit — de l'ordre de 0,4 point en moyenne, davantage sur les grands
  championnats** — et non les 1,8 point estimés sur le premier échantillon.
- Sans ligne de clôture, le **CLV** est incalculable — donc on ne peut valider
  une stratégie qu'en attendant des milliers de résultats, soit des années.
- Sans historique de blessures et de compositions, la principale source
  d'information publique du football nous est inaccessible.

---

## 1. Principes non négociables

Ces règles sont issues d'erreurs déjà commises et mesurées. Les enfreindre
recrée les mêmes illusions.

- `P-1` **Valider à la jambe, jamais au coupon.** À nos volumes l'erreur type
  d'un ROI de coupon se compte en dizaines de points, celle d'une jambe en
  unités.
- `P-2` **Déclarer le protocole avant de mesurer** : grille, critère, fenêtre
  de sélection, fenêtre de validation. Écrit dans le script, pas dans la tête.
- `P-3` **Dédupliquer `channel_selection`** avant toute statistique : une
  rencontre est ré-analysée 5 à 7 fois, chaque analyse réécrit une ligne.
  Sans `DISTINCT ON`, les erreurs types sont divisées par ~2,4.
- `P-4` **Exclure les analyses postérieures au coup d'envoi**
  (`analyzedAt < scheduledAt`) : ~48 000 lignes sont des rétro-analyses.
- `P-5` **Compter les faux positifs attendus.** Un balayage de N cellules en
  produit N × 2,5 % de significatives par hasard. Toujours afficher le compte
  attendu à côté du compte observé.
- `P-6` **Exiger la réplication sur deux fenêtres disjointes** avant de
  qualifier un signal.
- `P-7` **Le CLV prime sur le ROI** dès qu'il est disponible : il se mesure en
  semaines, le ROI en années.
- `P-8` **Ne jamais présenter comme rentable ce qui ne l'est pas.** Un
  intervalle de confiance qui contient zéro se dit.
- `P-9` **Toute cible de cote s'accompagne de son taux de jours perdants.**
  P(journée gagnante) ≤ 1 / cote combinée, c'est de l'arithmétique.
- `P-10` **Régler, pas désactiver.** Un canal qui perd est une configuration à
  recalibrer sur données, sauf preuve mesurée du contraire.

---

## Chantier A — Élargir l'ingestion des cotes

**Pourquoi** : récupérer de la marge sans modèle. Gain mesuré : ~0,4 point en
moyenne tous championnats, jusqu'à 1,8 point sur les grands championnats où
des books non collectés descendent à 2,77 %. Coût quota négligeable (plan Pro,
7 500 req/jour, ~1 600 utilisées).

> Révisé le 2026-09-15 après mesure sur 40 rencontres : le premier échantillon
> (12 rencontres, grands championnats) surestimait le gain moyen.

**Dépendances** : aucune. À faire en premier.

### A.1 Books

- [x] `A-1` Étendre `API_FOOTBALL_BOOKMAKERS` à 1xBet (11), Betano (32),
      William Hill (7), Betfair (3), BetVictor (36), SBO (5).
      _Fait 2026-09-15_ : 11 books, ids vérifiés contre le catalogue de l'API,
      test de régression sur le mapping.
- [x] `A-2` Vérifier la couverture réelle de chaque book ajouté.
      _Fait 2026-09-15_, 40 rencontres : Bet365 106 marchés, Betano 88,
      1xBet 83, Marathonbet 56, William Hill 48, Pinnacle 19, Betfair 17,
      BetVictor 14, SBO 13. Les six books ajoutés couvrent l'échantillon.
- [x] `A-3` Adapter `odds-prematch-sync.worker.ts` pour boucler sur tous les
      books configurés au lieu des books prioritaires.
      _Fait 2026-09-15_ : `ODDS_INGESTION_BOOKMAKER_IDS` devient la source
      unique, utilisée par `extractAllOneXTwoOdds` et par la boucle des
      marchés secondaires. Pinnacle reste le book primaire.
- [x] `A-3b` **Cloisonner le garde-fou de cohérence.** Sa médiane lisait tous
      les books stockés : élargir la collecte l'aurait déplacée, et avec elle
      du staking en production. Ajout de `COHERENCE_BOOKMAKERS` dans
      `ev.constants.ts`, figée sur les cinq books d'origine, appliquée en
      filtre dans `betting-engine.service.ts`.
      _Fait 2026-09-15_ : test de non-régression vérifiant que la liste du
      garde-fou n'hérite pas des books ajoutés. 730 tests backend au vert.
- [ ] `A-4` Mesurer le coût quota réel de l'élargissement sur 7 jours.
      _Acceptation_ : consommation quotidienne < 60 % du quota, tracée dans les logs.
- [ ] `A-5` Ajouter une alerte si un book cesse de répondre pendant > 48 h.
      _Acceptation_ : notification déclenchée en test d'intégration.
- [ ] `A-6` Indexer `odds_snapshot` sur `(fixtureId, market, pick, snapshotAt)`
      si le plan d'exécution le justifie après l'élargissement.
      _Acceptation_ : `EXPLAIN ANALYZE` de la requête de vivier sous 2 s.
- [~] `A-7` Documenter par book : marge moyenne, couverture, fraîcheur.
  _Partiel 2026-09-15_ : marge et couverture dans
  [MARKET-MARGINS.md](audits/2026-09-15/MARKET-MARGINS.md). La **fraîcheur**
  manque et dépend de `B-9`.

### A.2 Marchés

- [~] `A-8` Ajouter **Asian Handicap** (bet id 4) au schéma `Market` et à
  l'ingestion. Marge Pinnacle mesurée : 4,11 % sur 40 rencontres, entre
  2,6 % et 3,7 % selon la ligne, contre 4,52 % sur ONE*X_TWO.
  \_Code fait 2026-09-15*, migration en attente d'exécution :
  enum `Market` (domaine + Prisma), extraction, persistance, 7 tests.
  Convention de l'API vérifiée sur données réelles : les deux côtés d'un
  même handicap portent le **même signe** (« Home -0.5 » / « Away -0.5 ») ;
  l'appariement croisé produit des marges négatives, donc impossibles.
- [~] `A-9` Ajouter **Asian Handicap First Half** (19).
  _Code fait 2026-09-15_ avec `A-8`, même migration.
- [~] `A-10` Ajouter **Goals Over/Under Second Half** (26).
  _Code fait 2026-09-15_, marché `OVER_UNDER_2H`, migration en attente.
- [~] `A-11` Ajouter **Corners Over Under** (45) et **Total Corners (1st Half)**
  (77). _Code fait 2026-09-15_, marchés `CORNERS` et `CORNERS_HT`.
  Ces marchés cotent des lignes **entières** (« Over 9 ») : c'est le cas
  que l'encodage historique de la ligne dans `pick` ne savait pas
  représenter, et la justification directe de `A-16`.
- [~] `A-12` Ajouter **Cards Over/Under** (80).
  _Code fait 2026-09-15_, marché `CARDS`.
- [~] `A-13` Ajouter **Odd/Even** (21) et **Odd/Even First Half** (22).
  _Code fait 2026-09-15_, marchés `ODD_EVEN` et `ODD_EVEN_HT`.
- [~] `A-14` Ajouter **Highest Scoring Half** (11).
  _Code fait 2026-09-15_, marché `HIGHEST_SCORING_HALF`.
- [~] `A-15` Ajouter **Team To Score First** (14).
  _Code fait 2026-09-15_, marché `TEAM_TO_SCORE_FIRST`.
- [~] `A-16` Modéliser la **ligne** (handicap, total) comme colonne dédiée
  plutôt que suffixe de `pick`. Le parsing actuel (`right(pick, 3)`) est
  fragile et interdit les lignes à deux chiffres.
  _Partiel 2026-09-15_ : colonne `line Decimal?` créée et intégrée à la
  contrainte d'unicité — indispensable pour le handicap asiatique, où un
  même `pick` existe à plusieurs lignes. Les marchés antérieurs gardent
  leur ligne dans `pick` et `line` à NULL : **le backfill de cet héritage
  reste à faire**, il ne bloquait pas `A-8`.
- [~] `A-17` Normaliser le vocabulaire des `pick` par marché dans une table de
  correspondance testée, au lieu de chaînes libres.
  _Partiel 2026-09-15_ : `FIXED_OUTCOME_MAPPINGS` traduit les libellés de
  l'API vers le vocabulaire interne pour les quatre marchés à issues
  fixes, et **une issue inconnue est ignorée plutôt que stockée telle
  quelle** — un `pick` non reconnu polluerait durablement la base. Les
  marchés antérieurs ne sont pas encore couverts.
- [ ] `A-18` Écrire un validateur Zod par nouveau marché.
      _Acceptation_ : cas valide, invalide et limite pour chacun.
- [x] `A-19` Mesurer la marge de chaque nouveau marché sur 100 rencontres.
      _Fait 2026-09-15_ : [MARKET-MARGINS.md](audits/2026-09-15/MARKET-MARGINS.md),
      régénérable par `probe:margins`.
- [x] `A-20` Classer les marchés par marge croissante et documenter les trois
      moins chers comme cibles par défaut du sélecteur.
      _Fait 2026-09-15_, classement ci-dessous. **Pas de constante
      `PREFERRED_MARKETS` créée** : tant qu'aucun sélecteur ne la consomme, ce
      serait un réglage dormant. Elle naîtra avec `G-2`, alimentée par cette
      mesure.

### A.2.bis Ce que la mesure a tranché

Marge du book le moins cher, sur 100 rencontres tirées au hasard
(extrait — tableau complet dans
[MARKET-MARGINS.md](audits/2026-09-15/MARKET-MARGINS.md)) :

| Marché               | Book         | Marge      |
| -------------------- | ------------ | ---------- |
| Odd/Even             | SBO          | 3,81 %     |
| **Asian Handicap**   | **Pinnacle** | **4,26 %** |
| Goals Over/Under     | Pinnacle     | 4,63 %     |
| Match Winner         | Pinnacle     | 4,84 %     |
| …                    |              |            |
| Corners Over Under   | Pinnacle     | 6,58 %     |
| Both Teams Score     | Bet365       | 7,44 %     |
| Highest Scoring Half | Bet365       | 9,71 %     |
| Team To Score First  | Marathonbet  | 10,94 %    |

Trois enseignements, dont deux qui contredisent l'intuition de départ :

1. **L'Asian Handicap est bien la cible.** 4,26 % contre 4,84 % sur le Match
   Winner, sur 223 lignes. C'est le seul marché ajouté qui soit moins cher que
   l'existant.
2. **Les corners, cartons et marchés à issues fixes sont PLUS chers**, de
   6,4 % à 10,9 %. Ils ont été ajoutés pour compléter le périmètre de
   collecte, pas parce qu'ils sont jouables. Ne pas les cibler.
3. **Odd/Even est le moins cher (3,81 %) et inexploitable** : la parité du
   nombre de buts n'est pas prédictible. Une marge basse ne vaut rien sans
   information — le cas est instructif à garder en tête pour tout le plan.

Cibles par défaut retenues : **Asian Handicap, Goals Over/Under, Match
Winner, chez Pinnacle**.

### A.2.ter Volume — la mesure a imposé une correction de trajectoire

Vérification à blanc sur données réelles
(`pnpm --filter backend etl:dry-run-markets`, n'écrit rien en base) : la
collecte élargie produit **424 lignes par rencontre et par relevé**.

| Marché            | Lignes/match | Part |
| ----------------- | -----------: | ---: |
| ASIAN_HANDICAP    |          130 | 31 % |
| CORNERS           |           88 | 21 % |
| ASIAN_HANDICAP_HT |           71 | 17 % |
| OVER_UNDER_2H     |           48 | 11 % |
| CORNERS_HT        |           37 |  9 % |
| autres            |           50 | 11 % |

Projection à 200 rencontres par jour : **62 M de lignes par an** à la cadence
actuelle, **124 M** une fois le balayage de clôture du chantier B en place,
soit ~29 Go ajoutés contre 1,27 Go aujourd'hui.

Or 44 % de ce volume part dans des marchés que `A-19`/`A-20` viennent
d'écarter comme trop chers. D'où la règle adoptée :

- [x] `A-24` **Collecter large là où on peut parier, un seul book de
      référence là où on ne fait qu'étudier.** `REFERENCE_ONLY_MARKETS`
      (corners, cartons, second-half, marchés à issues fixes) n'est conservé
      que chez Pinnacle ; le handicap asiatique reste collecté chez les onze
      books, puisque c'est la cible et que le courtage y a du sens.
      _Fait 2026-09-15_, trois tests verrouillent la politique. Un marché sort
      de la liste dès qu'une mesure le rend jouable.

### A.3 Reprise historique

- [ ] `A-21` Évaluer la faisabilité d'un backfill des books manquants sur
      l'historique (l'API sert-elle les cotes passées ?).
      _Acceptation_ : réponse documentée oui/non avec profondeur disponible.
- [ ] `A-22` Si oui, backfill priorisé sur les championnats à fort volume.
      _Acceptation_ : couverture ≥ 70 % des rencontres 2025-2026 sur ≥ 6 books.
- [ ] `A-23` Si non, acter que la mesure d'edge ne commencera qu'à la date de
      bascule et planifier la fenêtre prospective en conséquence.
      _Acceptation_ : date de début de mesure écrite dans ce document.

---

## Chantier B — Cadence et ligne de clôture

**Pourquoi** : sans clôture, pas de CLV ; sans CLV, chaque validation coûte
des années. Aujourd'hui : 2 relevés/jour sur J+1..J+3, dernier relevé à 7,5 h
du coup d'envoi pour Pinnacle, **43 h pour Marathonbet et Unibet**.

**Dépendances** : `A-3`.

### B.0 Mesure de référence, avant tout changement

Sur les 30 derniers jours (`report:freshness`) :

| Book        | Relevés / rencontre | Dernier relevé (médiane) | Ligne de clôture |
| ----------- | ------------------: | -----------------------: | ---------------: |
| Bet365      |                 5,4 |                   23,7 h |        **0,0 %** |
| Pinnacle    |                 5,4 |                   24,2 h |        **0,0 %** |
| Marathonbet |                 5,6 |                   24,2 h |        **0,0 %** |
| Unibet      |                 4,4 |                   26,3 h |        **0,0 %** |

**Aucune rencontre, chez aucun book, n'a de relevé dans le dernier quart
d'heure.** Le CLV n'est donc pas seulement imprécis : il est impossible à
calculer. C'est la justification entière du chantier, et la mesure contre
laquelle son succès se jugera.

- [~] `B-1` Ajouter un balayage **T−60 min** sur les rencontres du jour.
  _Code fait 2026-09-15_ : mode `closing` du worker de cotes, cron
  `*/10 * * * *`, fenêtre `T-60` (50 à 65 min). Acceptation à vérifier sur
  données réelles après déploiement, via `report:freshness`.
- [~] `B-2` Ajouter un balayage **T−10 min** (ligne de clôture).
  _Code fait 2026-09-15_, fenêtre `T-10` (4 à 14 min). Les fenêtres sont
  plus larges que le pas du cron pour absorber un retard de file, et ne se
  chevauchent pas ; une rencontre tombant dans les deux n'est traitée
  qu'une fois.
- [~] `B-3` Marquer explicitement la clôture : colonne `isClosing Boolean` ou
  vue dédiée, plutôt que « dernier snapshot connu ».
  _Code fait 2026-09-15_ : vue `odds_closing_line`, migration
  `20260916000000_add_odds_line_views` **à enregistrer par `db:deploy`**.
  Une **vue** plutôt qu'une colonne : la clôture est une propriété dérivée
  (le dernier relevé d'avant coup d'envoi), et une colonne exigerait de
  réécrire la ligne précédente à chaque relevé sur une table de 5,5 M
  lignes, avec le risque qu'un échec laisse deux clôtures ou aucune. La
  vue ne peut pas se désynchroniser. Elle expose `hoursBeforeKickoff` :
  tout consommateur doit filtrer dessus, un dernier relevé à 24 h n'étant
  pas une clôture.
- [~] `B-4` Marquer l'ouverture (premier snapshot) de la même façon.
  _Code fait 2026-09-15_ : vue `odds_opening_line`, même migration.
- [ ] `B-5` Augmenter la densité intermédiaire : viser ≥ 5 snapshots par
      rencontre entre J−3 et le coup d'envoi.
      _Acceptation_ : médiane de snapshots/rencontre ≥ 5 sur 7 jours glissants.
- [~] `B-6` Stagger des appels pour rester sous le quota.
  _Code fait 2026-09-15_ — et la contrainte s'est révélée inverse de
  l'attendue. Au pic, **50 rencontres démarrent dans la même heure** ; à
  6 s par appel, la dernière du lot aurait été interrogée cinq minutes
  après la première, donc **après son coup d'envoi** pour la fenêtre
  T-10 : le prix stocké n'aurait pas été une cote de clôture.
  `ODDS_CLOSING_RATE_LIMIT_MS` descend à 1,5 s en mode clôture, et une
  garde ignore toute rencontre déjà commencée. Le quota reste large :
  ~400 appels/jour pour ce balayage sur 7 500.
- [x] `B-7` Alerte si le taux de clôture capturée passe sous 70 % un jour donné.
      _Fait 2026-09-15_, sous une forme plus directe que prévu : le balayage
      compte les rencontres qu'il atteint **après** leur coup d'envoi et alerte
      au-delà de 20 %. C'est le signal immédiat que le lot ne tient plus dans
      sa fenêtre, alors qu'un taux quotidien n'aurait remonté le problème que
      le lendemain. L'absence de clôture ne se voit pas dans les données : elle
      se confond avec un relevé simplement plus ancien.
- [x] `B-8` Corriger l'écart de fraîcheur entre books : aligner Marathonbet et
      Unibet sur la cadence de Pinnacle.
      _Résolu par construction 2026-09-15_ : le balayage interroge
      `/odds?fixture=X`, qui renvoie **tous les books d'un coup**. Il n'existe
      plus de cadence par book à aligner. L'écart mesuré (23,7 h à 26,3 h)
      venait de la couverture inégale des books sur l'horizon J+1..J+3, pas
      d'une planification distincte.
- [x] `B-9` Rapport de fraîcheur par book, régénérable.
      _Fait 2026-09-15_ : [ODDS-FRESHNESS.md](audits/2026-09-15/ODDS-FRESHNESS.md),
      `pnpm --filter @evcore/backtest-core report:freshness`.
- [ ] `B-10` Rejouer les analyses passées avec la notion de clôture pour
      quantifier la dérive ouverture → clôture par marché.
      _Acceptation_ : tableau marché × dérive moyenne, dans un rapport commité.

---

## Chantier C — Team news : blessures et compositions

**Pourquoi** : première source d'information publique du football, aujourd'hui
jetée. `/injuries` renvoie joueur, type et raison ; on n'en garde qu'un
compteur en shadow. `/fixtures/lineups` n'est jamais appelé.

**Dépendances** : aucune.

### C.1 Blessures

- [ ] `C-1` Créer la table `injury` : `fixtureId`, `teamId`, `playerId`,
      `playerName`, `type`, `reason`, `observedAt`.
      _Acceptation_ : migration Prisma + repository dédié.
- [ ] `C-2` Historiser chaque observation (append-only), ne jamais écraser :
      l'information « qui était annoncé absent et quand » est le signal.
      _Acceptation_ : contrainte d'unicité sur `(fixtureId, playerId, observedAt)`.
- [ ] `C-3` Réécrire `injuries-sync.worker.ts` pour persister au lieu de compter.
      _Acceptation_ : une rencontre PL produit ≥ 10 lignes `injury`.
- [ ] `C-4` Conserver le compteur shadow existant le temps de la bascule.
      _Acceptation_ : les deux coexistent pendant ≥ 2 semaines.
- [ ] `C-5` Créer la table `player` (id API, nom, poste, équipe courante).
      _Acceptation_ : migration + sync initiale sur les championnats actifs.
- [ ] `C-6` Ajouter l'importance du joueur : minutes jouées sur N derniers
      matchs, part des buts et passes décisives de l'équipe.
      _Acceptation_ : colonne calculée point-in-time, testée sans fuite.
- [ ] `C-7` Pondérer les absences par importance plutôt que les compter.
      _Acceptation_ : feature `weightedAbsences` disponible en point-in-time.
- [ ] `C-8` Cadence : sync blessures à J−1, T−4 h et T−1 h.
      _Acceptation_ : ≥ 3 observations par rencontre analysée.
- [ ] `C-9` Mesurer la couverture réelle par championnat.
      _Acceptation_ : tableau ligue × taux de rencontres avec ≥ 1 blessure connue.
- [ ] `C-10` Alerter sur les championnats sans aucune donnée de blessure.
      _Acceptation_ : liste explicite dans le rapport de couverture.

### C.2 Compositions

- [ ] `C-11` Créer les tables `lineup` et `lineup_player`.
      _Acceptation_ : migration + repository.
- [ ] `C-12` Nouveau worker `lineups-sync` appelant `/fixtures/lineups`.
      _Acceptation_ : formation, XI et remplaçants persistés pour une rencontre test.
- [ ] `C-13` Cadence : T−45 min, puis re-tentative à T−20 min si absent.
      _Acceptation_ : ≥ 70 % des rencontres analysées ont une compo avant le coup d'envoi.
- [ ] `C-14` Historiser la formation annoncée (4-2-3-1, etc.).
      _Acceptation_ : colonne `formation` renseignée.
- [ ] `C-15` Feature « titulaires habituels absents » : intersection entre le
      XI annoncé et le XI moyen des 5 derniers matchs.
      _Acceptation_ : feature point-in-time, testée sans fuite.
- [ ] `C-16` Feature « rotation » : nombre de changements par rapport au
      dernier XI.
      _Acceptation_ : idem.
- [ ] `C-17` Mesurer l'effet des compositions sur le résidu de marché, par
      tranche de cote, avec réplication.
      _Acceptation_ : rapport dédié, protocole `P-2` respecté.

### C.3 Validation du chantier

- [ ] `C-18` Backtest des absences pondérées contre la clôture Pinnacle.
      _Acceptation_ : CLV mesuré, positif ou négatif, avec intervalle.
- [ ] `C-19` Si l'effet est réel, le formaliser en signal ; sinon l'acter comme
      fermé dans ce document.
      _Acceptation_ : décision écrite, datée, avec la mesure.

---

## Chantier D — Statistiques de match et features

**Pourquoi** : on ne dispose que de l'xG. `/fixtures/statistics` sert 16 types
(tirs cadrés, tirs dans et hors surface, possession, corners, cartons, arrêts,
passes) et n'est jamais appelé.

**Dépendances** : aucune.

- [ ] `D-1` Créer la table `fixture_statistic` (`fixtureId`, `teamId`, `type`,
      `value`).
      _Acceptation_ : migration + repository.
- [ ] `D-2` Worker `fixture-statistics-sync` post-match.
      _Acceptation_ : 16 types persistés sur une rencontre test.
- [ ] `D-3` Backfill sur les 3 dernières saisons des championnats actifs.
      _Acceptation_ : couverture ≥ 80 % des rencontres terminées.
- [ ] `D-4` Features glissantes point-in-time : tirs cadrés pour/contre,
      tirs dans la surface, possession, corners, cartons.
      _Acceptation_ : fenêtres excluant la rencontre courante, testées.
- [ ] `D-5` Feature « qualité de finition » : buts moins xG sur 10 matchs.
      _Acceptation_ : disponible et testée.
- [ ] `D-6` Feature « domination sans conversion » : tirs cadrés élevés et
      buts faibles.
      _Acceptation_ : idem.
- [ ] `D-7` Feature « discipline » : cartons et fautes glissants, pour les
      marchés cartons.
      _Acceptation_ : idem.
- [ ] `D-8` Feature « style » : corners concédés et obtenus, pour les marchés
      corners.
      _Acceptation_ : idem.
- [ ] `D-9` Étendre `09-fixture-features.sql` à toutes les nouvelles features.
      _Acceptation_ : le jeu de features couvre ≥ 30 variables point-in-time.
- [ ] `D-10` Rejouer le balayage feature × marché avec le protocole `P-2`,
      `P-5` et `P-6`.
      _Acceptation_ : rapport listant, pour chaque feature, l'écart au résidu,
      le compte de significatives et le compte attendu par hasard.
- [ ] `D-11` Documenter les features fermées pour ne pas les retester.
      _Acceptation_ : section « fermé » dans ce document.
- [ ] `D-12` Vérifier l'absence de fuite : toute feature doit être calculable
      avec les seules données antérieures au coup d'envoi.
      _Acceptation_ : test automatisé sur un échantillon aléatoire.

---

## Chantier E — Infrastructure de mesure

**Pourquoi** : c'est ce qui permet de trancher en semaines au lieu d'années.
Aujourd'hui inexistant.

**Dépendances** : `B-3`.

- [x] `E-1` Définir le CLV, marge retirée des deux côtés.
      _Fait 2026-09-15_ : `closingLineValue` dans
      `packages/analysis-core/src/pricing/closing-line-value.ts`, 9 tests.
      Formule retenue : **cote obtenue × probabilité de clôture − 1**, et non
      un rapport de cotes brutes — elle est ainsi homogène à une espérance de
      gain (un CLV de +2 % annonce +2 % de ROI si la clôture est calibrée).
      La normalisation des deux côtés est indispensable : comparer deux cotes
      brutes mesurerait surtout l'écart de marge entre books. La fonction
      **retourne `null` plutôt qu'une valeur approchée** sur un groupe de choix
      incomplet — un CLV faux dans un indicateur de décision est pire qu'un
      silence.
- [ ] `E-2` Enregistrer le CLV de chaque sélection à la clôture.
      _Acceptation_ : colonne peuplée pour ≥ 80 % des sélections.
- [ ] `E-3` Tableau de bord CLV par canal, marché, championnat, book.
      _Acceptation_ : rapport régénérable.
- [ ] `E-4` Seuil de décision : un canal dont le CLV est négatif sur 500
      sélections est suspendu.
      _Acceptation_ : règle écrite, constante en config, testée.
- [ ] `E-5` Comptabilité de la marge : pour chaque pari, marge payée sur la
      ligne effectivement prise.
      _Acceptation_ : colonne `marginPaid` renseignée.
- [ ] `E-6` Rapport « marge payée vs marge minimale disponible » par jour.
      _Acceptation_ : écart quotidien mesuré, cible < 0,5 point.
- [ ] `E-7` Attribution : décomposer le résultat en biais favori, signal
      modèle, courtage, chance.
      _Acceptation_ : décomposition qui somme au ROI observé, à 0,1 point près.
- [~] `E-8` Généraliser la déduplication `P-3` dans une vue SQL unique.
  _Code fait 2026-09-15_ : vue `channel_selection_deduped`, migration
  `20260916010000` **à enregistrer par `db:deploy`**. Elle applique les deux
  filtres d'un coup — dernière analyse d'avant coup d'envoi, et exclusion
  des rétro-analyses. Reste à basculer les rapports existants dessus.
- [ ] `E-9` Test de non-régression sur la déduplication.
      _Acceptation_ : test qui échoue si un rapport compte les doublons.
- [ ] `E-10` Harnais de backtest rejouant le pipeline courant sur l'historique,
      jamais les décisions enregistrées.
      _Acceptation_ : `backtest-core` rejoue le moteur, pas la base.
- [~] `E-11` Protocole de validation standardisé : grille, critère, sélection,
  validation, tous déclarés dans le script.
  _Code fait 2026-09-15_ : `runValidationProtocol` dans
  `packages/backtest-core/src/validation-protocol.ts`, 7 tests. La grille
  et le critère sont des **paramètres**, donc figés avant exécution ; la
  fenêtre de validation n'est évaluée qu'une fois, ce qu'un test vérifie.
  Le résultat expose `falsePositivesExpected` — à afficher à côté de tout
  décompte de gagnants, sans quoi un lecteur croit à un signal là où il y
  a du tirage. **Reste à basculer les scripts existants dessus.**
- [x] `E-12` Journal des expériences.
      _Fait 2026-09-15_ : [journal-experiences.md](journal-experiences.md),
      12 pistes documentées avec leur verdict et ce qui les rouvrirait.
      Quatre verdicts distincts — fermée, impossible, sans signal, ouvert —
      parce que « mesuré négatif » et « écarté par l'arithmétique » n'appellent
      pas la même conduite.

---

## Chantier F — Modèle

**Pourquoi** : aujourd'hui la probabilité du moteur recopie le prix. Elle ne
discrimine pas à cote égale. Tant que c'est vrai, aucun générateur ne peut
gagner.

**Dépendances** : `C`, `D`, `E`.

- [ ] `F-1` Établir la référence : Brier du marché (clôture Pinnacle) par
      marché et par championnat.
      _Acceptation_ : tableau de référence commité.
- [ ] `F-2` Mesurer le Brier du moteur contre cette référence.
      _Acceptation_ : écart chiffré, par marché.
- [ ] `F-3` Objectif explicite : battre le Brier du marché, pas celui du hasard.
      _Acceptation_ : critère écrit dans la config de calibration.
- [ ] `F-4` Recalibrer les probabilités du moteur sur la clôture plutôt que sur
      les résultats seuls.
      _Acceptation_ : Brier calibré ≤ Brier marché sur la fenêtre de validation.
- [ ] `F-5` Modèle résiduel : prédire l'écart entre réalisé et implicite plutôt
      que la probabilité absolue. C'est la seule cible qui a du sens.
      _Acceptation_ : prototype entraîné, évalué en validation.
- [ ] `F-6` Intégrer les features team news au modèle résiduel.
      _Acceptation_ : gain de Brier mesuré, positif ou nul, documenté.
- [ ] `F-7` Intégrer les features statistiques de match.
      _Acceptation_ : idem.
- [ ] `F-8` Régularisation et sélection de variables avec validation croisée
      temporelle (jamais aléatoire).
      _Acceptation_ : découpage chronologique vérifié par test.
- [ ] `F-9` Calibration isotonique ou Platt par marché, ajustée sur la fenêtre
      de sélection uniquement.
      _Acceptation_ : courbe de fiabilité commitée.
- [ ] `F-10` Vérifier la stabilité inter-saisons du modèle résiduel.
      _Acceptation_ : performance sur saison retenue hors échantillon.
- [ ] `F-11` Retirer du scoring toute feature dont l'apport n'est pas répliqué.
      _Acceptation_ : liste des features retenues justifiée une à une.
- [ ] `F-12` Documenter le modèle : entrées, sorties, hypothèses, limites.
      _Acceptation_ : section dédiée dans `docs/`.
- [ ] `F-13` Si après `F-6` et `F-7` le modèle ne bat pas le marché, acter que
      la voie « battre le prix par le modèle » est fermée et se concentrer sur
      le courtage (chantier A) et l'exécution (chantier I).
      _Acceptation_ : décision écrite, datée, avec les mesures.

---

## Chantier G — Sélection et composition

**Pourquoi** : une fois l'edge par jambe établi, la composition n'est plus
qu'un problème d'arithmétique — mais elle doit être faite correctement.

**Dépendances** : `E`, `F`.

- [ ] `G-1` Câbler le biais favori dans le sélecteur comme contrainte
      explicite, pas comme effet de bord.
      _Acceptation_ : constante de bande en config, justifiée par la mesure.
- [ ] `G-2` Interdire par défaut les marchés dont la marge dépasse un plafond
      configuré.
      _Acceptation_ : constante `MAX_MARKET_MARGIN`, testée.
- [ ] `G-3` Choisir systématiquement le book au meilleur prix parmi ceux
      accessibles.
      _Acceptation_ : le pari enregistré porte le book et la cote retenus.
- [ ] `G-4` Règle du nombre de jambes : le minimum qui atteint la cote cible,
      sauf démonstration contraire par la mesure.
      _Acceptation_ : règle en config, justifiée.
- [ ] `G-5` Anti-corrélation : jamais deux jambes du même match, ni deux
      jambes dont les issues dépendent du même événement.
      _Acceptation_ : test unitaire sur cas connus.
- [ ] `G-6` Abstention explicite quand aucun candidat ne franchit le seuil
      d'edge.
      _Acceptation_ : taux d'abstention mesuré et documenté.
- [ ] `G-7` Mesurer l'apport réel de l'abstention (variance, espérance).
      _Acceptation_ : comparaison chiffrée avec et sans.
- [ ] `G-8` Diversification : tester le portefeuille multi-paris une fois
      l'edge par jambe établi — il est perdant tant qu'il ne l'est pas.
      _Acceptation_ : protocole `P-2`, verdict chiffré.
- [ ] `G-9` Documenter pour chaque cible de cote le taux de jours et de
      semaines gagnants associé.
      _Acceptation_ : tableau de correspondance dans ce document.
- [ ] `G-10` Interdire toute règle de sélection fondée sur l'edge annoncé tant
      que `F-5` n'est pas validé.
      _Acceptation_ : garde dans le code + test.

---

## Chantier H — Staking et bankroll

**Pourquoi** : à edge égal, la mise détermine la survie. Aujourd'hui aucune
règle.

**Dépendances** : `E-1`, edge établi.

- [ ] `H-1` Définir la bankroll de référence et sa politique de réapprovisionnement.
      _Acceptation_ : montants écrits, validés par le propriétaire.
- [ ] `H-2` Mise plate par défaut, exprimée en pourcentage de bankroll.
      _Acceptation_ : constante en config.
- [ ] `H-3` Simuler le drawdown attendu par configuration.
      _Acceptation_ : tableau cote × drawdown à 95 % sur l'historique.
- [ ] `H-4` Dimensionner la bankroll pour absorber le pire creux observé
      multiplié par une marge de sécurité.
      _Acceptation_ : règle chiffrée et justifiée.
- [ ] `H-5` Kelly fractionné : à n'introduire qu'après validation de l'edge et
      derrière le flag de phase produit existant.
      _Acceptation_ : flag respecté, jamais activé sans edge mesuré.
- [ ] `H-6` Plafond d'exposition par journée et par championnat.
      _Acceptation_ : constantes en config, testées.
- [ ] `H-7` Arrêt automatique sur drawdown : suspension au-delà d'un seuil.
      _Acceptation_ : règle testée, réactivation humaine obligatoire.
- [ ] `H-8` Comptabilité réelle : chaque pari placé, sa mise, son book, son
      résultat.
      _Acceptation_ : réconciliation possible à l'unité près.

---

## Chantier I — Exécution et produit

**Pourquoi** : un edge de 2 % disparaît si l'on parie 3 heures trop tard ou au
mauvais book.

**Dépendances** : `A`, `B`, `G`.

- [ ] `I-1` Fenêtre de placement recommandée par marché, déduite de la dérive
      ouverture → clôture (`B-10`).
      _Acceptation_ : recommandation chiffrée par marché.
- [ ] `I-2` Afficher le book et la cote cible sur chaque sélection.
      _Acceptation_ : visible dans l'interface.
- [ ] `I-3` Afficher la marge payée et la marge minimale disponible.
      _Acceptation_ : idem.
- [ ] `I-4` Alerter quand la cote disponible s'écarte de la cote analysée.
      _Acceptation_ : seuil configurable, notification testée.
- [ ] `I-5` Historiser la cote réellement obtenue, distincte de la cote
      analysée.
      _Acceptation_ : deux colonnes, jamais confondues.
- [ ] `I-6` Mesurer l'écart entre cote analysée et cote obtenue sur 4 semaines.
      _Acceptation_ : écart médian chiffré.
- [ ] `I-7` Documenter les contraintes d'accès aux books (limites de mise,
      disponibilité géographique).
      _Acceptation_ : tableau par book, tenu à jour.
- [ ] `I-8` Communiquer honnêtement la performance : taux de jours gagnants,
      séries perdantes, intervalle du ROI.
      _Acceptation_ : aucun chiffre présenté sans son incertitude.

---

## Chantier J — Gouvernance et garde-fous

**Dépendances** : transverse.

- [x] `J-1` Câbler la suspension automatique de marché (ROI < −15 % sur 50+
      paris) documentée mais jamais invoquée.
      _Fait 2026-09-15_ : `RiskService.checkAllMarkets`, déclenché par un cron
      quotidien à 07:45 UTC sur la file de règlement des paris. `RiskModule`
      exportait `RiskService` depuis toujours, mais aucun module ne l'importait
      côté ETL — d'où un garde-fou atteignable seulement par un appel HTTP
      manuel.
      **Portée mesurée avant câblage** : un seul marché franchit le seuil
      aujourd'hui, `RESULT_TOTAL_GOALS` à −32,4 % sur 50 paris. Trois autres
      déclencheront l'alerte à −10 % (CLEAN_SHEET_HOME −14,5 %,
      FIRST_HALF_WINNER −13,3 %, OVER_UNDER_HT −12,0 %). Cadence quotidienne
      et non semi-horaire parce que les alertes sont réémises à chaque
      passage.
- [ ] `J-2` Revue hebdomadaire du CLV par canal.
      _Acceptation_ : rapport automatique.
- [ ] `J-3` Revue mensuelle des pistes fermées, pour éviter les retests.
      _Acceptation_ : journal `E-12` relu et daté.
- [ ] `J-4` Fenêtre prospective obligatoire avant toute mise en production
      d'une règle de sélection.
      _Acceptation_ : durée minimale écrite, respectée.
- [ ] `J-5` Interdire la promotion d'une règle sur la seule fenêtre qui a servi
      à la choisir.
      _Acceptation_ : garde dans le protocole `E-11`.
- [ ] `J-6` Toute décision de mise en production est écrite, datée et signée
      dans ce document.
      _Acceptation_ : section « décisions » tenue à jour.

---

## Chantier K — Dette et corrections identifiées

Trouvées pendant l'audit, à traiter indépendamment.

- [ ] `K-1` Doublons `channel_selection` : documenter dans le schéma Prisma que
      chaque ré-analyse crée une ligne, et exposer la vue dédupliquée.
      _Acceptation_ : commentaire + vue + test.
- [ ] `K-2` `standing` n'a pas d'historique (`syncedAt` écrasé) : soit
      l'historiser, soit documenter qu'elle est inutilisable en backtest.
      _Acceptation_ : décision écrite et appliquée.
- [ ] `K-3` Parsing de ligne par suffixe de `pick` : remplacer par `A-16`.
- [ ] `K-4` `injuries-sync` : compteur shadow à retirer après `C-3`.
- [ ] `K-5` Rétro-analyses du 2026-06-30 sur matchs joués : les marquer
      explicitement en base pour qu'aucune requête ne les compte par erreur.
      _Acceptation_ : colonne ou vue d'exclusion.
- [ ] `K-6` Documenter le trou de couverture des cotes historiques par
      championnat.
      _Acceptation_ : tableau ligue × profondeur de cotes.
- [ ] `K-7` Nettoyer les scripts de backtest obsolètes après convergence.
      _Acceptation_ : un seul harnais, documenté.

---

## Ordre d'exécution recommandé

1. **A** (books et marchés) — gain immédiat et mesurable, aucune dépendance.
2. **B** (clôture) — débloque la mesure rapide.
3. **E** (CLV et protocole) — sans quoi rien ne se valide.
4. **C** et **D** en parallèle (team news, statistiques) — nourrissent le modèle.
5. **F** (modèle résiduel) — le seul endroit où un vrai edge peut naître.
6. **G**, **H**, **I** — exploitation, une fois l'edge établi.
7. **J**, **K** en continu.

## Point de décision

À l'issue de **A + B + E**, on saura mesurer le CLV. Si après **C + D + F** le
CLV reste nul, la voie « battre le marché » sera fermée avec preuve, et il
faudra décider si EVCore reste un produit de pari ou devient autre chose.

Ce point de décision doit être daté dès que **A** démarre.

---

## Migrations à exécuter

| Migration                                           | Contenu                                                                                                                                    | Précaution                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20260915220000_add_asian_handicap_and_line`        | Enum `ASIAN_HANDICAP` / `ASIAN_HANDICAP_HT`, colonne `line`, contrainte d'unicité reconstruite avec la ligne                               | `odds_snapshot` fait 5,5 M lignes pour 1,27 Go. La reconstruction de la contrainte prend de l'ordre de la minute sous `ACCESS EXCLUSIVE LOCK` : **à lancer hors fenêtre d'ingestion de cotes**.  |
| `20260916010000_add_channel_selection_deduped_view` | Vue `channel_selection_deduped`                                                                                                            | Vue seule, aucune donnée touchée.                                                                                                                                                                |
| `20260916000000_add_odds_line_views`                | Vues `odds_closing_line` et `odds_opening_line`                                                                                            | Idempotente (`CREATE OR REPLACE VIEW`). **Déjà appliquée à la main en base le 2026-09-15 mais non enregistrée par Prisma** : `db:deploy` la rejouera sans effet et l'inscrira dans l'historique. |
| `20260915230000_add_corner_card_and_fixed_markets`  | Huit marchés : `OVER_UNDER_2H`, `CORNERS`, `CORNERS_HT`, `CARDS`, `ODD_EVEN`, `ODD_EVEN_HT`, `HIGHEST_SCORING_HALF`, `TEAM_TO_SCORE_FIRST` | Ajout de valeurs d'enum uniquement : ni réécriture de table, ni reconstruction d'index.                                                                                                          |

```bash
pnpm --filter @evcore/db exec prisma migrate deploy
```

## Décisions

_(à remplir : une ligne par décision de mise en production, datée.)_

## Pistes fermées

_(à remplir depuis le journal `E-12`, pour ne jamais les retester.)_
