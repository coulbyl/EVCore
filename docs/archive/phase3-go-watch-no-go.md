# Phase 3 — GO / WATCH / NO-GO

Références:

- rapport source: [edge-vs-pinnacle-2026-06-04.md](../packages/db/reports/edge-vs-pinnacle-2026-06-04.md)
- note d'architecture ML: [phase3-ml-correction-layer.md](./phase3-ml-correction-layer.md)

## But

Transformer le rapport `edge vs Pinnacle` en lecture décisionnelle simple avant toute implémentation ML.

Cette matrice ne dit pas:

- quels marchés sont "bons" au sens absolu

Elle dit:

- quels segments sont assez sains pour servir de référence
- quels segments méritent une correction ML ciblée
- quels segments sont trop faibles ou trop bruyants pour entrer dans un premier cycle ML

## Règles de lecture

### `GO`

À utiliser si le segment montre déjà:

- un ROI Pinnacle positif ou défendable
- une cohérence minimale entre signal et résultat
- un volume suffisant pour être pris au sérieux

Usage:

- référence saine
- candidat à calibration fine
- candidat à déploiement shadow ML sans urgence corrective

### `WATCH`

À utiliser si le segment montre:

- un signal intéressant mais encore ambigu
- ou un bon résultat avec trop peu de volume
- ou un biais plausible qui justifie une correction ciblée

Usage:

- audit complémentaire
- segmentation plus fine
- candidat naturel pour la première couche de correction ML

### `NO-GO`

À utiliser si le segment montre:

- un ROI très négatif
- un edge affiché élevé mais contredit par les résultats
- trop peu de couverture ou un mapping marché encore incomplet

Usage:

- ne pas utiliser comme base de training ML v1
- ne pas promouvoir en prod sans refonte
- traiter d'abord comme problème de signal ou de data

## Matrice actuelle

| Canal                 | Marché                | Verdict | Lecture                                                                                                                                                           |
| --------------------- | --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SV`                  | `OVER_UNDER`          | `GO`    | C'est aujourd'hui le segment le plus sain: volume élevé, hit rate fort, ROI Pinnacle positif. Très bonne base de référence.                                       |
| `SV`                  | `OVER_UNDER_HT`       | `GO`    | Petit que `SV/OVER_UNDER`, mais comportement encore meilleur. Référence saine pour calibration et comparaison baseline vs ML.                                     |
| `SV`                  | `ONE_X_TWO`           | `WATCH` | ROI très bon, mais volume trop faible (`7` picks) pour conclure. À surveiller, pas à généraliser.                                                                 |
| `EV`                  | `OVER_UNDER`          | `WATCH` | Signal contradictoire globalement négatif, mais avec des sous-segments ligue/marché parfois positifs. Candidat à segmentation et correction ML, pas à rejet brut. |
| `EV`                  | `OVER_UNDER_HT`       | `WATCH` | ROI global légèrement positif, mais hit rate encore faible et profil potentiellement instable. Intéressant pour une correction modérée.                           |
| `EV`                  | `ONE_X_TWO`           | `NO-GO` | C'est le plus gros signal d'alarme du rapport: edge affiché élevé, ROI Pinnacle très négatif, forte suspicion de surconfiance structurelle.                       |
| `EV`                  | `FIRST_HALF_WINNER`   | `NO-GO` | Même profil que `EV/ONE_X_TWO`: edge moyen élevé sur le papier, résultats très mauvais en pratique.                                                               |
| `EV`                  | `BTTS`                | `NO-GO` | Trop peu de lignes exploitables et couverture Pinnacle incomplète. Pas de base sérieuse pour Phase 3 v1.                                                          |
| `CONF`                | `ONE_X_TWO`           | `WATCH` | Volume utile, hit rate acceptable, mais ROI Pinnacle négatif. Candidat à recalibration ou meta-model, pas encore `GO`.                                            |
| `DRAW`                | `ONE_X_TWO`           | `WATCH` | Volume faible mais ROI encourageant. Candidat à observation renforcée avant toute généralisation.                                                                 |
| `BTTS`                | `BTTS`                | `NO-GO` | La couverture Pinnacle manque encore massivement dans ce rapport (`missing-pinnacle:BTTS`). Impossible d'en faire une base ML propre pour l'instant.              |
| `DOUBLE_CHANCE`       | `DOUBLE_CHANCE`       | `NO-GO` | Segment exclu du rapport v1. Il faut d'abord un mapping propre vs marché sharp.                                                                                   |
| `HALF_TIME_FULL_TIME` | `HALF_TIME_FULL_TIME` | `NO-GO` | Segment exclu du rapport v1. Trop tôt pour l'inclure dans le premier cycle ML.                                                                                    |

## Lecture synthétique

### Références saines

Les meilleurs points d'ancrage actuels sont:

- `SV / OVER_UNDER`
- `SV / OVER_UNDER_HT`

Ce sont les segments à conserver comme baseline saine.

### Segments à corriger

Les meilleurs candidats pour une couche ML de correction sont:

- `EV / ONE_X_TWO`
- `CONF / ONE_X_TWO`
- `EV / OVER_UNDER`
- `EV / OVER_UNDER_HT`

Pourquoi:

- ce sont des segments où le moteur semble parfois afficher un edge qui ne se matérialise pas
- donc le ML peut apprendre une correction de probabilité ou un score de fiabilité

### Segments à laisser de côté en v1

À exclure du premier cycle ML:

- `EV / FIRST_HALF_WINNER`
- `EV / BTTS`
- `BTTS / BTTS`
- `DOUBLE_CHANCE`
- `HALF_TIME_FULL_TIME`

Raison:

- soit le signal est trop mauvais
- soit la couverture marché sharp n'est pas assez propre
- soit le volume ne permet pas de conclure

## Décision Phase 3 v1

Si l'objectif est de démarrer Phase 3 proprement, la bonne stratégie est:

1. Garder `SV / OVER_UNDER` et `SV / OVER_UNDER_HT` comme baseline saine
2. Cibler `EV / ONE_X_TWO` comme premier chantier de correction ML
3. Ajouter `CONF / ONE_X_TWO` en second cercle
4. N'inclure les autres marchés qu'après amélioration de la couverture et du mapping Pinnacle

## Recommandation produit

Ordre recommandé des chantiers:

1. `EV / ONE_X_TWO`
2. `CONF / ONE_X_TWO`
3. `EV / OVER_UNDER`
4. `EV / OVER_UNDER_HT`

Ordre recommandé des segments de référence:

1. `SV / OVER_UNDER`
2. `SV / OVER_UNDER_HT`

## Conclusion

La matrice actuelle dit clairement:

- `SV` sert de base saine
- `EV / ONE_X_TWO` est le premier vrai problème à corriger
- `CONF / ONE_X_TWO` mérite une recalibration
- plusieurs marchés doivent rester hors du périmètre ML v1 tant que la couverture et le mapping marché sharp ne sont pas durcis
