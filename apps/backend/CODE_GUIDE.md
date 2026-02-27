# Backend Code Guide

Guide de référence pour écrire du code backend cohérent dans `apps/backend`.

## 1. Principes

- Garder les modules petits et explicites.
- Isoler la logique métier dans les services.
- Centraliser les helpers réutilisables dans `src/utils/`.
- Éviter les "magic values" dans le code: utiliser `src/config/`.
- Préférer des changements testables sans dépendances infra (DB/Redis) quand possible.

## 2. Structure par module

- `*.controller.ts`: routing, validation d'input, aucun calcul métier.
- `*.service.ts`: logique métier et orchestration.
- `*.repository.ts`: accès Prisma uniquement.
- `*.module.ts`: wiring NestJS.
- `*.spec.ts`: tests unitaires colocated.

## 3. Imports et aliases

Utiliser les aliases TS/Vitest:

- `@/*` -> `src/*`
- `@config/*` -> `src/config/*`
- `@modules/*` -> `src/modules/*`
- `@utils/*` -> `src/utils/*`

Règle: préférer les aliases pour éviter les chemins relatifs fragiles.

## 4. Source de vérité utilitaires

- Dates: `src/utils/date.utils.ts`
  - Parsing ISO
  - Parsing Understat datetime
  - Fenêtre `±1 jour`
  - Fallback dates saison EPL
- Prisma Decimal: `src/utils/prisma.utils.ts`
- Saisons: `src/utils/season.utils.ts`
- Helpers rolling stats: `src/modules/rolling-stats/rolling-stats.utils.ts`
- Helpers ETL: `src/modules/etl/etl.utils.ts`

Ne pas dupliquer ces helpers dans les services/workers.

## 5. Validation et types

- Entrées externes (API/scraping): Zod obligatoire.
- Entrées HTTP: validation côté controller.
- Éviter `any`; typer les retours publics.
- Préférer `type` pour les shapes de données.

## 6. Données et logique métier

- Pas de `new Date(...)` ad hoc dans les modules: passer par `date.utils`.
- Pas de calcul financier/proba en `number` natif pour la logique sensible (utiliser `decimal.js`).
- Les règles métier doivent être couvertes par tests (ex: mapping statuts, delays BullMQ, form/xG rolling).

## 7. Tests

- Tester en priorité:
  - fonctions pures
  - services métier
  - schémas Zod
- Les tests qui nécessitent Redis/DB restent séparés (e2e/intégration).
- Ajouter un test pour chaque régression détectée.

## 8. Logs et erreurs

- Logs structurés (`pino`) avec contexte minimal utile (season, fixtureCount, ids, etc.).
- Messages d’erreur explicites et actionnables.
- Sur payload invalide: fail fast + log des issues de validation.

## 9. Checklist avant commit

- `pnpm --filter backend typecheck`
- `pnpm --filter backend lint`
- tests unitaires ciblés passent
- aucun helper dupliqué
- imports aliases cohérents
