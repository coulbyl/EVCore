# EVCore — TODO

> Archives : [TODO_MOIS_1_ARCHIVE.md](TODO_MOIS_1_ARCHIVE.md), [TODO_MOIS_2_ARCHIVE.md](TODO_MOIS_2_ARCHIVE.md)
> Blocs 1–6 terminés (voir archives). Phase 2 moteur validée.
> Rapport d'audit : [packages/db/reports/MODEL_AUDIT_REPORT.md](packages/db/reports/MODEL_AUDIT_REPORT.md)

---

## Bloc 7 — Corrections post-audit moteur (21 mars 2026)

> Feu vert donné pour toutes les corrections issues du rapport d'audit MODEL_AUDIT_REPORT.md.
> Win rate weekend 20-21 mars : 16.7% (2/12). 5 biais structurels identifiés.

### 7.1 Corrections immédiates (constants + filtres)

- [x] **EV_HARD_CAP = 1.00** — rejeter tout pick avec EV > 1.00 (`ev_above_hard_cap`)
  - Fichier : `apps/backend/src/modules/betting-engine/ev.constants.ts`
  - Motif : 4 picks EV > 0.86 ont tous perdu — EV > 1 indique une erreur de calibration, pas un vrai edge
- [x] **EV_MAX_SOFT_ALERT = 0.60** — log warning si EV du pick sélectionné > 0.60
  - Fichier : `apps/backend/src/modules/betting-engine/betting-engine.service.ts`
  - Motif : Signal d'alerte précoce pour investigation manuelle
- [x] **MIN_PICK_DIRECTION_PROBABILITY = 0.45** — bloquer V1 si P(home) < 45% et V2 si P(away) < 45%
  - Fichiers : `ev.constants.ts` + `betting-engine.service.ts`
  - Motif : Guingamp sélectionné avec P(V1)=36% — incohérent de parier sur une équipe que le modèle trouve perdante

### 7.2 Recalibration des lambdas

- [x] **AWAY_DISADVANTAGE_LAMBDA_FACTOR : 0.88 → 0.93**
- [x] **HOME_ADVANTAGE_LAMBDA_FACTOR : 1.12 → 1.07**
  - Fichier : `apps/backend/src/modules/betting-engine/ev.constants.ts`
  - Motif : 4/5 cas λA < 0.6, l'équipe ext. a marqué. Le facteur 0.88 sur-pénalise (littérature : 5-8%, pas 12%)

### 7.3 Recalibration xG proxy

- [x] **XG_SHOTS_PROXY_FACTOR : 0.35 → 0.40**
  - Fichier : `apps/backend/src/config/etl.constants.ts`
  - Motif : 5/5 UNDER perdus, écart moyen +2.15 buts. Le proxy 0.35 sous-estime systématiquement les buts réels

### 7.4 MODEL_SCORE_THRESHOLD différencié par ligue

- [x] Remplacer le scalaire 0.60 par une map par code de compétition
  - Tier A (PL, SA, BL1, LL) — marchés efficients : **0.55**
  - Tier B (CH, D2, F2, SP2, I2) — marchés secondaires : **0.45**
  - Tier C (LDC, UEL, UECL) — compétitions européennes : **0.45**
  - Default fallback : **0.60**
  - Fichiers : `ev.constants.ts` (map + helper `getModelScoreThreshold()`) + `betting-engine.service.ts`
  - Motif : 7 fixtures NO_BET avec picks gagnants bloqués (Derby 0.596, Cesena 0.349, etc.)

---

## Bloc 8 — Live test 22 mars + itération post-résultats (23 mars 2026)

> Live backtest du nouveau moteur (Bloc 7) sur 13 BETs générés le 22 mars.
> EV soft alerts confirmés dans les logs : Burgos V2 (EV=0.942), Münster V2+PLUS (EV=0.842).
> Attente des résultats pour calibrer les ajustements suivants.

### 8.1 Analyse post-match (après settlement du 22 mars)

- [ ] Générer l'audit du 22 : `pnpm --filter @evcore/db db:audit:fixtures 2026-03-22`
- [ ] Analyser les EV soft alerts : Burgos V2 (EV=0.942) et Münster V2+PLUS (EV=0.842)
  - Perdus → envisager durcir `EV_HARD_CAP` (1.00 → 0.80)
  - Gagnés → seuil 0.60 bien calibré, garder
- [ ] Analyser les picks `probability_too_low` bloqués — auraient-ils gagné ?
  - Beaucoup bloqués gagnants → assouplir `MIN_PICK_DIRECTION_PROBABILITY` (0.45 → 0.40)
  - Peu → garder 0.45
- [ ] Analyser le pattern MOINS 2.5 sur fort xG (Barcelona λH=2.33 xG=3.19, Real Madrid xG=2.51)
  - Biais récurrent → envisager filtre UNDER bloqué si λH+λA > 2.8

### 8.2 Ajustements potentiels (décision humaine après analyse)

- [ ] **EV_HARD_CAP** : 1.00 → 0.80 si picks EV 0.80–1.00 perdent systématiquement
- [ ] **MIN_PICK_DIRECTION_PROBABILITY** : 0.45 → 0.40 si trop de bons picks bloqués
- [ ] **Filtre UNDER sur fort xG** : bloquer si λH+λA > 2.8 (à valider sur données historiques)
- [ ] **MIN_SELECTION_ODDS 1.70** : confirmer ou réajuster selon performance des cotes <1.80

### 8.3 Améliorations moteur identifiées (indépendantes des résultats)

- [ ] **Shadow h2h / congestion** : calculés mais non intégrés au score final (6 fixtures h2h=1.0 le 22)
  - Activer via `FEATURE_FLAGS.SCORING.H2H` et `FEATURE_FLAGS.SCORING.CONGESTION`
  - Prérequis : valider l'impact sur les picks du 22 mars avant activation
- [ ] **L1 (Ligue 1)** : absent de `MODEL_SCORE_THRESHOLD_MAP` → tombe sur default 0.60
  - Décider Tier A ou Tier B (marché liquide mais moins efficient que PL/SA)
- [ ] **Vérifier couverture complète** des codes compétition actifs dans la threshold map (F2, I2, etc.)

---
