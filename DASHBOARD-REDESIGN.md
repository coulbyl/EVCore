# Dashboard Redesign — Métriques multi-canaux

## Contexte

Le dashboard actuel affiche un ROI global qui mélange des canaux aux natures fondamentalement différentes :

- **EV / SV** : canaux financiers — décision basée sur l'EV, bet `Bet` enregistré avec `stakePct`
- **CONF / BTTS / DRAW** : canaux de prédiction — décision basée sur hit rate, record `Prediction` sans stake

Un seul chiffre global dilue le signal de chaque canal. La refonte sépare deux couches : santé des canaux (feux tricolores) + métriques détaillées Signal/Financier.

---

## Les odds sont déjà capturées pour tous les canaux

Point critique établi avant implémentation : les odds sont disponibles pour CONF, BTTS et DRAW via le join `Prediction → Fixture → OddsSnapshot`.

| Canal       | Source odds                                     | Champ                                             |
| ----------- | ----------------------------------------------- | ------------------------------------------------- |
| CONF HOME   | `OddsSnapshot` (market ONE_X_TWO)               | `homeOdds`                                        |
| CONF AWAY   | `OddsSnapshot` (market ONE_X_TWO)               | `awayOdds`                                        |
| CONF DRAW   | `OddsSnapshot` (market ONE_X_TWO)               | `drawOdds`                                        |
| DRAW        | `OddsSnapshot` (market ONE_X_TWO)               | `drawOdds` — c'est aussi le signal (`1/drawOdds`) |
| BTTS YES/NO | `OddsSnapshot` (market BTTS, filtre par `pick`) | `odds`                                            |

Le `SummaryService.extractPredictionOdds()` implémente déjà ce join et retourne les odds par pick dans la réponse summary. **Aucun changement de schéma requis.**

Conséquence : **le ROI est calculable pour les 5 canaux.** La distinction Signal/Financier ne devient pas une contrainte technique — c'est un choix de présentation.

---

## Architecture cible

Deux couches superposées :

```
┌──────────────────────────────────────────────────────┐
│  COUCHE 1 — Santé des canaux (feux tricolores)       │
│  Scan rapide : vert / orange / rouge par canal       │
├──────────────────────────────────────────────────────┤
│  COUCHE 2 — Métriques détaillées                     │
│  Signal (hit rate) + Financier (ROI) — tous canaux   │
└──────────────────────────────────────────────────────┘
```

---

## Couche 1 — Santé des canaux

### Composant : `ChannelHealthStrip`

5 badges compacts en ligne, scannable en 2 secondes.

**Règles de couleur par canal :**

| Canal    | Métrique primaire                         | Vert              | Orange      | Rouge         |
| -------- | ----------------------------------------- | ----------------- | ----------- | ------------- |
| **EV**   | ROI                                       | ≥ 0%              | [-5%, 0%)   | < -5%         |
| **SV**   | ROI                                       | ≥ 0%              | [-5%, 0%)   | < -5%         |
| **CONF** | Hit rate vs seuil ligue                   | ≥ seuil           | seuil - 5pp | < seuil - 5pp |
| **BTTS** | Hit rate vs seuil ligue                   | ≥ seuil           | seuil - 5pp | < seuil - 5pp |
| **DRAW** | ROI (métrique primaire du framework DRAW) | ≥ +5% ET HR ≥ 32% | ROI ≥ 0%    | ROI < 0%      |

**Cas spéciaux :**

- Canal inactif (0 picks sur la période) → badge gris `Inactif`
- Volume insuffisant (< `minSampleN` du canal) → badge gris `Données insuffisantes`
- Période sans snapshot odds → ROI non calculable → fallback sur hit rate

**Fenêtre de calcul :** 30 derniers picks settlés (20 pour DRAW, cohérent avec `minSampleN`).

---

## Couche 2 — Métriques détaillées

### Vue Signal (tous les canaux)

Hit rate vs baseline pour les canaux prédiction. Pour EV/SV, win rate vs attendu.

