# Vue d'ensemble

EVCore est un moteur autonome, probabiliste, de sélection de paris sportifs. Il analyse des matchs de football et **propose** des décisions — il ne place jamais de pari à la place d'un utilisateur. Ce n'est pas un chatbot ni un générateur de pronostics excitants : c'est un système décisionnel discipliné, mesurable et auto-calibré, construit pour survivre à la variance sur des centaines de paris plutôt que d'optimiser un résultat court terme.

Cette documentation technique décrit l'état réel du code au 2026-08-30. Elle remplace les parties périmées de `EVCORE.md` (la spécification produit d'origine) et de `README.md`, qui datent tous les deux d'avant l'extension à ~19 canaux et avant les apps `ml-worker`/`vantage-worker`.

## Ce que le système fait, et ne fait jamais

- Il ne place jamais de pari — il propose des décisions que l'utilisateur exécute lui-même.
- Il ne dépend jamais du LLM pour ses données brutes ou ses probabilités : tout scoring est déterministe (Poisson, taux de base empiriques, cotes bookmaker dévigées).
- Le LLM (OpenClaw historiquement, aujourd'hui le canal `VANTAGE` porté par `vantage-worker`) est censé intervenir uniquement en raffinement contextuel, plafonné à 30% du score, jamais comme source de données primaire — **règle produit non encore câblée en code** : `VANTAGE` tourne aujourd'hui comme un canal déterministe classique, sans injection de delta LLM dans l'EV (détail dans [Backend NestJS](/dashboard/documentation-technique/backend)).
- Le backend NestJS est toujours l'autorité finale de validation — aucune sortie LLM ne contourne un schéma Zod.

## Deux résultats mesurés qui priment sur l'intuition d'origine

Deux constats d'audit (2026-08-22, `docs/audit-canaux-investir-2026-08-22.md`) annulent des hypothèses qui structuraient encore une partie de la documentation historique. Ils sont rappelés dans chaque page technique où ils s'appliquent :

- **L'edge revendiqué (`p − 1/cote`) est anti-prédictif.** Sur 51 860 sélections réglées, le taux réel reste plat (0.511 → 0.375) pendant que le taux annoncé grimpe (0.481 → 0.699). Il sert désormais de **plafond** (`MAX_LEG_EDGE = 0.10`) sur toute surface de mise, jamais de seuil de sélection. Le classement se fait partout sur la probabilité calibrée.
- **Le ROI au niveau coupon n'a aucune puissance statistique** aux volumes actuels (erreur standard de 13 à 18 points pour des écarts de 10 points). La boucle d'apprentissage et toute décision de calibration tournent au niveau de la jambe (leg), jamais au niveau du coupon.

## Nomenclature

Les canaux sont toujours désignés par leur code anglais dans le code et dans cette documentation : `DRAW`, `SAFE`, `VALUE`, `BTTS`, `DOUBLE_CHANCE`, etc. Les anciens tags français (`NUL`, `SV`, `BB`, `CONF`) ont été retirés du code et ne doivent plus être utilisés comme identifiants — ils n'apparaissent ici que pour référence historique quand c'est utile.

## Structure du monorepo

Le projet est un monorepo pnpm géré par Turborepo (`pnpm` v9, Node >= 18).

- `apps/backend` — API NestJS + moteur de paris (autorité finale, ETL, calibration). Voir [Backend NestJS](/dashboard/documentation-technique/backend).
- `apps/web` — dashboard Next.js (App Router), l'interface utilisateur. Voir [Frontend web](/dashboard/documentation-technique/frontend-web).
- `apps/ml-worker` — couche de correction ML shadow, ne pilote pas le scoring principal. Voir [Workers ML et Vantage](/dashboard/documentation-technique/workers).
- `apps/vantage-worker` — canal LLM contextuel `VANTAGE`, en production depuis le 2026-08-28. Voir [Workers ML et Vantage](/dashboard/documentation-technique/workers).
- `packages/db` — schéma Prisma + client partagé (`@evcore/db`).
- `packages/analysis-core` — noyau probabiliste pur, en cours d'extraction pour permettre au backtest de rejouer le pipeline réel.
- `packages/backtest-core` — logique de backtest partagée, assemblage des données point-in-time.
- `packages/ui` — bibliothèque de composants React partagée (shadcn/ui).
- `packages/transactional` — templates transactionnels partagés.

Détail dans [Packages partagés et base de données](/dashboard/documentation-technique/packages-database).

> Correction par rapport au `README.md` racine : celui-ci ne liste que `apps/backend` et `apps/web`, et référence `OPENCLAW.md`/`GRAFANA.md` qui n'existent plus dans le repo — OpenClaw et Grafana ont été **abandonnés** (voir `ROADMAP.md`, Bloc 6), remplacés respectivement par le canal `VANTAGE` et par l'absence de dashboard dédié (monitoring en base directement).

## Sommaire de cette documentation

- [Architecture et flux de données](/dashboard/documentation-technique/architecture)
- [Backend NestJS](/dashboard/documentation-technique/backend)
- [Moteur de prédiction et canaux](/dashboard/documentation-technique/prediction-engine-channels)
- [Frontend web](/dashboard/documentation-technique/frontend-web)
- [Workers ML et Vantage](/dashboard/documentation-technique/workers)
- [Packages partagés et base de données](/dashboard/documentation-technique/packages-database)
- [État d'avancement et roadmap](/dashboard/documentation-technique/etat-avancement)

## Où trouver le reste

- Spécification produit d'origine (partiellement périmée, corrections indiquées dans cette documentation) : `EVCORE.md`
- Suivi d'avancement détaillé bloc par bloc : `ROADMAP.md`
- Travail ouvert au niveau code : `TODO.md`
- Conventions de code et règles produit non négociables : `CLAUDE.md`
- Glossaire métier : [Documentation EVCore (glossaire)](/dashboard/glossaire)
