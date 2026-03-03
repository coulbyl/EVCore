# OPENCLAW.md

Stratégie d'intégration OpenClaw pour EVCore.

## Statut

`STAND-BY POST-PROD`

OpenClaw n'est pas requis pour l'exploitation actuelle d'EVCore.
Le moteur déterministe reste la source d'autorité en production.

## Position produit

- OpenClaw est un module d'appoint pour signaux non structurés.
- Aucune décision de bet ne doit dépendre d'OpenClaw tant que les critères de validation ne sont pas atteints.
- Avant activation, OpenClaw fonctionne uniquement en `shadow mode` (log + comparaison offline).

## Règles d'activation

Activation envisageable uniquement après:

1. Au moins 30 jours de production stable du pipeline déterministe.
2. Shadow mode OpenClaw actif sans incident bloquant.
3. Validation KPI sur fenêtre glissante:
   - Brier score non dégradé
   - ROI non dégradé
   - Drawdown non aggravé
4. Delta OpenClaw borné et validé backend:
   - `|llmDelta| <= 0.30`
   - sortie strictement validée (Zod)
   - fallback déterministe systématique si erreur/time-out

## Mode opératoire recommandé

1. Shadow mode (aucun impact décisionnel).
2. A/B contrôlé sur trafic limité.
3. Rollout progressif avec kill switch immédiat.

## Gouvernance technique

- `temperature = 0`
- Logs complets `openclawRaw` pour audit/replay.
- Monitoring dédié (latence, taux d'erreur, impact KPI).
- Rollback instantané via feature flag.
