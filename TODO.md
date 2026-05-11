# EVCore — TODO

---

## Module `ai-engine` — Compositeur de coupons piloté par les signaux

### Objectif

Module NestJS autonome qui analyse les tendances récentes des canaux (EV/SV/BB/NUL/CONF) sur une fenêtre glissante configurable, score les picks disponibles du jour, et génère des propositions de coupons dans une fourchette de cote cible [4–50].

Phase 1 : entièrement déterministe. Point d'entrée propre prévu pour brancher un LLM ou un modèle ML sans refactoriser.

---

### Contraintes de génération

- **Déclenchement** : 10 minutes après la fin du betting-engine (`BET_ANALYZED` event ou job chain BullMQ)
- **Idempotence** : upsert par `(forDate, signalWindowDays, targetOddsMin, targetOddsMax)` — relancer N fois le même jour ne crée pas de doublons
- **Volume** : 1 ou plusieurs coupons par génération selon les signaux disponibles
- **Pas de coupon** si le pool du jour contient < 2 fixtures distinctes (pas de diversification possible)

---

### Schema Prisma — nouveaux modèles

- [ ] Ajouter enums `CouponLegCanal` (EV/SV/BB/NUL/CONF), `CouponProposalStatus` (PENDING/ACCEPTED/REJECTED/EXPIRED), `CouponResult` (WON/LOST/PARTIAL/VOID)
- [ ] Ajouter model `CouponProposal` avec champs :
  - `forDate`, `signalWindowDays`, `targetOddsMin`, `targetOddsMax`
  - `combinedOdds`, `jointProbability`, `signalScore`
  - `status`, `result`, `reasoning` (Json)
  - `lastFixtureScheduledAt` — scheduledAt du dernier événement du coupon (pour le settlement)
  - index `[status, lastFixtureScheduledAt]` pour le job de settlement
- [ ] Ajouter model `CouponProposalLeg` avec champs :
  - `canal` (CouponLegCanal), `market`, `pick`
  - `probability`, `oddsSnapshot`, `signalScore`
  - `featureSnapshot` (Json — lambda, gap, dayFactor, leagueFactor au moment de la génération)
  - `isCorrect`, `settledAt`
  - Pas de FK vers `Bet` ou `Prediction` — entité autonome
- [ ] Ajouter back-relation `couponLegs CouponProposalLeg[]` dans `Fixture` uniquement
- [ ] Générer et appliquer la migration Prisma

---

### Module NestJS `ai-engine`

```
apps/backend/src/modules/ai-engine/
  ai-engine.module.ts
  ai-engine.controller.ts       # GET /ai-engine/coupons?date=&window=14&oddsMin=4&oddsMax=50
  ai-engine.service.ts          # orchestration : signal → score → compose → persist
  signal-window.service.ts      # DB queries : hit rates récents, features, volume par canal
  coupon-composer.service.ts    # combinatoire picks → coupons dans [oddsMin, oddsMax]
  coupon-settlement.service.ts  # settle legs via fixture scores déjà en DB
  ai-engine.repository.ts       # accès Prisma uniquement ici
  dto/
    coupon-query.dto.ts
    coupon-proposal.dto.ts
```

- [ ] `AiEngineModule` — déclarer, importer dans `AppModule`
- [ ] `AiEngineRepository` — CRUD `CouponProposal` + `CouponProposalLeg` avec upsert idempotent
- [ ] `SignalWindowService` — calcule sur N derniers jours :
  - taux de réussite par canal × ligue × jour de semaine
  - volume journalier par canal (filtre si < 2 picks/jour médian)
  - features moyennes des picks corrects (lambda, gap score, probabilité)
- [ ] `CouponComposerService` — score et combine :
  - `scorePickPool(picks, signalWindow)` → picks scorés par `signal_strength × day_factor × volume_factor × league_factor`
  - `composeCoupons(scoredPicks, oddsMin, oddsMax)` → permutations 1-leg à N-leg, filtre sur la fourchette de cote, tri par `jointProbability` décroissante
  - Règle de diversité : max 1 pick par fixture dans un même coupon
- [ ] `AiEngineService` — orchestration complète avec idempotence :
  - Vérifie si un coupon pour `(forDate, window, oddsMin, oddsMax)` existe déjà → update sinon insert
  - Trigger après betting-engine via BullMQ (délai 10 min)
- [ ] `AiEngineController` — endpoint REST pour consulter et déclencher manuellement
- [ ] DTO + validation `class-validator`

---

### Settlement

- [ ] `CouponSettlementService.settle(proposalId)` :
  - Charge les legs + fixtures avec `homeScore`, `awayScore` depuis la DB
  - Si fixture sans score → skip (retry au prochain cycle)
  - Calcule `isCorrect` par `(market, pick, homeScore, awayScore)` — même logique que le bet settlement existant
  - Met à jour `leg.isCorrect`, `leg.settledAt`
  - Calcule `CouponResult` : WON (tous corrects) / PARTIAL / LOST / VOID
  - Met à jour `proposal.result`, `proposal.status → EXPIRED`
- [ ] Job BullMQ ou cron toutes les 30 min :
  - `WHERE status = PENDING AND lastFixtureScheduledAt + 90min ≤ NOW()`
  - Appelle `settle()` pour chaque proposal éligible

---

### Page web — `/dashboard/coupons`

**Concept** : vitrine musée — chaque coupon est exposé comme un maillot dans une display case. Sobre, premium, aéré.

- [ ] Route `apps/web/app/dashboard/coupons/page.tsx` + `coupons-page-client.tsx`
- [ ] Entrée nav dans `app-shell.tsx` + clé `next-intl` `nav.coupons`
- [ ] FilterBar avec **date picker uniquement** (les coupons sont par jour) + filtre statut (ALL / PENDING / WON / LOST / PARTIAL / EXPIRED)
- [ ] `CouponCard` — la display case :
  - Cote combinée en grand (le numéro de maillot) — badge proéminent
  - Prob conjointe + signal score en sous-titre
  - Liste des legs : canal badge (EV/SV/BB/CONF) + match + pick + cote individuelle
  - Badge statut (PENDING / ACCEPTED / EXPIRED) et résultat (WON ✓ / LOST ✗ / PARTIAL) en overlay coin supérieur droit
  - Layout vitrine : grille 2-3 colonnes desktop, 1 colonne mobile
- [ ] État vide : message "Aucun coupon généré pour cette date"
- [ ] Endpoint backend `GET /ai-engine/coupons?date=YYYY-MM-DD&status=ALL` consommé côté server component

---

### Tests

- [ ] Unit tests `SignalWindowService` — mock repository, vérifier calcul hit rates
- [ ] Unit tests `CouponComposerService` — vérifier combinatoire, filtre cote, idempotence du score
- [ ] Unit tests `CouponSettlementService` — vérifier tous les cas (WON/LOST/PARTIAL/VOID/score manquant)
- [ ] Test idempotence : lancer la génération 3 fois sur la même date → 0 doublon en DB
