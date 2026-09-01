# État d'avancement et roadmap

> Cette page résume `ROADMAP.md` et `TODO.md` pour donner une vue d'ensemble datée. Pour le détail bloc par bloc et les décisions historiques, se référer directement à ces deux fichiers — ils restent la source de vérité pour le suivi au jour le jour.

## Statut au 2026-08-30

Phase 2 tourne en **production, argent réel**. Phase 3 (ML) tourne en **shadow** : le modèle de correction existe, est entraîné et évalué, mais n'a pas encore été promu dans le scoring actif. Le canal `VANTAGE` (LLM contextuel) est en production depuis le 2026-08-28.

## MVP — Phase 1 (terminé, Go le 2 mars 2026)

Fondations du monorepo, ETL historique 3 saisons EPL, modèle Poisson, backtest, boucle d'ajustement (`AdjustmentService`). Validation : Brier Score 0.592 (seuil ≤ 0.65), Calibration Error 2.5% (seuil ≤ 5%), ROI simulé +2.28% (seuil ≥ -5%) — le modèle bat le hasard sur 3 saisons EPL.

## Phase 2 — jalons principaux

- Sources live (API-Football), snapshot odds horodaté, ETL multi-ligue — au 2026-08-15, **26 compétitions actives** en production (`packages/db/src/seed.ts`), bien au-delà du périmètre initial PL/SA/LL/BL1.
- Kelly fractionnelle (0.25) livrée, derrière le flag `KELLY_ENABLED`.
- Bloc 6 (2026-08-15 et avant) : marché mi-temps/fin de match, déploiement production (VPS OVH, Nginx, HTTPS, CI/CD GitHub Actions → GHCR), fallback FRI pour les sélections nationales sans stats d'équipe. OpenClaw et Grafana **abandonnés** ; TimescaleDB abandonné (rétention `OddsSnapshot` par worker jugée suffisante).
- Bloc 7 (canaux CONF/BTTS/DRAW), puis Bloc 8 (2026-07-18, extension Niveau 1/2/2.b) : couverture complète de l'enum `Market`, un canal de prédiction dédié par marché plutôt que la seule sélection opportuniste par EV.
- Bloc 9-12 (2026-08-09 → 22) : reconstruction complète du générateur de coupon — admission par calibration plutôt que par ROI (sans puissance statistique au niveau coupon), routage AVOID gradué, pool multi-jours, classes de coupon par bande de cote. Résultat mesuré : ratio calibration réalisé/annoncé 0.819 → 1.016 par jambe ; ROI coupon -3.34% ± 4.32 — indistinguable de zéro, pas un profit.
- Bloc 13 (2026-08-22) : refonte d'Investir en 3 vues (Ce qu'on assume / En observation / Écarté), suppression de `topN` (non significatif dans les 5 configurations testées), `MAX_LEG_EDGE`/`MIN_LEG_ODDS` remontés au niveau de toute surface de mise. Détail complet dans [Moteur de prédiction et canaux](/dashboard/documentation-technique/prediction-engine-channels).

## Phase 3 — ML & scalabilité

- Préconditions DB validées (PgBouncer, index `ModelRun.analyzedAt`, table `ml_model_version`).
- Infrastructure `ml-worker` (Python) livrée : entraînement via queue BullMQ, `MlController` NestJS (`POST /ml/train`, activation/rollback/suppression de modèle).
- Couche de correction XGBoost + calibration scikit-learn livrée et tournant en **shadow mode** — le `BettingEngineService` logge la correction sans encore agir dessus. Bascule automatique prévue si le Brier Score s'améliore de ≥ 5% avec un cooldown de 7 jours, mais la **promotion hors shadow reste à décider** (`docs/phase3-ml-todo.md` étape 7ter).
- Gestion dynamique du drawdown et simulation Monte Carlo : non commencées.

## Refactors d'architecture livrés

- **Architecture des canaux de stratégie** (corrigée le 2026-08-15) : un canal = une stratégie de sélection backtestée par ligue/marché/saison, jamais un marché brut.
- **Familles de moteurs prédictifs** (cadrage 2026-08-17, livré pour VALUE/SAFE le 2026-08-18) : VALUE et SAFE deviennent des filtres de Phase 2 qui re-sélectionnent parmi les décisions déjà prises par les canaux de marché, au lieu de scanner indépendamment tous les marchés. Détail dans [Moteur de prédiction et canaux](/dashboard/documentation-technique/prediction-engine-channels).
- **Harnais de backtest partagé** (démarré 2026-08-17, non terminé) : `packages/backtest-core` assemble les données point-in-time (cotes, team stats, H2H, congestion) réutilisables par tout script de backtest, pour que ces scripts rejouent le pipeline réel au lieu de lire des décisions déjà enregistrées en base. Migration des scripts existants en cours. Détail dans [Packages partagés et base de données](/dashboard/documentation-technique/packages-database).

## Développements récents non encore reflétés dans ROADMAP.md

- **Canal `VANTAGE`** : déployé en production le 2026-08-28, porté par `apps/vantage-worker`. Un bug de gate sur le fournisseur de recherche web a été identifié et corrigé le 2026-08-29 (le gate ne vérifiait que le fournisseur LLM primaire alors que le fallback tournait réellement en prod). Détail dans [Workers ML et Vantage](/dashboard/documentation-technique/workers).
- **Proposition d'élargissement de contexte VANTAGE** : formalisée, pas encore implémentée. Détail dans [Workers ML et Vantage](/dashboard/documentation-technique/workers).

## Phase 4 — non commencée

SaaS/multi-tenant, API interne, groupe premium. Le seul développement de cette zone à ce jour est EVA (`analysis-sheet`), un flow d'analyse par fiche compacte envoyée à Groq en un seul appel — pas du tool-calling ni un chatbot persistant. L'ancien module `chat` (assistant conversationnel avec 18 tools, SSE) a été **entièrement remplacé** par ce flow le 2026-07-02 et supprimé du code.

## Extension multi-sport

Cadrée mais différée : `docs/multi-sport-extension.md` et `docs/prediction-engine-families.md` §1. Préconditions non remplies (edge football pas encore prouvé hors shadow ML, pas d'abstraction `sport` dans le schéma) — recherche uniquement, aucun code prévu tant que ces préconditions ne sont pas atteintes.

## Pour aller plus loin

- Travail ouvert au niveau code, y compris les risques assumés en attendant un backtest propre (ex. `BTTS_STAKED_LEAGUES` dont le ROI mesuré s'est inversé) : `TODO.md`.
- Historique complet bloc par bloc avec les mesures et décisions détaillées : `ROADMAP.md`.
