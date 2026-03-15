# EVCore — TODO Phase 2

> Plan de travail courant. Source de vérité détaillée : [ROADMAP.md](ROADMAP.md)
> Archives : [TODO_MOIS_1_ARCHIVE.md](TODO_MOIS_1_ARCHIVE.md), [TODO_MOIS_2_ARCHIVE.md](TODO_MOIS_2_ARCHIVE.md)

---

## Blocs terminés ✅

| Bloc   | Contenu                                                                                              | Tests |
| ------ | ---------------------------------------------------------------------------------------------------- | ----- |
| Bloc 1 | Odds live (odds-live-sync), ETL multi-ligue, multi-compétitions CSV                                  | 184   |
| Bloc 2 | ETL hardening, pipeline live validé prod, Kelly fractionnelle (`KELLY_ENABLED`)                      | 200   |
| Bloc 3 | Daily Coupon Generator (COMBO_WHITELIST, CouponService, CouponWorker, shadow scoring, line movement) | 204   |

---

## Bloc 4 — Shadow Data Collection + auto-activation _(suivant)_

### Shadow services (données collectées, scores non intégrés au moteur)

- [x] ETL worker `injuries-sync`
  - Appel `/injuries?fixture=:id` pour chaque fixture SCHEDULED post-fixtures-sync
  - Stockage dans `ModelRun.features.shadow_injuries` (count blessés clés par équipe)
  - Zod schema + tests unitaires worker
