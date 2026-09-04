# Architecture et flux de données

## Séparation stricte des responsabilités

| Composant                | Rôle                                                  | Ne fait jamais                             |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------ |
| ETL (workers BullMQ)     | Collecte et normalisation des données                 | Inférer ou combler des données manquantes  |
| PostgreSQL               | Source de vérité historique                           | —                                          |
| Betting Engine (backend) | Scoring probabiliste + calcul d'EV                    | Appeler le LLM pour des données brutes     |
| Backend (NestJS)         | Validation, contrôle de risque, auto-apply + rollback | Contourner Zod ou les règles de rate-limit |
| VANTAGE / LLM            | Delta contextuel uniquement                           | Être une source de données primaire        |

## Flux de données global

```
ETL Workers (BullMQ)
        v   [validé par Zod avant toute écriture]
PostgreSQL (source de vérité unique)
        v
Betting Engine Service (scoring déterministe)
        v
VANTAGE (delta LLM, plafonné, Phase 2 uniquement — voir le canal dédié)
        v
Validation backend (autorité)
        v
ModelRun stocké + notification
```

Chaque `ModelRun` doit logger `fixture_id`, `features`, `deterministic_score`, `llm_delta` (le cas échéant), `final_score`, `decision` — ce qui permet de rejouer n'importe quel run a posteriori.

## Garde-fous sur les données manquantes

| Cas                           | Comportement                                           |
| ----------------------------- | ------------------------------------------------------ |
| Match reporté/annulé          | Fixture marquée `POSTPONED` — aucun `ModelRun` généré  |
| Odds manquantes en phase live | `decision: NO_BET` automatique                         |
| Source ETL indisponible       | Job BullMQ retenté avec backoff, alerte si échec total |

## Contraintes dures (backend uniquement, jamais côté client)

Ces règles sont câblées dans le code et ne doivent jamais être contournées par une nouvelle feature :

- `EV_THRESHOLD ≥ 0.08` — seuil qui alimente encore le canal `VALUE`, mais qui n'est plus un signal de qualité (voir l'avertissement anti-prédictif dans [Moteur de prédiction et canaux](/dashboard/documentation-technique/prediction-engine-channels)). `MAX_LEG_EDGE = 0.10` s'applique par-dessus en plafond sur toute surface de mise.
- Plafond du delta LLM `≤ 0.30` : règle produit documentée (`CLAUDE.md`/`EVCORE.md`), mais **non câblée dans le code actuel**. Le canal `VANTAGE` (en production depuis le 2026-08-28) tourne comme un canal déterministe classique dans `ChannelStrategyOrchestrator`, sans `llm_delta` ni constante de cap dédiée — aucune trace d'OpenClaw ni de mécanisme de plafonnement dans `apps/backend/src/modules/betting-engine/`. C'est une contrainte de garde-fou pour une intégration future, pas un mécanisme vérifiable aujourd'hui. Détail dans [Backend NestJS](/dashboard/documentation-technique/backend).
- Ajustement de poids : minimum 50 paris sur le marché concerné, maximum 5% de variation par semaine.
- Suspension automatique d'un marché : ROI < -15% sur 50+ paris.
- `AdjustmentProposal` est **auto-appliqué** par le backend dès que la calibration le déclenche ; un humain peut faire un rollback via `POST /adjustment/:id/rollback`, limité à un auto-apply annulé par semaine et par marché.

## Décisions qui exigent une validation humaine

- Annuler (rollback) un `AdjustmentProposal` auto-appliqué.
- Réactiver un marché suspendu — jamais automatique.
- Changer le seuil d'EV.
- Introduire un nouveau fournisseur LLM dans la boucle de scoring.
- Désactiver manuellement un facteur activé automatiquement par la boucle d'apprentissage.

## Phases produit

Le système avance par phases, chacune avec un périmètre strict (voir `CLAUDE.md` pour la table complète feature → phase) :

- **MVP** — import historique, backtest, calibration. Terminé (Go Phase 2 le 2 mars 2026, Brier Score 0.592, Calibration Error 2.5%, ROI simulé +2.28% sur 3 saisons EPL).
- **Phase 2** — intégration odds, simulation EV, données live, canaux de prédiction par marché, déploiement production. **En cours, argent réel.**
- **Phase 3** — couche de correction ML (`ml-worker`, XGBoost léger), Monte Carlo, calibration probabiliste avancée. **ML en shadow**, pas encore promu dans le scoring principal.
- **Phase 4** — SaaS, multi-tenant, API interne. Non commencé.

L'extension multi-sport est cadrée mais **différée** (voir `docs/multi-sport-extension.md` et `docs/prediction-engine-families.md` §1) : le principe retenu est un moteur par famille de processus générateur (partagé entre sports qui ont la même structure statistique), pas un socle dupliqué par sport. Aucune précondition n'est remplie à ce jour — recherche uniquement, pas de code.

## État de production actuel

Au 2026-08-30 : Phase 2 tourne en argent réel, Phase 3 (ML) tourne en shadow (signal de correction non actif dans le scoring), et le canal `VANTAGE` (LLM contextuel porté par `vantage-worker`) est en production depuis le 2026-08-28. Détail dans [État d'avancement et roadmap](/dashboard/documentation-technique/etat-avancement).
