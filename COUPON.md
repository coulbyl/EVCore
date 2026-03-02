# COUPON.md — Générateur de coupon quotidien EVCore

> Ce document spécifie le comportement du générateur de coupon automatique.
> Il s'appuie sur le moteur de scoring défini dans [EVCORE.md](EVCORE.md) et s'intègre dans le pipeline décrit dans [ROADMAP.md](ROADMAP.md).

---

## Principe fondamental

**Un seul coupon par jour. Si des matchs sont programmés dans les ligues actives, le système génère automatiquement le meilleur coupon combiné possible. Ce coupon est ce qui sera joué.**

- Aucun tip subjectif — 100% déterministe (EV + score du modèle)
- Toutes les ligues `isActive: true` sont scannées (extensible sans code)
- Maximum 6 legs par coupon (paramètre `COUPON_MAX_LEGS`, ajustable)
- Un seul pick par match dans le coupon (anti-corrélation inter-matchs)
- Si aucun pick ne passe le seuil EV : coupon `NO_BET` émis (confirmation que le système a tourné)

---

## Marchés éligibles

### Singles (1 marché, 1 match)

| Code        | Description                       |
| ----------- | --------------------------------- |
| `HOME_WIN`  | Victoire domicile (1X2)           |
| `DRAW`      | Match nul (1X2)                   |
| `AWAY_WIN`  | Victoire extérieur (1X2)          |
| `OVER_2_5`  | Plus de 2.5 buts                  |
| `UNDER_2_5` | Moins de 2.5 buts                 |
| `BTTS_YES`  | Les deux équipes marquent         |
| `BTTS_NO`   | Au moins une équipe ne marque pas |

### Combos-match (2 marchés, même fixture)

Un combo-match est un pick unique combinant deux marchés sur la même fixture. La probabilité jointe est calculée depuis la distribution de Poisson bivariée — pas d'approximation.

| Combo                  | Description                            | Type de résultat typique |
| ---------------------- | -------------------------------------- | ------------------------ |
| `HOME_WIN + BTTS_YES`  | Victoire domicile + les deux marquent  | 2-1, 3-1, 3-2            |
| `AWAY_WIN + BTTS_YES`  | Victoire extérieur + les deux marquent | 1-2, 1-3, 2-3            |
| `HOME_WIN + OVER_2_5`  | Victoire domicile avec buts            | 2-1, 3-0, 3-1            |
| `AWAY_WIN + OVER_2_5`  | Victoire extérieur avec buts           | 0-2, 1-2, 0-3            |
| `HOME_WIN + UNDER_2_5` | Victoire courte domicile               | 1-0, 2-0                 |
| `AWAY_WIN + UNDER_2_5` | Victoire courte extérieur              | 0-1, 0-2                 |
| `BTTS_YES + OVER_2_5`  | Les deux marquent + match ouvert       | 1-2, 2-2, 2-3            |
| `BTTS_YES + UNDER_2_5` | Les deux marquent + score serré        | 1-1                      |
| `DRAW + BTTS_YES`      | Nul avec buts des deux côtés           | 1-1, 2-2                 |
| `DC_1X + BTTS_YES`     | Domicile ou nul + les deux marquent    | 1-1, 2-1                 |
| `DC_X2 + BTTS_YES`     | Extérieur ou nul + les deux marquent   | 1-1, 1-2                 |
| `DC_12 + BTTS_YES`     | Un vainqueur + les deux marquent       | 2-1, 1-2                 |

### Combos exclus

Ces combinaisons sont rejetées automatiquement (impossibles ou redondantes) :

```
HOME_WIN + AWAY_WIN     → événements mutuellement exclusifs
HOME_WIN + DRAW         → événements mutuellement exclusifs
AWAY_WIN + DRAW         → événements mutuellement exclusifs
OVER_2_5 + UNDER_2_5   → événements mutuellement exclusifs
BTTS_YES + BTTS_NO     → événements mutuellement exclusifs
HOME_WIN + DC_1X        → redondant (DC_1X ⊇ HOME_WIN)
AWAY_WIN + DC_X2        → redondant (DC_X2 ⊇ AWAY_WIN)
DRAW + DC_1X            → redondant (DC_1X ⊇ DRAW)
DRAW + DC_X2            → redondant (DC_X2 ⊇ DRAW)
```

