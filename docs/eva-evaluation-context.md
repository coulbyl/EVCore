# EVA — Contexte d'évaluation complète (outil `getPicksWithEvaluation`)

## Problème actuel

Quand un parieur demande "qu'est-ce que je peux parier aujourd'hui ?", EVA appelle
`getUpcomingPicks` qui retourne uniquement les **picks acceptés** par le moteur :

```
BTTS YES  — Mexico vs Cameroun  — prob 0.478 — cote 1.82 — EV +0.128
CONF HOME — Brazil vs Morocco   — prob 0.710 — cote 1.54 — EV +0.094
```

Ce que le moteur a réellement évalué (et que le rapport `audit-fixtures` expose) :

```
Mexico vs Cameroun   λH=0.93  λA=1.22  λ_total=2.15
  ✓ BTTS YES       0.478  cote 1.82  EV +0.128
  ✗ NUL            0.248  rejeté → prob_below_threshold (seuil WC 0.25)
  ✗ OVER 2.5       0.552  rejeté → ev_below_floor

Brazil vs Morocco    λH=1.755 λA=1.666 λ_total=3.421
  ✓ BTTS YES       0.712  cote 1.65  EV +0.174
  ✓ CONF HOME      0.710  cote 1.54  EV +0.094
  ✗ OVER 3.5       0.446  rejeté → WC|OVER_UNDER|OVER_3_5 bloqué
  shadow : h2h_btts_rate=0.67, line_move=stable
```

Avec le deuxième niveau d'information, EVA peut trier intelligemment :

- Brazil-Morocco cumule deux signaux convergents (BTTS + CONF HOME) — priorité haute.
- Le OVER 3.5 était bloqué structurellement — EVA peut l'expliquer sans inventer.
- Mexico-Cameroun a un seul signal et un NUL rejeté de justesse — priorité moindre.

Sans ce contexte, EVA classe par probabilité ou EV brut et ne voit pas la convergence.

---

## Solution : outil `getPicksWithEvaluation`

Un nouvel outil de lecture qui retourne, pour une date donnée, l'ensemble des fixtures
évalués par le moteur avec leurs lambdas, leurs picks évalués (acceptés **et** rejetés),
leurs raisons de rejet et leurs signaux shadow.

EVA utilise cet outil **à la place de** `getUpcomingPicks` quand elle doit recommander
des picks et que le contexte d'évaluation est pertinent (demandes "quoi parier",
"meilleurs picks du jour", "pourquoi ce pick", "compare ces fixtures").

### Forme de la réponse

```json
{
  "date": "2026-06-14",
  "asOf": "2026-06-14T18:34:00Z",
  "fixtures": [
    {
      "fixtureId": "uuid",
      "match": "Brazil vs Morocco",
      "kickoff": "2026-06-14T21:00:00Z",
      "competition": "WC",
      "status": "SCHEDULED",
      "lambda": {
        "home": 1.755,
        "away": 1.666,
        "total": 3.421
      },
      "shadowSignals": {
        "h2hBttsRate": 0.67,
        "lineMovement": "stable",
        "congestion": false
      },
      "evaluatedPicks": [
        {
          "channel": "BTTS",
          "market": "BTTS",
          "pick": "YES",
          "probability": 0.712,
          "odds": 1.65,
          "ev": 0.174,
          "decision": "BET",
          "rejectionReason": null
        },
        {
          "channel": "CONF",
          "market": "ONE_X_TWO",
          "pick": "HOME",
          "probability": 0.71,
          "odds": 1.54,
          "ev": 0.094,
          "decision": "BET",
          "rejectionReason": null
        },
        {
          "channel": "EV",
          "market": "OVER_UNDER",
          "pick": "OVER_3_5",
          "probability": 0.446,
          "odds": 3.54,
          "ev": 0.579,
          "decision": "NO_BET",
          "rejectionReason": "pick_ev_floor_blocked"
        }
      ]
    }
  ]
}
```

### Champs clés

| Champ                              | Source DB                                   | Rôle pour EVA                                                |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `lambda.home/away/total`           | `model_run.features`                        | Contexte quantitatif du pick (scoring offensif estimé)       |
| `shadowSignals`                    | `model_run.features`                        | Signaux complémentaires (h2h, congestion, mouvement de cote) |
| `evaluatedPicks[].decision`        | `bet.status=PENDING` = BET, absent = NO_BET | Distingue accepté vs rejeté                                  |
| `evaluatedPicks[].rejectionReason` | calculé à partir des features du model_run  | Explique le rejet sans que EVA invente                       |
| `evaluatedPicks[].channel`         | `bet.source` ou reconstruit                 | Permet de voir la convergence multi-canaux                   |

### Raisons de rejet exposées

