# EVCore — TODO

## Amélioration continue du modèle — Audit 20-28 mars 2026

Basé sur l'analyse des 6 audits (41 bets, 26.8% win rate global). Objectif : amélioration continue
sans désactivation de marchés — relèvement de seuils et extension des mécanismes existants.

### 1. Guard xG coverage par compétition ✅ IMPLÉMENTÉ (2026-03-29)

`getLeagueEvThreshold(competitionCode)` dans `ev.constants.ts` — EV threshold relevé par ligue :

- FRI / WCQE → 0.15 (xG coverage sparse : FRI 4%, WCQE ~9% zero-xG records)
- UNL → 0.12
- EL2 / F2 → 0.10 (sparser odds coverage, xG noise)
- Autres ligues → EV_THRESHOLD par défaut (0.08)

Propagé dans `listEvaluatedPicks` / `listViablePicks` / `selectBestViablePick` via `competitionCode`.

### 2. Brier score et calibration par marché ✅ IMPLÉMENTÉ (2026-03-29)

`CalibrationService.computeAllMarkets()` — calcule le Brier score pour ONE_X_TWO, OVER_UNDER
et BTTS indépendamment, avec exclusion des bets `lambdaFloorHit=true` par défaut.

**Reste à faire** : intégrer `computeAllMarkets()` dans `AdjustmentService.settleAndCheck()` pour
que la calibration par marché déclenche des proposals ciblés (pas seulement global).

### 3. lambdaFloorHit — isolation dans la calibration ✅ IMPLÉMENTÉ (2026-03-29)

`lambdaFloorHit` était déjà persisté dans le JSON `features` de `ModelRun`.
`computeForMarket(market, { excludeLambdaFloorHit: true })` filtre ces bets via Prisma JSON path.
`computeAllMarkets()` l'exclut par défaut.

**Reste à faire** : alerte `NotificationService` si taux de lambdaFloorHit > seuil (ex. > 20%)
sur une compétition donnée sur les 7 derniers jours.

### 4. Seuil de probabilité directionnelle par marché ✅ IMPLÉMENTÉ (2026-03-29)

`MIN_DRAW_DIRECTION_PROBABILITY = 0.28` dans `ev.constants.ts`.
`getPickRejectionReason` : si `pick === 'DRAW' && isCombo && P(draw) < 0.28` → `probability_too_low`.
Élimine les NUL+MOINS à P(nul)=19-27% qui passaient uniquement via cotes élevées (0/3 win rate).

### 5. EV threshold par ligue ✅ IMPLÉMENTÉ (2026-03-29)

Voir item 1 — couvert par `getLeagueEvThreshold()`.
`LEAGUE_MIN_ODDS_COVERAGE` non implémenté : couvert indirectement par la hausse du seuil EV.
EL1 (5 fixtures avec odds) : laissé à EV_THRESHOLD (0.08) — win rate 50% sur l'échantillon actuel.

---

## Observation — FRI / sélections nationales (2026-03-27)

Le moteur ne génère pas de model run pour les fixtures FRI quand les équipes n'ont pas de stats dans la saison FRI 2026-27, même si elles ont des stats dans d'autres compétitions de sélections (WCQE, UNL).

**Cause** : `analyzeFixture` filtre les `team_stats` par `afterFixture.seasonId = fixture.seasonId`. Norway a 14 stats (8 WCQE + 6 UNL, saison 2024-25) → 0 stats FRI 2026-27 → skip `missing_team_stats`.

**Impact** : coupon NO_BET sur FRI tant que les équipes n'ont pas de fixtures FRI terminées dans la saison en cours. Se résoudra naturellement au fil de la saison.

**Option à étudier** : lookup cross-compétition pour les sélections nationales — chercher les stats dans toutes les compétitions pour un même `teamId` (FRI + WCQE + UNL = même national team). Nécessite une décision de design avant d'implémenter.