```
Canal     Hit rate    vs seuil    ROI estimé    N picks    Trend
────────────────────────────────────────────────────────────────
CONF      58.3%       +3.3pp      +2.1%         24         ↑
BTTS      62.1%       +4.1pp      -1.4%         29         →
DRAW      35.5%       +3.5pp      +8.2%         18         ↑
```

> `ROI estimé` = calculé depuis les odds capturées dans `OddsSnapshot` via le join Fixture.
> Un canal peut avoir un bon hit rate et un ROI négatif si les cotes sont trop basses (exemple BTTS à 1.6 avec 62% de réussite = ROI -0.8%). C'est l'information clé que le dashboard actuel ne montre pas.

### Vue Financière (tous les canaux — unifié)

Puisque les odds sont capturées pour tous les canaux, la vue financière n'est plus réservée à EV/SV.

```
Canal    ROI        Gain net    Win/Hit rate    N settlés
─────────────────────────────────────────────────────────
EV       +2.8%      +0.42u      54.2%           24
SV       +1.1%      +0.09u      68.0%           25
CONF     +2.1%      +0.18u      58.3%           24
BTTS     -1.4%      -0.12u      62.1%           29
DRAW     +8.2%      +0.48u      35.5%           18
```

**Différence de calcul :**

- EV/SV : `stakePct` depuis le record `Bet`, odds depuis `Bet.oddsSnapshot`
- CONF/BTTS/DRAW : mise fixe 1u par pick (pas de Kelly), odds depuis `OddsSnapshot` via Fixture

**Note sur la mise fixe pour CONF/BTTS/DRAW :** ces canaux n'ont pas de `stakePct` calculé par le moteur. Le ROI est simulé en mise flat 1u, ce qui est cohérent avec le `SimulationDrawer` déjà implémenté dans la page Summary.

---

## Summary — ce qui existe déjà et ce qui manque

### Ce qui est déjà implémenté

- `SummaryService.extractPredictionOdds()` — extrait les odds par pick depuis le join Fixture → OddsSnapshot
- `SummaryRepository.findSettledPredictions()` — join complet Prediction → Fixture → OddsSnapshot avec filtre marché
- `SimulationDrawer` dans la page Summary — calcule déjà ROI flat 1u sur les picks filtrés
- Colonne `odds` retournée dans `SummaryPickRow` pour CONF/BTTS/DRAW

### Ce qui manque dans Summary

- **ROI agrégé affiché** : le Summary montre les picks individuels avec odds mais n'affiche pas le ROI global calculé depuis ces odds (hors simulation manuelle)
- **StatCard ROI** : ajouter une 4ème stat card `ROI` à côté de Total / Gagnés / Perdus, calculée en flat 1u depuis les odds disponibles

```typescript
// Dans SummaryService.getSummary() — à ajouter
const roi = computeFlatStakeRoi(settledPicks); // picks avec odds non nulles uniquement
```

- **Avertissement odds manquantes** : si < 80% des picks ont des odds capturées sur la période, afficher un warning "ROI estimé sur X picks (odds manquantes pour Y)"

---

## Vue membre vs admin

### Membre (`OperatorPerformanceCard` → `MemberDashboard`)

- Couche 1 : feux tricolores sur les canaux actifs du modèle (pas uniquement ses bet slips)
- Couche 2 : ses stats de suivi personnel — combien de picks il a joués vs générés, son ROI propre si tracké via bet slip
- Pas de distinction Signal/Financier pour le membre — un seul chiffre ROI flat 1u par canal

### Admin (`PerformanceCard` → `AdminDashboard`)

- Couche 1 : feux tricolores tous canaux
- Couche 2 : performance modèle isolée
  - EV/SV : `modelRun.decision = 'BET'` + `Bet.oddsSnapshot NOT NULL` + `stakePct` réel
  - CONF/BTTS/DRAW : flat 1u depuis `OddsSnapshot` via Fixture
  - Toggle `Modèle seul / Tout` (inclut/exclut les bets manuels utilisateurs)

---

## Backend — Nouveaux endpoints requis