- [x] `H2HService`
  - 5 dernières confrontations directes depuis fixtures DB (pas d'appel API)
  - Score H2H : ratio victoires côté favori, loggé en `shadow_h2h`
  - `FEATURE_FLAGS.SCORING.H2H = false` (shadow seulement)
- [x] `CongestionService`
  - Jours depuis dernier match + nombre de fixtures dans les 4 prochains jours
  - Score congestion normalisé, loggé en `shadow_congestion`
  - `FEATURE_FLAGS.SCORING.CONGESTION = false` (shadow seulement)

### Boucle d'auto-activation

- [x] `AdjustmentService.computeShadowCorrelations()` — corrélation Spearman entre chaque `shadow_*` et les outcomes réels sur les 50+ derniers bets settlés
- [x] Auto-activation si |rho| > 0.15 : `FEATURE_FLAGS.SCORING.<feature> = true`, `AdjustmentProposal` appliqué automatiquement
- [ ] Rollback via `POST /adjustment/:id/rollback` (existant)
- [x] Tests unitaires corrélation Spearman (cas limites : < 50 bets, rho faible, rho fort)

---

## Bloc 5 — Coupon settlement + résultats live

- [x] `CouponService.settleExpiredCoupons(date)` — settle les DailyCoupon PENDING dont tous les bets sont WON/LOST/VOID
  - `DailyCoupon.status` → WON (tous WON), LOST (≥ 1 LOST), SETTLED (VOID uniquement)
  - Déclenché post `AdjustmentService.settleAndCheck()` ou par cron séparé
- [x] `NotificationService.sendCouponResult(couponId)` — email récap résultat coupon
- [x] Endpoint `POST /coupon/:id/settle` (manuel, pour tests en prod)
- [x] Tests unitaires `settleExpiredCoupons`

---

## Bloc 6 — Suite Phase 2

- [x] **Configuration compétitions en base (source de vérité DB)**
  - [x] `Competition` enrichie: `leagueId`, `isActive`, `csvDivisionCode`, `seasonStartMonth`, `activeSeasonsCount`
  - [x] Migration SQL + backfill des 10 compétitions
  - [x] Seed Prisma `src/seed.ts` (createMany, skip si table non vide)
  - [x] ETL workers alignés pour persister ces champs à l'upsert

- [x] **Marché Mi-temps/Fin de match** (HT/FT combo, nouveau bet type)
  - [x] Fondations backend HT/FT: `Market.HALF_TIME_FULL_TIME`, scores mi-temps (`homeHtScore/awayHtScore`), settlement HT/FT
  - [x] Probas HT/FT dérivées du modèle Poisson (`htft` sur 9 issues)
  - [x] Ingestion odds live HT/FT (`Half Time / Full Time`) + persistance `OddsSnapshot`
  - [x] Sélection EV/qualityScore étendue au marché HT/FT
- [x] **Stabilité first prod (sans TimescaleDB)**
  - [x] Cleanup automatique `OddsSnapshot` (job ETL `odds-snapshot-retention`, rétention configurable)
  - [x] Coupon multi-jours (fenêtre 1-3 jours) pour combiner 2-3 journées de matchs
  - [x] Tuning rate-limit/quota API-Football (estimation appels/jour + alerte de budget au boot)
- [~] **Activation 10 ligues (A + B)**
  - [x] Vague 1 active: `PL`, `SA`, `LL`, `BL1`, `L1`
  - [ ] Vague 2 à activer: `CH`, `I2`, `SP2`
  - [ ] Vague 3 à activer: `D2`, `F2`
  - [ ] Validation post-vague: ETL success rate, couverture odds, quota API, délai coupon
- [ ] **OpenClaw** — `STAND-BY POST-PROD` (voir `OPENCLAW.md`)
  - Activation après 30+ jours prod stables, d'abord en shadow mode
  - Contraintes: delta ≤ 30%, validation Zod stricte, temperature 0, fallback déterministe
- [ ] **Grafana** — `STAND-BY POST-PROD` (voir `GRAFANA.md`)
  - Activation quand le monitoring manuel (logs/SQL) n'est plus suffisant
- [ ] **TimescaleDB** (odds snapshots haute fréquence, remplacement OddsSnapshot Postgres)
- [ ] **Multi-bookmakers** (Betclic, Unibet)

### Reprise — prochaines actions prioritaires

- [ ] Basculer l'ETL sur lecture DB des compétitions actives (retirer la dépendance au static `COMPETITIONS` dans `etl.constants.ts`)
- [ ] Ajouter un endpoint/admin script pour activer/désactiver une compétition (`isActive`) sans redéploiement
- [ ] Ajouter des tests ETL sur le chargement dynamique des compétitions (cas: aucune active, vague 1/2/3)
- [ ] Exécuter migration + seed sur l'environnement de pré-prod, puis valider les jobs planifiés

### Migration canonique coupons (mars 2026)

- [x] Ajouter relation pivot `coupon_leg` (coupon ↔ bet) + backfill depuis `bet.dailyCouponId`
- [x] Passer les lectures/écritures coupon backend sur `coupon_leg`
- [x] Canonicaliser les bets avec `fixtureId + pickKey` (unique DB) pour éviter les doublons de pick
- [x] Adapter la génération de coupon pour réutiliser le bet existant (`upsert`) au lieu de créer un nouveau leg
- [x] Ajouter migration de réconciliation (`20260314192000_reconcile_preexisting_schema`) pour éviter `migrate reset` sur base existante
- [ ] Vérifier en pré-prod les compteurs post-migration (nombre coupons, legs par coupon, statuts WON/LOST/PENDING)
- [ ] Planifier la suppression finale de `bet.dailyCouponId` après stabilisation

---

## Bloc 7 — App Web V1 (Dashboard / Coupons / Audit)

> Objectif: rendre `apps/web` réellement exploitable comme interface d'observation EVCore, sans attendre une UI complète de prod.

### Direction visuelle retenue

- [ ] Partir d'une esthétique "console opérateur" proche de `possible-design-with-shadcn-ui.png`
- [ ] Conserver la structure générale:
  - [ ] sidebar sombre fixe
  - [ ] surface de travail claire
  - [ ] cartes KPI en tête
  - [ ] grand panneau central pour charts + tables
  - [ ] colonne droite pour détails et activité
- [ ] Adapter cette base au produit EVCore, pas en faire un admin panel générique
- [ ] Réduire l'effet template:
  - [ ] moins de bleu par défaut
  - [ ] statuts métier plus visibles
  - [ ] densité de données plus assumée
- [ ] Prioriser desktop/tableau de bord opérateur, puis responsive mobile

### Cadrage produit

- [ ] Positionner `apps/web` comme console opérateur EVCore, pas comme vitrine marketing
- [ ] Remplacer totalement le scaffold Next.js actuel (`page.tsx`, metadata, assets par défaut)
- [ ] Définir une navigation simple à 3 écrans:
  - [ ] `Dashboard`
  - [ ] `Coupons`
  - [ ] `Audit`
- [ ] Fixer une règle de data loading V1:
  - [ ] SSR pour les vues stables
  - [ ] refresh manuel ou polling léger pour les données qui bougent

### ⚡ PRIORITAIRE — Section P&L Dashboard

- [ ] **Backend** — query bets settlés (WON/LOST) dans `DashboardRepository`
  - [ ] ROI : `(gains - mises) / mises × 100`
  - [ ] Taux de réussite : `bets WON / bets settlés`
  - [ ] Gain net en unités de stake
  - [ ] Compteur bets settlés / total
- [ ] **Types** — ajouter `pnlSummary` à `DashboardSummary` (backend + frontend)
- [ ] **Frontend** — section P&L sur le dashboard (valeurs à zéro jusqu'aux premiers résultats)

---

### Écran 1 — Dashboard

- [ ] Afficher l'état ETL global:
  - [ ] queues/job status
  - [ ] dernière exécution par worker
  - [ ] alertes actives / anomalies récentes
- [ ] Afficher les métriques d'activité:
  - [ ] nombre de fixtures `SCHEDULED` aujourd'hui / demain
  - [ ] nombre de fixtures avec odds
  - [ ] nombre de `modelRuns`
  - [ ] nombre de bets `BET` / `NO_BET`
- [ ] Afficher les derniers coupons générés:
  - [ ] date
  - [ ] statut
  - [ ] nombre de legs
  - [ ] lien vers le détail coupon

### Écran 2 — Coupons

- [ ] Lister les coupons récents
  - [ ] filtre par date
  - [ ] filtre par statut
  - [ ] pagination simple
- [ ] Afficher le détail d'un coupon:
  - [ ] legs
  - [ ] marchés / picks
  - [ ] odds / probability / EV / qualityScore
  - [ ] source batch d'analyse
- [ ] Rendre visible le concept métier important:
  - [ ] plusieurs coupons peuvent exister pour une même date
  - [ ] chaque coupon est un pari potentiel autonome

### Écran 3 — Audit

- [ ] Vue fixtures du jour / date choisie
- [ ] Faire de l'écran `Audit` l'équivalent web complet de `db-stats`
- [ ] Reprendre toutes les sections utiles de `packages/db/scripts/db-stats.ts`
  - [ ] snapshot DB global
  - [ ] breakdown par ligue
  - [ ] scheduled fixtures audit
  - [ ] coupon eligibility audit
  - [ ] zero-xG audit
  - [ ] coupons / bets / modelRuns / notifications selon pertinence opérateur
- [ ] Afficher par fixture:
  - [ ] ligue
  - [ ] équipes
  - [ ] `BET` / `NO_BET`
  - [ ] deterministicScore
  - [ ] meilleur candidat
  - [ ] raison principale du rejet si `NO_BET`
- [ ] Exposer les signaux de diagnostic utiles:
  - [ ] `hasOdds`
  - [ ] `lineMovement`
  - [ ] `h2hScore`
  - [ ] `congestionScore`
  - [ ] `lambdaFloorHit`
- [ ] Prévoir un accès lisible aux logs d'analyse utiles sans afficher du JSON brut illisible

### Backend/API nécessaires pour la V1 web

- [ ] Hypothèse V1: aucune authentification, toutes les routes web nécessaires sont publiques
- [ ] Ajouter un endpoint résumé pour le `Dashboard`
  - [ ] agrège ETL + fixtures + bets + coupons
- [ ] Ajouter un endpoint liste des coupons
- [ ] Ajouter un endpoint détail coupon avec legs
- [ ] Ajouter un endpoint audit fixtures/date
- [ ] Ajouter des endpoints backend dédiés pour chaque section de `db-stats`
  - [ ] éviter le rendu d'un fichier texte brut
  - [ ] exposer des réponses JSON stables pour le frontend
- [ ] Prévoir éventuellement un endpoint agrégé `audit/overview` pour limiter les allers-retours frontend
- [ ] Standardiser les DTO de réponse pour la web app
- [ ] Éviter d'exposer les structures internes Prisma brutes
- [ ] Ajouter les tests unitaires/controller sur ces endpoints

### App Web — architecture

- [ ] Définir une arborescence claire dans `apps/web/app`
  - [ ] `/dashboard`
  - [ ] `/coupons`
  - [ ] `/coupons/[id]`
  - [ ] `/audit`
- [ ] Mettre en place un client API léger côté web
- [ ] Centraliser:
  - [ ] types de réponse
  - [ ] helpers de formatage dates / cotes / EV
  - [ ] états `loading / empty / error`
- [ ] Prévoir une base de filtres URL-driven (`searchParams`) pour audit et coupons

### `packages/ui` + Tailwind CSS

- [ ] Faire de `packages/ui` la base de composants partagés de la web app
- [ ] Ajouter Tailwind CSS proprement pour `apps/web` et `packages/ui`
- [ ] Définir la stratégie de partage UI:
  - [ ] composants structurels dans `packages/ui`
  - [ ] composition métier dans `apps/web`
- [ ] Créer un socle minimum de composants UI réutilisables:
  - [ ] `PageShell`
  - [ ] `TopNav`
  - [ ] `StatCard`
  - [ ] `DataTable`
  - [ ] `EmptyState`
  - [ ] `Badge`
  - [ ] `FilterBar`
  - [ ] `SectionHeader`
- [ ] Revoir les composants existants `packages/ui`
  - [ ] enlever les résidus `create-turbo`
  - [ ] nettoyer `Card`
  - [ ] vérifier `Code` / `Button`
- [ ] Définir un thème visuel EVCore:
  - [ ] variables de couleur
  - [ ] fond clair texturé / panneaux nets / sidebar sombre
  - [ ] typographie UI + typo mono pour chiffres, cotes, EV et logs
  - [ ] spacing
  - [ ] états de statut (`BET`, `NO_BET`, `PENDING`, `WON`, `LOST`)
- [ ] Définir les conventions visuelles principales:
  - [ ] `BET` en vert contrôlé
  - [ ] `NO_BET` en rouge sec
  - [ ] `PENDING` en ambre
  - [ ] `WARN` en orange
  - [ ] `INFO` en bleu discret
- [ ] S'assurer que les composants `packages/ui` sont compatibles App Router / SSR

### Qualité / DX

- [ ] Ajouter lint/typecheck dédiés `apps/web`
- [ ] Ajouter tests minimums sur les composants critiques
- [ ] Ajouter doc de lancement `apps/web`
- [ ] Éviter de committer les artefacts `.next/` et `.turbo/`

### Ordre d'exécution recommandé

- [ ] 1. Nettoyer le scaffold `apps/web`
- [ ] 2. Poser Tailwind + base `packages/ui`
- [ ] 3. Ajouter les endpoints backend nécessaires
- [ ] 4. Implémenter `Dashboard`
- [ ] 5. Implémenter `Coupons`
- [ ] 6. Implémenter `Audit`
- [ ] 7. Finitions UX, empty states, erreurs, responsive

---

## Suivi

- [x] Bloc 1 terminé
- [x] Bloc 2 terminé
- [x] Bloc 3 terminé
- [ ] Bloc 4 en cours
- [x] Bloc 5 terminé
- [ ] Bloc 6 en cours
- [ ] Bloc 7 planifié
- [x] ROADMAP.md synchronisée (3 mars 2026)
