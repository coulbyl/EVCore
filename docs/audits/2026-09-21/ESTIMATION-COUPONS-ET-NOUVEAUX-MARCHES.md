# Estimation des coupons et état des nouveaux marchés

Date de l'audit : **2026-09-21**  
Source des mesures : copie locale de la production synchronisée jusqu'au
**2026-09-21 16:40:48**.

État de l'implémentation décrit à la fin du document : **code terminé et
validé localement ; migration et backfill signalés comme exécutés localement
par l'opérateur le 2026-09-21**. Les contrôles de couverture du runbook restent
la source de vérité pour valider le contenu effectivement récupéré.

## Résumé exécutif

Deux problèmes distincts ne doivent pas être confondus :

1. **Collecter un marché** signifie conserver ses cotes avant le match.
2. **Exploiter un marché** exige aussi un modèle de probabilité, un règlement,
   un backtest point-in-time, une calibration et son admission dans les
   sélections et coupons.

La collecte étendue fonctionne réellement pour cinq marchés :

- handicap asiatique plein match ;
- handicap asiatique première mi-temps ;
- corners plein match ;
- corners première mi-temps ;
- cartons.

Elle ne produit encore aucune donnée pour cinq autres marchés pourtant présents
dans le schéma et le parseur : `OVER_UNDER_2H`, `ODD_EVEN`, `ODD_EVEN_HT`,
`HIGHEST_SCORING_HALF` et `TEAM_TO_SCORE_FIRST`.

Dans la sauvegarde auditée, les **tirs** ne sont ni un marché de cote défini
dans `Market`, ni une statistique persistée. Les tirs cadrés reçus par le worker
de statistiques y sont uniquement lus en mémoire comme repli pour calculer
`xG = tirs cadrés × 0,4`, puis la valeur brute et sa provenance sont perdues.
La correction implémentée dans ce chantier est détaillée en section 8.

Enfin, aucun des nouveaux marchés n'a encore produit de `channel_selection` ou
de jambe de coupon. À ce jour, ils constituent un carnet de prix, pas une
nouvelle source de prédictions.

## 1. Ce qu'exige une estimation de coupon suffisamment précise

### 1.1 La cible réaliste

Le système ne pourra jamais identifier avec certitude quatre ou cinq gagnants.
Il doit estimer correctement leur probabilité et, surtout, refuser de composer
quand l'incertitude est trop grande.

Avec un taux réel de réussite de 61,5 % par jambe, mesuré sur les 13 jambes des
coupons du 18 au 20 septembre :

- quatre jambes ont environ `0,615^4 = 14,3 %` de chances de toutes gagner ;
- cinq jambes ont environ `0,615^5 = 8,8 %` de chances de toutes gagner.

Pour qu'un coupon de quatre jambes gagne 30 % du temps, chacune doit réellement
être correcte environ 74 % du temps. Avec cinq jambes, il faut environ 79 % par
jambe. À des cotes proches de 1,50, cela exigerait un avantage considérable et
répété face au marché.

### 1.2 Les briques nécessaires

Le pipeline cible est le suivant :

```text
cote sans marge
    + signaux disponibles avant le match
    + désaccords entre modèles
    + contexte du championnat
    ↓
probabilité hors échantillon
    ↓
calibration hiérarchique canal × marché × cote × championnat
    ↓
intervalle d'incertitude et pénalité de sélection
    ↓
probabilité conjointe corrigée des dépendances
    ↓
coupon ou refus
```

Il faut concrètement :

1. **Un benchmark marché.** Comparer toute probabilité au prix sans marge du
   bookmaker et à la cote de clôture.
2. **Un signal incrémental.** Prouver en walk-forward que les données du moteur
   améliorent Brier ou log-loss par rapport au marché seul.
3. **Une calibration hiérarchique.** Utiliser le championnat seulement avec
   shrinkage vers `marché × tranche de cote`, puis canal et population globale.
4. **Une mesure des désaccords.** Transformer les contradictions Vantage/moteur
   en variables structurées, puis mesurer leur valeur hors échantillon.
5. **Une estimation de dépendance.** Ne pas supposer automatiquement
   indépendantes les erreurs de rencontres d'un même championnat ou d'un même
   scénario footballistique.
6. **Une borne prudente.** Composer à partir d'une borne basse de probabilité,
   pas du seul point estimé.