---

## Calcul de la probabilité jointe (combos-match)

Le modèle Poisson génère λ_home et λ_away par fixture. La table de probabilités P(H=h, A=a) est déjà calculée pour h, a ∈ [0..10]. La probabilité jointe d'un combo est une somme filtrée sur cette table — aucun nouveau modèle requis.

```
P(HOME_WIN AND BTTS_YES)
  = Σ P(H=h) × P(A=a)   pour tout (h, a) où h > a ET a ≥ 1

P(DRAW AND BTTS_YES)
  = Σ P(H=h) × P(A=a)   pour tout (h, a) où h = a ET h ≥ 1

P(BTTS_YES AND OVER_2_5)
  = Σ P(H=h) × P(A=a)   pour tout (h, a) où h ≥ 1 ET a ≥ 1 ET (h+a) > 2
```

L'EV du combo utilise la cote composite proposée par le bookmaker pour cet événement joint :

```
EV_combo = (P_joint × cote_combo) − 1
```

Si le bookmaker ne propose pas la cote composite, le combo est ignoré (pas d'approximation par multiplication des cotes).

---

## Algorithme de génération du coupon

```
ENTRÉE  : date J, ligues isActive = true
SORTIE  : 1 coupon (≥ 1 leg) ou NO_BET

ÉTAPE 1 — Collecte des fixtures
  → Toutes les fixtures SCHEDULED du jour J dans les ligues actives
  → Pré-condition : odds snapshot disponible (sinon fixture ignorée)

ÉTAPE 2 — Analyse par fixture (parallèle)
  Pour chaque fixture :
    a. Calculer tous les singles viables  (EV ≥ EV_THRESHOLD)
    b. Calculer tous les combos-match viables (EV joint ≥ EV_THRESHOLD, liste blanche uniquement)
    c. Score de qualité de chaque candidat : qualityScore = EV × deterministicScore
    d. Garder le candidat avec le meilleur qualityScore (1 pick max par fixture)

ÉTAPE 3 — Assemblage du coupon
  → Trier les picks retenus par qualityScore décroissant
  → Prendre les N premiers (N ≤ COUPON_MAX_LEGS)

ÉTAPE 4 — Décision
  Si N ≥ 1 → créer coupon, persister en DB, notifier
  Si N = 0 → émettre NO_BET, notifier (confirmation que le pipeline a tourné)
```

---

## Score de qualité (qualityScore)

```
qualityScore = EV × deterministicScore
```

| Pick | EV   | Score déterministe | qualityScore |
| ---- | ---- | ------------------ | ------------ |
| A    | 0.20 | 0.62               | **0.124**    |
| B    | 0.12 | 0.78               | **0.094**    |
| C    | 0.09 | 0.80               | **0.072**    |

Le pick A est sélectionné en premier malgré un score déterministe plus faible, car son avantage mathématique combiné à la confiance du modèle est plus élevé.

---

## Structure du coupon en base

Un coupon est un enregistrement `DailyCoupon` lié à N enregistrements `Bet` (un par leg).

```
DailyCoupon
  id              UUID
  date            Date          (J, unicité garantie)
  status          PENDING | SETTLED | NO_BET
  legCount        Int
  createdAt       DateTime

Bet (existant, non modifié)
  → fixtureId, market, pick, probEstimated, oddsSnapshot, ev, stake, status
  → lié au DailyCoupon via dailyCouponId
```

---

## Output notification

```
📋 COUPON EVCore — Lundi 3 mars 2026

1. Arsenal vs Chelsea (PL)       HOME_WIN + BTTS_YES   cote 3.20   EV +14.1%
2. Inter vs Juventus (SA)        OVER_2_5              cote 1.72   EV +9.1%
3. Barcelona vs Atletico (LL)    DRAW + BTTS_YES       cote 4.10   EV +11.3%

Legs         : 3
Mise conseil : 1% bankroll
```

```
📋 COUPON EVCore — Mercredi 5 mars 2026

Aucune opportunité viable détectée aujourd'hui.
EV insuffisant sur les 8 fixtures analysées.
→ NO BET
```

---

## Configuration

Tous les paramètres sont centralisés dans `config/` — jamais hardcodés.

| Constante                   | Valeur par défaut        | Fichier               |
| --------------------------- | ------------------------ | --------------------- |
| `COUPON_MAX_LEGS`           | `6`                      | `coupon.constants.ts` |
| `EV_THRESHOLD`              | `0.08`                   | `ev.constants.ts`     |
| `MODEL_SCORE_THRESHOLD`     | `0.60`                   | `ev.constants.ts`     |
| `COUPON_SCHEDULING_ENABLED` | `true`                   | env var               |
| `COUPON_TRIGGER_CRON`       | `0 20 * * *` (20:00 UTC) | `coupon.constants.ts` |

> Le coupon est généré à 20:00 UTC, après le `odds-live-sync` (18:00 UTC), pour garantir que toutes les odds sont disponibles.

---

## Intégration dans le pipeline

```
odds-live-sync (18:00 UTC)
    ↓ odds snapshottées pour les fixtures SCHEDULED J+1
coupon-generator (20:00 UTC)
    ↓ scan ligues actives → fixtures du lendemain
    ↓ analyzeFixture() sur chaque fixture
    ↓ sélection qualityScore
    ↓ DailyCoupon + Bets persistés
    ↓ notification email + Slack
résultats post-match
    ↓ settleOpenBets() → WON / LOST / VOID
    ↓ CalibrationService.compute()
    ↓ AdjustmentService.settleAndCheck()  ← boucle d'apprentissage
```

---

---

## Facteurs d'analyse — Feature flags

### Principe : shadow scoring

Tous les facteurs sont **toujours calculés**, qu'ils soient activés ou non. Un facteur désactivé ne contribue pas au `deterministicScore` mais sa valeur est loggée dans `ModelRun.features` sous la clé `shadow_*`.

La boucle d'apprentissage analyse périodiquement la corrélation entre les scores shadow et les outcomes réels. Si un facteur shadow améliore significativement le Brier Score sur les N derniers paris, le système propose de l'activer via un `AdjustmentProposal` (même mécanique que les ajustements de poids — auto-apply + rollback humain possible).

```
facteur DISABLED
    → valeur calculée et loggée dans ModelRun.features.shadow_*
    → pas d'impact sur deterministicScore
    → AdjustmentService analyse la corrélation après N bets
    → si corrélation significative → AdjustmentProposal "enable factor X"
    → auto-apply → facteur passe ENABLED
    → humain peut rollback
```

---

### Tableau des facteurs

| Facteur        | Statut       | Poids si activé | Source                           | Note                                                                          |
| -------------- | ------------ | --------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `recentForm`   | **ENABLED**  | 30%             | DB (déjà calculé)                | Core — ne pas désactiver                                                      |
| `xg`           | **ENABLED**  | 30%             | DB (déjà calculé)                | Core — ne pas désactiver                                                      |
| `domExtPerf`   | **ENABLED**  | 25%             | DB (déjà calculé)                | Core — ne pas désactiver                                                      |
| `leagueVolat`  | **ENABLED**  | 15%             | DB (déjà calculé)                | Core — ne pas désactiver                                                      |
| `lineMovement` | **ENABLED**  | à calibrer      | DB (OddsSnapshots multiples)     | Mouvement de cote Pinnacle entre snapshots                                    |
| `injuries`     | **ENABLED**  | à calibrer      | API-Football `/injuries`         | Absence joueurs clés — filtre dur si gardien/attaquant titulaire              |
| `h2h`          | **DISABLED** | à calibrer      | API-Football H2H                 | Shadow scoring actif                                                          |
| `congestion`   | **DISABLED** | à calibrer      | DB (fixture dates)               | Jours depuis dernier match, compétitions midweek                              |
| `lineups`      | **DISABLED** | à calibrer      | API-Football `/fixtures/lineups` | Shadow uniquement — annoncés ~1h avant match (timing incompatible coupon J-1) |

---

### Facteurs ENABLED — comportement

**`lineMovement`**

Mesure le déplacement de la cote Pinnacle entre le premier et le dernier snapshot disponible.

```
lineMovementScore = (closingOdds - openingOdds) / openingOdds

→ mouvement dans notre sens (cote baisse sur notre pick) : signal positif
→ mouvement contre nous (cote monte)                     : signal négatif ou filtre
```

Règle : si le mouvement est > 10% contre notre pick → le pick est exclu du coupon indépendamment de l'EV calculé (le marché sait quelque chose que le modèle ne sait pas).

**`injuries`**

Requête API-Football `/injuries` par fixture. Identifie les absents parmi les joueurs à haut impact (gardien n°1, attaquants titulaires habituels).

```
→ gardien titulaire absent      : deterministicScore × 0.85 (filtre partiel)
→ attaquant principal absent    : λ_home ou λ_away réduit de 15%
→ 3+ titulaires absents         : fixture exclue du coupon (NO_BET fixture)
```

Les absences sont loggées dans `ModelRun.features.injuries`.

---

### Facteurs DISABLED — shadow scoring

**`h2h`**

5 dernières confrontations directes entre les deux équipes. Score : taux de victoire ajusté (domicile/extérieur) sur les H2H récents vs forme générale.

Calculé et stocké dans `ModelRun.features.shadow_h2h`. Non utilisé dans le score final jusqu'à activation.

**`congestion`**

```
congestionScore = f(
  daysSinceLastMatch,       // < 3 jours = fatigue élevée
  matchesLast30Days,        // > 8 matchs = charge physique
  europeanMidweekPlay       // boolean
)
```

Entièrement calculable depuis les fixtures en DB. Stocké dans `ModelRun.features.shadow_congestion`.

**`lineups`**

Compositions officielles annoncées ~1h avant le coup d'envoi. Incompatible avec la génération du coupon la veille au soir. Le shadow score est calculé **après** l'annonce et stocké en post-hoc sur le `ModelRun` pour analyse future par la boucle d'apprentissage.

---

### Configuration des feature flags

```typescript
// config/feature-flags.constants.ts
export const FEATURE_FLAGS = {
  SCORING: {
    LINE_MOVEMENT: true, // actif
    INJURIES: true, // actif
    H2H: false, // shadow uniquement
    CONGESTION: false, // shadow uniquement
    LINEUPS: false, // shadow post-hoc uniquement
  },
} as const;
```

Les flags sont modifiables via `AdjustmentProposal` — jamais manuellement en DB.

---

### Rôle dans la boucle d'apprentissage

`AdjustmentService` est étendu pour analyser, après chaque cycle de calibration (≥ 50 paris) :

1. Corrélation de Spearman entre chaque `shadow_*` feature et l'outcome réel
2. Si `|rho| > 0.15` et `p-value < 0.05` → propose d'activer le facteur
3. Recalcule la distribution des poids (somme toujours = 100%)
4. Auto-apply si critères remplis, rollback humain possible

---

## Contraintes héritées de EVCORE.md

- Marché suspendu (ROI < -15% / 50+ paris) → picks de ce marché ignorés lors de la sélection
- Fixture `POSTPONED` → ignorée, aucun `ModelRun` généré
- Odds snapshot absente → fixture ignorée (`decision: NO_BET` au niveau fixture)
- Cold-start guard : fixtures ignorées si < 5 stats équipe disponibles (`MIN_PRIOR_TEAM_STATS`)
- EV calculé avec `decimal.js` — jamais de `number` natif pour l'arithmétique financière
