# Fiche d'analyse — schéma v2

Contrat de la fiche JSON enrichie. Source de vérité du typage :
[`analysis-sheet-v2.types.ts`](../apps/backend/src/modules/analysis-sheet/analysis-sheet-v2.types.ts).
Exemple réel sur 3 matchs : [`examples/analysis-sheet-v2-example.json`](examples/analysis-sheet-v2-example.json).

Audit préalable et justification de chaque choix :
[`audit-fiche-v2-2026-09-12.md`](audit-fiche-v2-2026-09-12.md).

---

## Principe

**La fiche expose, elle ne sélectionne pas.** Elle rassemble les données brutes qui
permettent de vérifier une probabilité du modèle contre la réalité observée, et laisse
la composition du combiné entièrement en aval.

Trois règles en découlent, appliquées sans exception :

1. **Les 7 marchés cibles sont toujours présents**, même rejetés, même non cotés. Les
   gates du moteur de pari simple (plancher d'EV, plancher de cote par ligue, plancher
   de probabilité) sont rapportés comme **diagnostic** — ils ne filtrent rien ici.
2. **Aucune imputation silencieuse.** Une valeur absente est `null` accompagnée d'un
   `reason` pris dans un vocabulaire fermé (`ABSENCE_REASONS`).
3. **Aucune fuite de données.** Toutes les statistiques de `context` viennent de matchs
   antérieurs au coup d'envoi ; la borne est posée dans le SQL
   ([`analysis-sheet-v2.repository.ts`](../apps/backend/src/modules/analysis-sheet/analysis-sheet-v2.repository.ts)),
   pas dans le code appelant.

## Appeler l'endpoint

```
GET /analysis-sheet?from=2026-09-11&to=2026-09-13&schemaVersion=2
```

`schemaVersion=2` est **obligatoire** pour obtenir la v2 : sans lui, la réponse est la
v1 à l'identique, pour qu'aucun script existant ne change de comportement.

| Paramètre | Défaut | Effet |
| --- | --- | --- |
| `schemaVersion` | `1` | `2` pour la fiche enrichie |
| `status` | tous | Statuts conservés, ex. `status=SCHEDULED` |
| `markets` | tous | Marchés conservés dans les picks, ex. `markets=ONE_X_TWO,BTTS` |
| `excludeChannels` | aucun | Canaux retirés, ex. `excludeChannels=CORRECT_SCORE` |
| `compact` | `false` | Retire `history` et les picks évalués hors marchés cibles |
| `includeContext` | `true` | Coupé automatiquement au-delà de 7 jours de plage |
| `includeCalibration` | `true` | Bloc `calibration` (~8 s : parcourt tout l'historique) |
| `includeLegPool` | `true` | Bloc `legPool` |
| `legPoolMinOdds` | `1.25` | Cote minimale d'une sélection |
| `legPoolMarkets` | les 7 | Sous-ensemble des marchés cibles |
| `legPoolMinCoverage` | `0.66` | Couverture minimale des signaux |
| `legPoolExcludeFlags` | `true` | Écarte les matchs drapeautés AVOID / alerte de calibration |
| `legPoolStatus` | `SCHEDULED` | Statut des matchs retenus |

Exemple — le pool du jour, fiche allégée :

```
GET /analysis-sheet?from=2026-09-12&to=2026-09-12&schemaVersion=2&compact=true&status=SCHEDULED
```

## Non-régression v1

La v2 est **strictement additive**. `buildJsonSheetV2` part du résultat exact de
`buildJsonSheet` et n'ajoute que des clés : aucun champ v1 n'est supprimé, renommé ni
modifié. Un test le vérifie clé par clé, aux deux niveaux (fiche et match) —
`analysis-sheet-v2.render.spec.ts`, « conserve à l'identique tous les champs de la fiche v1 ».

Le mode `compact` retire deux choses et deux seulement : `selectedPicks[].history`, et les
`evaluatedPicks` hors marchés cibles (83 % du volume — 37 047 cibles sur 218 245 mesurés
sur une fenêtre de trois jours). Aucun champ de diagnostic n'est touché.

---

## Blocs ajoutés

### `meta`

`definitions` (unité, fenêtre et description de chaque grandeur), `constants` (les
constantes du moteur que la fiche cite, avec leur valeur effective) et `caveats` (les
limites connues, énoncées plutôt que masquées).

### `fixtures[].context`

Données brutes d'avant-match, par équipe (`home`, `away`) :

| Champ | Contenu |
| --- | --- |
| `form` | 5 et 10 derniers matchs toutes compétitions, plus les 5 derniers dans le même rôle. Série W/D/L, points, buts, `sampleSize` réel |
| `goals` | Saison en cours et précédente, scindées domicile/extérieur : moyennes de buts, taux Over 1.5 / Over 2.5 / BTTS, clean sheet, failed to score, **victoire en au moins une mi-temps** |
| `xg` | xG pour/contre sur 10 matchs, `matchesWithXg`, `source` |
| `standing` | Classement **dérivé des matchs terminés**, arrêté à la veille du coup d'envoi |
| `schedule` | Jours de repos, compétition du dernier match, densité ±4 jours, match d'une autre compétition dans la fenêtre |
| `availability` | Compteur de blessés — **aucun détail joueur n'existe en base** |

Au niveau du match, `context.h2h` : jusqu'à 10 confrontations (date, compétition, lieu,
score final, score à la mi-temps), leurs agrégats, et l'explicitation complète du scalaire
`model.shadowSignals.h2h` — formule, décroissance, score de nul, échantillon minimum,
favori concerné.