7. **Une abstention forte.** Refuser le coupon si son retour prudent ne dépasse
   pas 1 avec une marge de sécurité mesurée.

### 1.3 Rôle du championnat

Le championnat peut servir de modificateur ou de motif de quarantaine, pas de
liste blanche obtenue après quelques résultats. La mesure déjà inscrite dans le
compositeur montre une corrélation de seulement **-0,022** entre les performances
`championnat × marché` de deux périodes. Ces cellules ne persistent donc pas
assez pour être utilisées sans régularisation.

Une cellule locale doit être ramenée vers un niveau plus général quand son
échantillon est faible :

```text
championnat × marché × cote
        ↓ shrinkage
marché × cote
        ↓
canal
        ↓
population générale
```

Ordres de grandeur indicatifs : moins de 100 observations est très fragile ;
300 reste approximatif ; environ 800 à 1 000 observations sont nécessaires
pour séparer proprement des taux proches comme 72 % et 75 %.

## 2. État de la migration et du schéma

La migration `20260915220000_add_asian_handicap_and_line` est appliquée dans la
copie de production.

L'enum `Market` contient bien les dix nouveaux marchés audités :

```text
ASIAN_HANDICAP       ASIAN_HANDICAP_HT
OVER_UNDER_2H        CORNERS
CORNERS_HT           CARDS
ODD_EVEN             ODD_EVEN_HT
HIGHEST_SCORING_HALF TEAM_TO_SCORE_FIRST
```

La colonne `odds_snapshot.line` est présente et utilisée pour les handicaps et
les totaux. La contrainte d'unicité inclut la ligne, ce qui permet de conserver
plusieurs handicaps ou totaux sur une même rencontre.

## 3. Ce qui est effectivement collecté

### 3.1 Volumes cumulés dans la copie de production

| Marché | Lignes | Rencontres | Books | Premier snapshot | Dernier snapshot |
| --- | ---: | ---: | ---: | --- | --- |
| `ASIAN_HANDICAP` | 346 139 | 475 | 8 | 2026-09-13 14:39 | 2026-09-21 12:00 |
| `ASIAN_HANDICAP_HT` | 191 809 | 475 | 7 | 2026-09-14 16:38 | 2026-09-21 12:00 |
| `CORNERS` | 14 164 | 445 | 1 | 2026-09-16 02:15 | 2026-09-21 12:00 |
| `CORNERS_HT` | 8 412 | 445 | 1 | 2026-09-16 02:15 | 2026-09-21 12:00 |
| `CARDS` | 3 210 | 114 | 1 | 2026-09-16 12:43 | 2026-09-20 20:01 |
| `OVER_UNDER_2H` | 0 | 0 | 0 | — | — |
| `ODD_EVEN` | 0 | 0 | 0 | — | — |
| `ODD_EVEN_HT` | 0 | 0 | 0 | — | — |
| `HIGHEST_SCORING_HALF` | 0 | 0 | 0 | — | — |
| `TEAM_TO_SCORE_FIRST` | 0 | 0 | 0 | — | — |

Les marchés de corners, cartons et autres marchés exploratoires sont
volontairement limités à Pinnacle par `REFERENCE_ONLY_MARKETS`. Le handicap
asiatique reste multi-books car il est la cible potentiellement jouable.

### 3.2 Couverture face au 1X2

Depuis le 16 septembre, 481 rencontres possèdent au moins un snapshot 1X2.

| Marché | Rencontres couvertes | Couverture relative |
| --- | ---: | ---: |
| Handicap asiatique | 475 | 98,8 % |
| Handicap asiatique MT | 475 | 98,8 % |
| Corners | 445 | 92,5 % |
| Corners MT | 445 | 92,5 % |
| Cartons | 114 | 23,7 % |
| Chacun des cinq marchés absents | 0 | 0 % |

La couverture varie selon le championnat :

- AH atteint généralement 100 % dans les compétitions observées ; La Liga est
  à 80 %, Liga MX à 90 % et Super League suisse à 75 % sur cette petite fenêtre.
- Les corners sont complets dans beaucoup de ligues, mais absents notamment en
  `SRB1`, `EST1` et `LAT1`, et presque absents en Nations League.
- Les cartons sont surtout présents dans les grandes ligues et quelques
  compétitions : PL, Ligue 1, Serie A, Bundesliga, Championship, UEL, MLS,
  Brasileirão et quelques ligues espagnoles. Ils sont absents de la majorité
  des divisions secondaires.