### `GET /dashboard/channel-health`

```typescript
type ChannelHealthItem = {
  channel: "EV" | "SV" | "CONF" | "BTTS" | "DRAW";
  status: "GREEN" | "ORANGE" | "RED" | "INACTIVE" | "INSUFFICIENT_DATA";
  primaryMetric: number; // ROI en % ou hit rate en %
  primaryMetricType: "ROI" | "HIT_RATE";
  roi: number | null; // toujours calculé si odds dispo, null sinon
  hitRate: number | null;
  vsThreshold: number | null; // null pour EV/SV
  sampleSize: number;
};
type ChannelHealthResponse = ChannelHealthItem[];
```

**Requêtes Prisma nécessaires :**

- EV/SV : `Bet.findMany({ where: { status: {in: ['WON','LOST']}, source: 'MODEL' }, orderBy: { createdAt: 'desc' }, take: 30 })`
- CONF/BTTS/DRAW : `Prediction.findMany({ where: { correct: {not: null} }, include: { fixture: { include: { oddsSnapshots: { where: { market } } } } }, orderBy: { settledAt: 'desc' }, take: 30 })`

### `GET /dashboard/channel-stats?period=30d`

```typescript
type ChannelStatsItem = {
  channel: string;
  hitRate: number | null;
  avgThreshold: number | null;
  vsThreshold: number | null;
  roi: number | null; // flat 1u pour CONF/BTTS/DRAW, stakePct réel pour EV/SV
  netUnits: number | null;
  sampleSize: number;
  oddsAvailabilityRate: number; // % de picks avec odds capturées (0-1)
  trend: "UP" | "FLAT" | "DOWN";
};
type ChannelStatsResponse = ChannelStatsItem[];
```

---

## Composants UI à créer / modifier

| Composant                 | Action     | Description                                            |
| ------------------------- | ---------- | ------------------------------------------------------ |
| `ChannelHealthStrip`      | Créer      | 5 badges en ligne, couche 1                            |
| `ChannelStatsTable`       | Créer      | Tableau hit rate + ROI tous canaux                     |
| `ChannelFinancialCards`   | Créer      | Cards ROI/gain net, unifié 5 canaux                    |
| `SummaryStatCards`        | Modifier   | Ajouter stat card `ROI` (flat 1u, odds dispo)          |
| `PerformanceCard`         | Refactorer | Vue admin avec toggle modèle/tout, EV/SV + prédictions |
| `OperatorPerformanceCard` | Refactorer | Vue membre simplifiée, ROI flat 1u par canal           |
| `KpiCards`                | Supprimer  | Remplacé par `ChannelHealthStrip`                      |

---

## Ce qui change dans l'existant

| Composant actuel             | Sort        | Remplacé par                  |
| ---------------------------- | ----------- | ----------------------------- |
| `KpiCards`                   | Supprimé    | `ChannelHealthStrip`          |
| `PerformanceCard` ROI global | Refactorisé | Vue canal par canal + toggle  |
| `OperatorPerformanceCard`    | Refactorisé | ROI flat 1u + feux tricolores |
| `PipelineStatus`             | Déjà retiré | —                             |
| `ActiveAlerts`               | Déjà retiré | —                             |

---

## Ordre d'implémentation

1. **Backend** `GET /dashboard/channel-health` — agrège par canal, calcule statut feux tricolores
2. **Backend** `GET /dashboard/channel-stats` — détail par canal, ROI flat 1u pour prédictions
3. **Frontend** `SummaryStatCards` — ajouter stat ROI dans la page Summary (quick win, service existant)
4. **Frontend** `ChannelHealthStrip` — couche 1, remplace `KpiCards`
5. **Frontend** `ChannelStatsTable` + `ChannelFinancialCards` — couche 2
6. **Frontend** Refactor `PerformanceCard` et `OperatorPerformanceCard`

> Ne pas démarrer avant que la branche `feat/implementing-draw-channel` soit mergée sur `main` — les seuils DRAW par ligue doivent être stables pour que le calcul `vsThreshold` soit cohérent.