⚠ Les scores H2H sont **orientés du point de vue de l'équipe qui reçoit dans le match
décrit**, quel que soit le lieu de la rencontre passée. `venueForHomeTeam` dit qui recevait
ce jour-là.

### `fixtures[].market`

Les 7 marchés cibles, toujours les 7 : meilleure cote et cote médiane avec le nombre de
bookmakers, horodatage du snapshot, probabilité implicite et mouvement de ligne.

**Probabilité implicite** — deux formes distinctes :
- `raw` = `1/cote`, **marge incluse**. C'est la convention du moteur (AVOID,
  market-coherence). Ce n'est pas une probabilité réelle.
- `deVigged` = marge retirée par **normalisation proportionnelle** sur les issues du
  marché, avec `overround` et `outcomes` pour que le calcul soit reproductible.

`deVigged` vaut `null` sur `TO_WIN_EITHER_HALF` (`reason: "no_complement_priced"`) : HOME
et AWAY n'y forment pas une partition — les deux peuvent arriver, ou aucune — et le
complément n'est pas coté. La marge n'y est donc pas estimable.

**Mouvement de ligne** — ancré sur le **premier snapshot réellement disponible**, pas sur
une cote d'ouverture qui n'existe pas : l'ETL ne collecte qu'à partir de J+3
(`ODDS_PREMATCH_HORIZON_DAYS = 3`). `baselineHoursBeforeKickoff` dit exactement de quand
date la référence — c'est ce champ qui rend le delta interprétable. Signe :
`(première − dernière) / première`, positif = la cote a raccourci.

> Le signal v1 `model.shadowSignals.lineMovement` reste `null` sur ~99,5 % des matchs
> (il exige un snapshot antérieur à KO−7 j) et est conservé tel quel pour non-régression.
> `market[].lineMovement` en est la version exploitable.

### `fixtures[].lambdaTrace`

Reconstruction complète de la chaîne λ. Cinq étapes nommées, dans l'ordre, dont **une
seule agit sur λ** :

| Étape | Agit sur | Condition |
| --- | --- | --- |
| `h2h_lambda_correction` | **λ** | score H2H disponible (n ≥ 3) |
| `three_way_empirical_blend` | probabilités 1X2 | poids par ligue |
| `over_under_shrinkage` | probabilités O/U | config par ligue |
| `h2h_market_signal_shift` | probabilités | signaux H2H disponibles |
| `congestion_signal_shift` | probabilités | correction active |

Le moteur ne persiste que le λ **final** : `base` est reconstruit en inversant la
correction H2H, exactement inversible hors saturation. `baseDerivation` dit comment
(`inverted_from_final`, `final_is_base`, `unavailable`) et `notes` énonce les limites —
notamment que le favori H2H est **inféré** des probabilités Poisson brutes, le moteur ne
l'enregistrant pas.

### `fixtures[].dataCoverageDetail`

`ratio` (identique au `model.dataCoverage` v1), **`level` entier 0-3**, et le détail des
trois composantes avec leur poids et leur motif d'absence.

⚠ **Filtrer sur `level`, pas sur `ratio`** : le ratio vaut 2/3 = 0,6666… sur la quasi-
totalité des matchs, et un seuil `≥ 0.67` élimine donc 100 % de la fiche.