Cette couverture championnat doit être mesurée avant tout entraînement : un
modèle de cartons global aurait sinon une population fortement sélectionnée.

### 3.3 Contrôles d'intégrité

| Marché | Paires de ligne complètes | Paires incomplètes | Complétude |
| --- | ---: | ---: | ---: |
| Handicap asiatique | 171 981 | 2 177 | 98,75 % |
| Handicap asiatique MT | 95 117 | 1 575 | 98,37 % |
| Corners | 7 082 | 0 | 100 % |
| Corners MT | 4 206 | 0 | 100 % |
| Cartons | 1 605 | 0 | 100 % |

Une paire complète contient les deux côtés d'une même ligne au même instant.
Les paires AH incomplètes doivent être exclues de tout calcul de marge ou de
probabilité sans marge.

Autres contrôles :

- aucune ligne de ces marchés n'a été enregistrée au moment du coup d'envoi ou
  après ;
- les AH contiennent bien `HOME` et `AWAY`, avec 48 lignes distinctes plein
  match et 26 à la mi-temps ;
- corners et cartons contiennent des paires `OVER`/`UNDER` complètes ;
- les lignes entières de corners sont bien conservées, ce qui confirme que la
  nouvelle colonne `line` remplit son rôle.

## 4. Pourquoi cinq marchés restent vides

Au moment de la sauvegarde, le code sait rechercher et parser les identifiants
API de ces marchés, mais le worker considère volontairement une liste vide
comme un cas normal et ne la journalise pas. La base seule ne permet donc pas
de départager :

1. marché non servi par Pinnacle sur les rencontres demandées ;
2. identifiant non présent dans la réponse du fournisseur ;
3. libellé réel différent du mapping attendu ;
4. disponibilité limitée à un autre bookmaker, ensuite écarté par la politique
   `REFERENCE_ONLY_MARKETS`.

Le dry-run du 15 septembre avait observé `OVER_UNDER_2H`; son absence totale en
production mérite donc une investigation prioritaire. Ce n'est pas simplement
un marché rare dans l'échantillon actuel.

Instrumentation requise, désormais implémentée pour chaque synchronisation :

```text
fixtureId
bookmaker
betId demandé / trouvé
nombre de valeurs brutes
nombre de valeurs parsées
libellés non reconnus, sans afficher de credential
```

Une alerte doit se déclencher lorsqu'un marché attendu reste à zéro pendant 24
ou 48 heures. Cela permettra de distinguer absence fournisseur et régression de
parsing sans stocker toute la réponse brute.

## 5. Cas particulier des tirs

### 5.1 Ce qui existe

Le worker de statistiques lit `Shots on Goal` uniquement lorsque
`expected_goals` est absent :

```text
xG de repli = tirs cadrés × 0,4
```

Sur les rencontres terminées du 15 au 21 septembre :

- 509 rencontres terminées ;
- 402 possèdent `homeXg` et `awayXg`, valeur native ou proxy confondue ;
- 104 sont marquées `xgUnavailable`.

### 5.2 Ce qui manque

Dans la sauvegarde auditée, il n'existe pas :

- de marché de cote `SHOTS` ou `SHOTS_ON_TARGET` dans `Market` ;
- de table `fixture_statistic` ;
- de colonnes de tirs dans `team_stats` ;
- de conservation du nombre brut de tirs cadrés ;
- de provenance permettant de distinguer xG natif et proxy tirs ;
- de statistiques joueur nécessaires aux marchés de tirs individuels.

Nous ne pouvons donc ni entraîner une feature glissante de tirs, ni auditer sa
qualité, ni régler un marché de tirs avec les données actuelles.

Le premier chantier n'est pas de générer des picks de tirs, mais de créer une
table point-in-time des statistiques de rencontre, puis de backfiller au moins
les tirs cadrés pour/contre, tirs totaux, tirs dans la surface, corners,
possession, cartons et arrêts. Cette fondation est maintenant implémentée ; son
remplissage dépend du déploiement et du backfill de la section 9.

## 6. Exploitation par le moteur et les coupons

La base contient actuellement :

- **0** `channel_selection` sur les dix nouveaux marchés ;
- **0** `coupon_proposal_leg` sur les dix nouveaux marchés.