| Code                       | Signification lisible par EVA                                    |
| -------------------------- | ---------------------------------------------------------------- |
| `prob_below_threshold`     | Probabilité insuffisante pour ce canal/compétition               |
| `ev_below_floor`           | EV calculé sous le plancher de la ligue                          |
| `ev_above_hard_cap`        | EV anormalement élevé — signal suspect, bloqué par sécurité      |
| `pick_ev_floor_blocked`    | Pick structurellement désactivé pour cette compétition/marché    |
| `under_high_lambda`        | UNDER bloqué car λ_total trop élevé                              |
| `no_odds`                  | Cote manquante au moment de l'analyse                            |
| `min_sample_not_reached`   | Pas assez de paris historiques pour valider le seuil canal       |
| `conf_margin_insufficient` | Canal CONF : écart insuffisant entre issue dominante et 2e issue |

---

## Ce que ça change pour EVA

### Avant (outil `getUpcomingPicks`)

EVA voit une liste plate de picks BET. Elle recommande selon probabilité + EV brut.
Elle ne peut pas expliquer pourquoi un pick a été rejeté ni voir les convergences.

### Après (outil `getPicksWithEvaluation`)

EVA voit le tableau complet d'évaluation par fixture. Elle peut :

1. **Prioriser par convergence** — un fixture où BTTS + CONF pointent dans le même sens
   est plus fiable qu'un fixture avec un seul signal.

2. **Expliquer les rejets** — "le moteur a évalué OVER 3.5 à 44.6% mais ce marché est
   structurellement bloqué sur la Coupe du Monde" — sans inventer.

3. **Contextualiser les lambdas** — "λ_total=3.42 sur Brazil-Morocco, le moteur estime
   un match à fort potentiel offensif, d'où le BTTS YES à 71%".

4. **Signaler les signaux shadow** — "le h2h BTTS rate est à 67% sur ces deux équipes,
   cohérent avec la prédiction du moteur".

5. **Avertir sur les picks isolés** — si un seul canal s'est déclenché et que les autres
   ont été rejetés de justesse, EVA peut le dire.

---

## Ce que ça ne change pas

- EVA **ne génère jamais ses propres picks**. Elle restitue ce que le moteur a évalué.
- Le backend reste autorité finale. `getPicksWithEvaluation` est lecture seule.
- Les calculs (produit de cotes, proba jointe) restent dans les tools dédiés.
- Les picks rejetés restent rejetés — EVA ne les ressuscite pas.

---

## Implémentation

### 1. Source des données

Tout est en DB :

- `model_run.features` → lambdas, shadow signals, raisons de rejet calculées
- `bet` (PENDING) → picks acceptés avec prob/odds/EV/channel
- `fixture` → match, kickoff, competition, status

Le rapport `audit-fixtures` (`packages/db/scripts/audit-fixtures.ts`) contient déjà
la logique de reconstruction des picks évalués à partir de ces tables. L'outil réutilise
cette logique sous forme de requête de `chat.read.repository.ts`.

### 2. Fichiers à créer / modifier

| Fichier                    | Changement                                           |
| -------------------------- | ---------------------------------------------------- |
| `chat.read.repository.ts`  | Ajouter `getPicksWithEvaluation(date)`               |
| `chat.tools.schemas.ts`    | Déclarer le schéma Zod + définition tool LLM         |
| `chat.tools.service.ts`    | Implémenter le handler + mapper les rejectionReasons |
| `chat.constants.ts`        | Ajouter le label `getPicksWithEvaluation`            |
| `chat.golden.spec.ts`      | Ajouter les cas de test                              |
| `chat.service.ts` (prompt) | Ajouter la règle d'usage de cet outil                |

### 3. Règle d'usage dans le prompt EVA

```
- "quoi parier aujourd'hui", "picks du jour", "analyse les matchs de ce soir"
  => getPicksWithEvaluation (date du jour). Utilise les lambdas, les convergences
  de canaux et les signaux shadow pour justifier ta recommandation.
  Mentionne les rejets pertinents si ils eclairent le pick retenu.
```

### 4. Limite de taille

Filtrer les fixtures sans aucun pick BET ni aucun pick évalué au-dessus de 35% de
probabilité pour ne pas saturer le contexte. Limiter à `CHAT_LIMITS.maxToolRows`
fixtures par appel (30 par défaut).

---

## Relation avec l'existant

| Outil                    | Reste utile pour                                                |
| ------------------------ | --------------------------------------------------------------- |
| `getUpcomingPicks`       | Requêtes légères "liste des picks" sans besoin de justification |
| `explainFixture`         | Deep-dive sur un seul fixture à la demande de l'user            |
| `getPicksWithEvaluation` | Recommandation du jour avec contexte d'évaluation complet       |

Les trois coexistent. EVA choisit selon l'intention de l'user.