### `fixtures[].targetMarkets`

Les 7 marchés cibles, avec probabilité du modèle, probabilité Poisson brute,
`adjustmentDelta`, probabilité du marché, `edge`, `ev`, `odds`, `status`,
`rejectionReason` — et `gates`, les seuils qui s'appliquaient :

- `evFloor`, `minOdds`, `maxOdds`, `minProbability` ;
- **`segmentDisabled`** : `true` quand ce couple (ligue × marché × pick) est volontairement
  coupé par un plancher d'EV sentinelle (0.99 ou 2.99). C'est rigoureusement
  infranchissable — `EV_HARD_CAP = 0.90` rejette tout pick au-dessus de 0,90 avant même
  que le plancher ne soit testé. **104 segments** sont dans ce cas.

⚠ `edge` (probabilité modèle − probabilité marché) est **anti-prédictif** sur nos données
(audit 2026-08-22 : taux réalisé plat 0,511 → 0,375 quand l'edge annoncé monte 0,481 →
0,699). Diagnostic uniquement — ne jamais trier dessus.

⚠ `minOdds` n'est **pas** un plancher de cote absolu : c'est un plancher par
(ligue × marché × pick) issu des backtests ROI, qui monte jusqu'à 5.00 (ex.
`CH|ONE_X_TWO|HOME`). Une cote de 3,47 rejetée pour `odds_below_floor` est donc cohérente.

### `calibration`

Par (marché × compétition), sur tout l'historique réglé, hors `observationOnly` : `n`,
`hitRate`, `avgPredictedProbability`, `observedFrequency`, **`calibrationRatio`**,
`brierScore`, `roi`. Plus le biais de λ par compétition (buts prédits vs réels, `bias`,
`ratio`). `exclusions` rend le périmètre auditable.

⚠ **La mesure de fiabilité est `calibrationRatio`** (fréquence observée ÷ probabilité
moyenne annoncée ; 1 = calibré, < 1 = le modèle sur-annonce). `roi` est exposé par
complétude mais n'a **aucune puissance statistique** à nos volumes — erreur-type de 13 à
18 points pour des écarts de 10 points. Ne pas en tirer de conclusion.

### `legPool`

Liste à plat des sélections éligibles. Les filtres sont **déclaratifs** et rendus dans la
sortie ; `excludedCounts` dit combien chaque filtre a écarté, et pourquoi.

Chaque entrée porte `fixtureId`, `kickoff`, marché, probabilité du modèle, probabilité du
marché (dé-marginalisée si estimable, sinon brute), cote, EV, edge, `coverageLevel`, les
drapeaux du match, et `reliability` — la fiabilité historique du couple marché ×
compétition tirée de `calibration`.

`correlationGroup` vaut le `fixtureId` : deux sélections qui le partagent portent sur le
même match et **ne doivent jamais être combinées**. La fiche les étiquette ; elle n'en
écarte aucune d'office.

L'ordre est **purement chronologique**. Trier par EV ou par edge reviendrait à classer —
la fiche n'a pas à suggérer un ordre de préférence.

---

## Limites connues

Toutes sont également présentes dans `meta.caveats`, dans la réponse elle-même.

- `context.*.xg.source` vaut `"unverifiable"` : la colonne `fixture.homeXg` contient soit
  le xG d'API-Football, soit un proxy `tirs cadrés × 0.4`, **sans marqueur de provenance**.
  Une migration `xgSource` lèverait la limite pour les matchs à venir.
- `context.*.availability` ne contient que des compteurs de blessés, présents sur ~19 % des
  analyses. Aucun détail joueur n'est stocké et les suspensions ne sont pas fournies par le
  flux : identifier « les blessés clés » n'est pas possible aujourd'hui.
- `context.*.standing` est dérivé des résultats : les **retraits de points administratifs**
  ne sont pas reflétés.
- `calibration.byMarketAndCompetition` agrège des canaux de nature différente sur un même
  marché : c'est une calibration **du marché**, pas d'un canal en particulier.
- Le bloc `context` est coupé au-delà de 7 jours de plage
  (`ANALYSIS_SHEET_LIMITS.maxContextRangeDays`) ; la fiche reste servie, avec le motif dans
  `contextReason`.

## Régénérer l'exemple

```bash
pnpm --filter backend exec tsx scripts/generate-v2-example.ts 2026-09-11 2026-09-13 3
```