Le code de production possède les types et la collecte, mais pas encore les
stratégies nécessaires pour générer ces picks dans le moteur. Les coupons ne
peuvent donc pas les choisir.

Avant d'activer un marché, il faut compléter toute la chaîne :

1. données de résultat permettant un règlement exact ;
2. règlement des lignes entières, demi-lignes et quarts de ligne ;
3. génération d'une probabilité indépendante de la cote ;
4. benchmark contre le prix sans marge ;
5. backtest walk-forward groupé par rencontre ;
6. calibration et intervalle d'incertitude ;
7. garde-fous de couverture par championnat ;
8. admission éventuelle dans le vivier de coupons.

Pour l'AH, le score final suffit au règlement et un backtest dédié existe déjà.
Pour corners, cartons et tirs, il faut d'abord persister les statistiques de
match correspondantes.

## 7. Décisions recommandées

### P0 — observabilité de collecte

- Compter par synchronisation les bet ids vus, valeurs reçues, valeurs parsées
  et libellés rejetés.
- Alerter sur un marché attendu resté vide 24–48 h.
- Diagnostiquer en priorité `OVER_UNDER_2H`, observé au dry-run mais absent de
  la base de production.

### P0 — statistiques de tirs et règlement

- Ajouter `fixture_statistic(fixtureId, teamId, type, value, observedAt,
  source)` avec unicité et provenance.
- Ne plus mélanger silencieusement xG natif et proxy tirs ; conserver
  `xgSource`.
- Backfiller les championnats actifs et publier une couverture par championnat.

### P1 — AH comme premier marché candidat

- Écarter toutes les lignes AH sans paire complète.
- Construire le prix sans marge par bookmaker et ligne.
- Rejouer le backtest sur la collecte désormais beaucoup plus dense, par
  rencontre et par championnat, avec validation temporelle.
- Ne produire des sélections AH que si un signal bat le marché hors échantillon.

### P1 — calibration des coupons

- Mettre en place le benchmark marché et la calibration hiérarchique.
- Utiliser une borne prudente de probabilité conjointe.
- Faire du refus quotidien un résultat normal.
- Séparer le produit « fréquent » à cote 1,8–2,5 du produit « rendement » à
  cote 5–8 ; maintenir 8–15 en expérimentation tant qu'il n'est pas robuste.

## Conclusion de l'audit initial

La collecte AH est une réussite technique : forte couverture, huit bookmakers,
fraîcheur jusqu'au jour de l'audit et environ 98 % de paires complètes. Les
corners sont également bien collectés chez Pinnacle. Les cartons restent très
sélectifs selon le championnat.

En revanche, cinq marchés configurés sont entièrement vides, les tirs ne sont
pas persistés, et aucun nouveau marché n'entre encore dans les prédictions ou
les coupons. La prochaine valeur ne viendra donc pas de l'ajout immédiat de ces
marchés au compositeur, mais de l'observabilité de l'ingestion, de la
persistance des statistiques de résultat, puis d'une validation hors
échantillon contre le marché.

## 8. Implémentation réalisée le 21 septembre

### 8.1 Persistance finale et traçabilité

La migration `20260921170000_add_fixture_statistics` ajoute :

- `fixture_statistic`, une ligne par rencontre, équipe, statistique et source ;
- `StatisticSource=API_FOOTBALL` ;
- `homeXgSource` et `awayXgSource`, avec `API_FOOTBALL` ou `SHOTS_PROXY` ;
- `statisticsSyncedAt` et `statisticsUnavailable` sur la rencontre ;
- un index de rattrapage sur saison, statut et date de synchronisation ;
- les nouvelles variables glissantes dans `team_stats`.

Le remplacement des statistiques d'une rencontre est transactionnel et
idempotent : une relance supprime puis recrée uniquement les valeurs
`API_FOOTBALL` de cette rencontre. Une valeur absente reste absente ; elle
n'est jamais transformée en zéro.

Toutes les statistiques numériques livrées par le fournisseur sont conservées
avec un nom normalisé. Les noms actuellement reconnus explicitement sont :

| Fournisseur | Nom normalisé |
| --- | --- |
| Shots on Goal | `shots_on_goal` |
| Shots off Goal | `shots_off_goal` |
| Total Shots | `total_shots` |
| Blocked Shots | `blocked_shots` |
| Shots insidebox / outsidebox | `shots_inside_box` / `shots_outside_box` |
| Corner Kicks | `corner_kicks` |
| Ball Possession | `ball_possession` |
| Yellow Cards / Red Cards | `yellow_cards` / `red_cards` |
| Goalkeeper Saves | `goalkeeper_saves` |
| Total Passes / Passes accurate / Passes % | `total_passes` / `passes_accurate` / `passes_percentage` |
| expected_goals | `expected_goals` |

