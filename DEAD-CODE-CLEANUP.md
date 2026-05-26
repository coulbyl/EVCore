# Dead Code Cleanup Plan

Analyse réalisée le 2026-05-26. Couverture : `apps/web/` + `apps/backend/`.

---

## Résumé

| Métrique | Valeur |
|---|---|
| Fichiers morts identifiés | 16 |
| Lignes à supprimer | ~1 324 |
| Risque global | **Faible** |

---

## Section 1 — Fichiers à supprimer entièrement

### Frontend (`apps/web/`)

#### Composants picks (ancien rendu, remplacé par `PickListItem`)

| Fichier | Lignes | Motif |
|---|---|---|
| `apps/web/app/dashboard/picks/components/pick-card.tsx` | 382 | `EvPickCard`, `SvPickCard`, `ConfPickCard` jamais importés — la page utilise `PickListItem` dans `picks-page-client.tsx` |

#### Composants dashboard orphelins

| Fichier | Lignes | Motif |
|---|---|---|
| `apps/web/app/dashboard/components/active-alerts.tsx` | 59 | `ActiveAlerts` jamais importé |
| `apps/web/app/dashboard/components/channel-health-strip.tsx` | 127 | `ChannelHealthStrip` jamais importé |
| `apps/web/app/dashboard/components/kpi-cards.tsx` | 14 | `KPICards` jamais importé |
| `apps/web/app/dashboard/components/pipeline-status.tsx` | 51 | `PipelineStatus` jamais importé |
| `apps/web/app/dashboard/components/dashboard-constants.ts` | 39 | Constants locales jamais utilisées |

#### Composants sous-pages orphelins

| Fichier | Lignes | Motif |
|---|---|---|
| `apps/web/app/dashboard/formation/components/formation-back-button.tsx` | 24 | `FormationBackButton` jamais importé |
| `apps/web/app/dashboard/params/account/components/avatar-section.tsx` | 159 | `AvatarSection` jamais importé |
| `apps/web/app/(public)/auth/components/logout-button.tsx` | 42 | `LogoutButton` jamais importé |

#### Composants partagés inutiles

| Fichier | Lignes | Motif |
|---|---|---|
| `apps/web/components/table-card.tsx` | 32 | Wrapper jamais utilisé |
| `apps/web/components/fixture-status-badge.tsx` | 22 | Composant orphelin |
| ~~`apps/web/components/charts/index.ts`~~ | — | **Faux positif** — utilisé par `performance/` via `@/components/charts` ; conservé |

#### Hooks inutiles

| Fichier | Lignes | Motif |
|---|---|---|
| `apps/web/hooks/use-wc2026-celebration.ts` | 17 | Hook jamais appelé |
| `apps/web/hooks/use-dashboard-summary.ts` | 3 | Simple re-export contourné — importer directement depuis `@/domains/dashboard/use-cases/get-dashboard-summary` |

### Backend (`apps/backend/`)

| Fichier | Lignes | Motif |
|---|---|---|
| `apps/backend/src/modules/bet/dto/create-user-bet.dto.ts` | 12 | `CreateUserBetDto` jamais importé dans aucun controller/service |

---

## Section 2 — Scripts à documenter (ne pas supprimer)

Ces fichiers sont découplés du système et s'exécutent manuellement. Pas de risque, mais à documenter.

| Fichier | Action |
|---|---|
| `apps/backend/scripts/backtest-data-audit.ts` | Ajouter un commentaire en tête de fichier expliquant son usage (`tsx scripts/backtest-data-audit.ts`) |
| `apps/backend/src/scripts/backtest-investment.ts` | Idem (`node dist/scripts/backtest-investment.js`) |

---

## Section 3 — Cascade (symboles devenus morts après Section 1)

Aucune dépendance transitive détectée. Tous les imports des fichiers morts (`Badge`, `CanalBadge`, `formatKickoff`, `FixtureRow`, etc.) sont utilisés ailleurs dans le projet.

---

## Section 4 — Plan d'exécution

### Priorité haute — risque nul

```bash
# Picks - ancien rendu
rm apps/web/app/dashboard/picks/components/pick-card.tsx

# Dashboard
rm apps/web/app/dashboard/components/active-alerts.tsx
rm apps/web/app/dashboard/components/channel-health-strip.tsx
rm apps/web/app/dashboard/components/kpi-cards.tsx
rm apps/web/app/dashboard/components/pipeline-status.tsx
rm apps/web/app/dashboard/components/dashboard-constants.ts

# Composants partagés
rm apps/web/components/table-card.tsx
rm apps/web/components/fixture-status-badge.tsx
rm apps/web/components/charts/index.ts

# Hooks
rm apps/web/hooks/use-wc2026-celebration.ts
rm apps/web/hooks/use-dashboard-summary.ts

# Backend DTO
rm apps/backend/src/modules/bet/dto/create-user-bet.dto.ts
```

### Priorité moyenne — vérifier l'historique git avant

```bash
# Vérifier si du travail en cours sur ces fichiers
git log --oneline apps/web/app/dashboard/formation/components/formation-back-button.tsx
git log --oneline apps/web/app/dashboard/params/account/components/avatar-section.tsx
git log --oneline apps/web/app/(public)/auth/components/logout-button.tsx

# Si dernière modification > 4 semaines et aucun WIP :
rm apps/web/app/dashboard/formation/components/formation-back-button.tsx
rm apps/web/app/dashboard/params/account/components/avatar-section.tsx
rm apps/web/app/(public)/auth/components/logout-button.tsx
```

### Validation post-suppression

```bash
pnpm typecheck
pnpm lint
pnpm build
```

---

## À ne pas supprimer (faux positifs)

| Fichier | Raison |
|---|---|
| `apps/web/i18n.ts` | Chargé via `createNextIntlPlugin()` dans `next.config.js` |
| `apps/web/proxy.ts` | Convention Next.js (renommé `proxy.ts`), auto-chargé |
| `*.spec.ts`, `*.e2e-spec.ts` | Tests |
| Tout `*.module.ts` NestJS | Déclarations de module, pas d'import direct attendu |
| Guards/interceptors enregistrés via `APP_GUARD` / `APP_INTERCEPTOR` | Injectés par DI, pas importés directement |