Un nom nouveau n'est pas jeté : il reçoit automatiquement un identifiant
`snake_case`, ce qui permet de l'auditer avant de l'admettre comme feature.

### 8.2 Correction du worker de statistiques

Le worker cible maintenant les rencontres terminées dont les **statistiques**
n'ont pas été synchronisées, même si elles avaient déjà un xG. Il peut donc
récupérer les tirs et corners historiques sans effacer le xG existant.

Ordre de traitement :

```text
réponse finale API
  → validation équipe domicile/extérieur
  → xG natif, sinon proxy tirs cadrés × 0,4
  → provenance du xG
  → persistance atomique de toutes les statistiques numériques
  → reconstruction des agrégats glissants de la saison
```

La persistance des statistiques vient en dernier : si l'écriture du xG échoue,
la rencontre n'est pas marquée synchronisée et le job peut la rejouer sans
laisser un état partiellement validé.

Le faux cas `xG=0` a été supprimé : si `expected_goals` **et** `Shots on Goal`
sont absents, le xG est indisponible. Les autres statistiques valides restent
néanmoins persistées.

Pour protéger le quota global, un job de routine traite au maximum 10
rencontres par championnat ; un backfill déclenché explicitement peut en
traiter 100. Le log expose `syncScope`, `backlog`, `count` et
`remainingAfterJob`. Une relance reprend le reliquat sans dupliquer les lignes.

### 8.3 Features point-in-time consommées

Après chaque rencontre, `team_stats` conserve des moyennes sur les dix derniers
matchs disponibles, séparées pour et contre :

- tirs cadrés ;
- tirs totaux ;
- corners ;
- cartons (`jaunes + rouges`) ;
- possession ;
- nombre de matchs réellement observés.

La construction parcourt les rencontres dans l'ordre chronologique et écrit le
snapshot **après** chaque rencontre. Lors de l'analyse d'un prochain match,
VANTAGE charge strictement le dernier snapshot antérieur au coup d'envoi. Il
n'y a donc pas de fuite du futur dans les variables.

Ces statistiques sont exposées comme contexte factuel. Elles ne modifient pas
encore directement la probabilité déterministe : leur coefficient devra être
appris et validé hors échantillon, par marché et avec shrinkage championnat.

### 8.4 Consommation des nouveaux marchés

VANTAGE lit maintenant, chez Pinnacle, le snapshot le plus récent des dix
marchés étendus. Pour les marchés à ligne, le contexte ne garde que la paire
complète la plus équilibrée, approximation compacte de la ligne principale.
Le prompt affiche explicitement `pick`, `line` et cote.

Ils restent **observationnels et non sélectionnables**. Cette séparation est
intentionnelle : une décision, une jambe de coupon et son règlement ne
transportent pas encore tous la ligne. Autoriser un AH ou un total de corners
avant cette migration de bout en bout produirait un pari ambigu et un résultat
impossible à auditer. L'activation nécessite encore les portes de la section
10.

### 8.5 Observabilité des marchés absents

Chaque run d'odds publie désormais, pour chaque marché étendu :

- rencontres où le bet id a été vu ;
- nombre de valeurs brutes ;
- nombre de valeurs parsées ;
- libellés rejetés, plafonnés et sans payload complet ni secret.

Un warning distinct est émis quand des valeurs brutes existent mais qu'aucune
n'est parsée. On peut donc enfin différencier « absent chez le fournisseur » de
« parseur cassé ». Une absence totale sur plusieurs runs reste une métrique à
alerter dans l'infrastructure de logs.

## 9. Runbook de déploiement et de backfill

### Étape 1 — sauvegarder et migrer

Exécuter la procédure normale de sauvegarde, puis :

```bash
pnpm --filter @evcore/db exec prisma migrate deploy
pnpm --filter @evcore/db build
```

Ne pas déclencher les workers avec l'ancien client Prisma après la migration :
redémarrer backend et worker dans la même livraison.

### Étape 2 — faire un canari

Choisir un championnat actif et une saison récente, puis appeler :

```text
POST /etl/sync/stats/{competitionCode}/backfill?seasons=2026
```

Vérifier dans les logs :

- `statisticRows > 0` ;
- `remainingAfterJob` décroît ;
- le nombre d'erreurs réseau et de réponses invalides ;
- la distribution de `homeXgSource/awayXgSource` ;
- aucun mismatch entre l'équipe du payload et celles de la rencontre.

Un job traite 100 rencontres au maximum. Répéter le backfill jusqu'à
`remainingAfterJob=0`. Éviter de lancer de nombreuses ligues en parallèle : à
deux secondes entre rencontres, 100 appels représentent déjà environ trois
minutes vingt et 100 unités du quota, hors appels de métadonnées.

### Étape 3 — élargir progressivement

Procéder championnat par championnat, d'abord sur les saisons utiles au
backtest. Après chaque lot, contrôler :

```sql
SELECT c.code,
       fs.type,
       COUNT(*) AS values,
       COUNT(DISTINCT fs."fixtureId") AS fixtures
FROM fixture_statistic fs
JOIN fixture f ON f.id = fs."fixtureId"
JOIN season s ON s.id = f."seasonId"
JOIN competition c ON c.id = s."competitionId"
GROUP BY c.code, fs.type
ORDER BY c.code, fs.type;
```

Puis reconstruire explicitement les snapshots d'une saison si nécessaire :

```text
POST /etl/sync/rolling-stats/{competitionCode}/{season}?mode=rebuild
```

### Étape 4 — critères de réception

Le backfill est accepté pour une cellule championnat × saison si :

- au moins 95 % des rencontres terminées et servies par l'API ont
  `statisticsSyncedAt` ;
- les deux équipes sont présentes pour les statistiques utilisées ;
- le taux de valeurs impossibles est nul (pourcentage hors 0–100, valeur
  négative pour tirs/corners/cartons) ;
- les agrégats `team_stats` ne dépassent pas la date de leur `afterFixture` ;
- les taux de couverture par variable et championnat sont publiés.

`statisticsUnavailable=true` doit être audité séparément : ce n'est ni zéro,
ni une défaite, ni une autorisation d'imputer silencieusement.

## 10. Portes avant activation dans les coupons

Un nouveau marché ne passe de « collecté » à « jouable » que si toutes les
conditions suivantes sont vraies :

1. **Identité complète** : `market + pick + line` circule dans sélection,
   décision VANTAGE, jambe de coupon, pari et historique.
2. **Règlement exact** : victoire, défaite, nul/remboursé et demi-gain/perte
   pour les quarts de ligne sont testés.
3. **Résultat disponible** : score pour AH ; statistiques finales fiables pour
   corners/cartons ; données joueur dédiées pour les tirs individuels.
4. **Baseline marché** : probabilité sans marge et cote de clôture calculables
   uniquement sur des paires complètes.
5. **Signal incrémental** : amélioration hors échantillon face au marché seul,
   mesurée en Brier/log-loss et non choisie après observation du ROI.
6. **Calibration** : validation walk-forward avec shrinkage championnat ×
   marché × tranche de cote et intervalle d'incertitude.
7. **Couverture** : seuil minimal et absence de biais majeur par championnat.
8. **Shadow mode** : génération et règlement simulés avant tout accès au
   compositeur réel.

Le premier candidat reste le handicap asiatique plein match : la collecte est
dense, multi-books et le résultat nécessaire existe déjà. Corners et cartons
viennent ensuite après le backfill des statistiques finales. Les marchés de
tirs individuels exigent une source joueur supplémentaire et ne doivent pas
être déduits des seuls totaux d'équipe.

## Conclusion opérationnelle

Le manque principal identifié dans la sauvegarde — des prix collectés mais pas
de statistiques finales persistées ni consommées — est corrigé dans le code.
Cela améliore la matière disponible pour distinguer les matchs, mais ne suffit
pas à promettre quatre ou cinq gagnants ensemble : cette promesse dépendra du
résultat du backfill et d'une preuve walk-forward contre le marché.

La prochaine action n'est donc pas d'élargir immédiatement les coupons. Elle
est d'appliquer la migration, exécuter un canari, mesurer la couverture par
championnat, puis entraîner et évaluer les signaux en shadow mode. Seuls les
marchés qui franchissent les huit portes de la section 10 pourront ensuite être
admis dans le compositeur.
