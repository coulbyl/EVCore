# Plan de backtest — VALUE et extension de SAFE_MARKETS sur les nouveaux marchés

> Suite de `docs/market-coverage-expansion.md` et de l'incident de production
> du 2026-07-19 (`ValueStrategy` rejetait ses propres sélections sur
> `TEAM_TOTAL_HOME`, corrigé — voir historique git). Ce document couvre
> **deux questions distinctes** :
>
> 1. **VALUE** : le canal inclut désormais structurellement les 10 nouveaux
>    marchés, mais rien n'a jamais validé que ses sélections dessus sont
>    réellement rentables — il faut les surveiller activement, pas juste
>    attendre la suspension automatique.
> 2. **SAFE** : le canal les exclut toujours volontairement — faut-il
>    l'étendre, et si oui à quels marchés ?

---

## 1. État actuel

### VALUE

`ALL_MARKETS` (`packages/analysis-core/src/strategies/value.strategy.ts`)
inclut désormais :

```
ONE_X_TWO, OVER_UNDER, BTTS, DOUBLE_CHANCE, HALF_TIME_FULL_TIME,
OVER_UNDER_HT, FIRST_HALF_WINNER,
DRAW_NO_BET, TEAM_TOTAL_HOME, TEAM_TOTAL_AWAY,
CLEAN_SHEET_HOME, CLEAN_SHEET_AWAY, WIN_TO_NIL_HOME, WIN_TO_NIL_AWAY,
TO_WIN_EITHER_HALF, RESULT_TOTAL_GOALS, RESULT_BTTS
```

C'est une inclusion **purement structurelle** (la liste que l'orchestrateur
vérifie contre chaque sélection retournée) — aucun réglage spécifique n'a
été fait pour ces 10 marchés :

- `VALUE_MIN_EDGE` (0.10, probabilité − 1/cote) s'applique uniformément,
  jamais validé spécifiquement dessus.
- Le seul garde-fou existant est la suspension automatique ROI < -15% sur
  50+ paris (`RISK_CONSTANTS.ROI_SUSPENSION_THRESHOLD`/`_BET_COUNT`,
  `risk.service.ts`) — **réactive**, pas préventive : un marché peut perdre
  jusqu'à 50 paris réels avant d'être coupé.

### SAFE

`safeValueMarkets` (`packages/analysis-core/src/selection/pick-evaluation.ts`,
fonction `selectSafeValuePick`) reste volontairement limité à :

```
ONE_X_TWO, OVER_UNDER, BTTS, OVER_UNDER_HT
```

avec le filtre :

- Probabilité ≥ `svMinProbability` (0.68 par défaut, par ligue)
- EV ∈ [`SAFE_VALUE_MIN_EV` (0.05), `EV_HARD_CAP` (0.90)]
- Cote ∈ [`svMinOdds` (1.15 par défaut), `SAFE_VALUE_MAX_ODDS` (2.20)]
- Marché non suspendu

SAFE est **misé automatiquement** (alimente le pool de coupons) — contrairement
aux canaux CLEAN_SHEET/TEAM_TOTAL/WIN_EITHER_HALF (observation pure). Une
extension mal calibrée coûte de l'argent réel, pas juste une ligne de log.

---

## 2. Le problème des données

Comme pour CLEAN_SHEET/WIN_EITHER_HALF/TEAM_TOTAL (voir ROADMAP.md Bloc 8) :
**aucune cote historique n'existe** pour ces 10 marchés — stub vide dans
`odds-historical-import.worker.ts`, The Odds API ne les couvre pas non plus.
Seule la sync PREMATCH (API-Football, forward) les collecte, depuis le
2026-07-19. Impossible de lancer un backtest classique
(`db:backtest:ev-tiers`, `db:backtest:invest-ranking`) : il n'y a
essentiellement aucun pari settled sur ces marchés aujourd'hui.

**Conséquence : ce plan ne peut pas être exécuté immédiatement.** Il faut
d'abord laisser VALUE accumuler des paris settled en conditions réelles.

---

## 3. Plan en 3 phases

### Phase 1 — Accumulation forward (démarre automatiquement, rien à coder)

VALUE sélectionne déjà en direct sur ces marchés depuis le correctif du
2026-07-19. Chaque pari settled sur un des 10 marchés est une donnée forward
réelle (probabilité, cote, EV, qualityScore, résultat) — aucune action
requise, juste du temps.

**Volume minimum avant la Phase 2** : au moins 30-50 paris settled **par
marché** (pas par ligue — trop peu de volume individuellement sur des
marchés aussi récents) avant de tirer une conclusion. Cohérent avec les
planchers déjà utilisés ailleurs (`RISK_CONSTANTS.ROI_SUSPENSION_BET_COUNT`
= 50, `CHANNEL_PROMOTION_RULE.minSample` = 20).

En attendant, surveiller manuellement le ROI par marché (déjà visible via
`GET /risk/report/weekly` ou équivalent) pour repérer un marché qui dérive
mal avant qu'il n'atteigne la suspension automatique à 50 paris perdus.

### Phase 2 — Script de backtest dédié

Écrire un script dans `packages/db/scripts/` (pattern
`backtest-invest-ranking.ts`/`backtest-ev-tiers.ts`) qui, pour chaque
nouveau marché :

1. Récupère les `Bet` settled (`source: MODEL`, canal `VALUE`) groupés par
   marché.
2. Calcule hit rate, ROI, calibration (Brier/meanError) — même méthodologie
   que `ChannelTuningService`.
3. **Question SAFE** : parmi ces paris VALUE, lesquels auraient _aussi_
   passé le filtre SAFE (probabilité ≥ 0.68, EV ∈ [0.05, 0.90], cote ∈
   [1.15, 2.20]) ? Calculer hit rate/ROI sur ce sous-ensemble précis — c'est
   la vraie question "faut-il étendre SAFE", pas le ROI brut de VALUE (SAFE
   est un filtre plus strict appliqué au même pool `evaluatedPicks`, pas un
   canal de sélection séparé).
4. **Question VALUE** : le ROI brut par marché est-il non-négatif ? Produire
   un rapport qui permette de couper préventivement un marché avant qu'il
   n'atteigne les 50 paris de la suspension automatique.

### Phase 3 — Décision

- **SAFE** : n'étendre `safeValueMarkets` qu'aux marchés qui passent à la
  fois (a) le volume minimum et (b) une règle de promotion analogue à
  `CHANNEL_PROMOTION_RULE` (plancher hit rate + ROI) calculée sur le
  sous-ensemble "aurait passé SAFE" spécifiquement — pas sur la population
  VALUE brute.
- **VALUE** : aucun changement structurel nécessaire (déjà inclus), mais le
  rapport de la Phase 2 sert de base pour une suspension manuelle anticipée
  si un marché part clairement mal avant le seuil automatique de 50 paris.

---

## 4. Points d'attention

- SAFE est misé automatiquement — barre de preuve plus haute que pour les
  canaux d'observation. Ne pas réutiliser la méthodologie "seuil structurel
  dérivé du taux de base" (celle de CLEAN_SHEET/WIN_EITHER_HALF/TEAM_TOTAL)
  ici : SAFE a besoin d'un vrai ROI/hit-rate validé, pas d'un seuil
  formulaïque.
- Rappel de `investment.constants.ts` : _"EV only predicts a better outcome
  within VALUE... every other channel gets its own probability-ranked mode"_
  — l'edge de SAFE vient historiquement de la probabilité, pas de l'EV. À
  revalider explicitement pour les nouveaux marchés, pas supposer que ça se
  transpose automatiquement.
- `RESULT_TOTAL_GOALS`/`RESULT_BTTS` sont des picks composés (résultat ×
  condition secondaire) — leur probabilité est structurellement plus basse
  qu'un marché à une seule condition (`CLEAN_SHEET`, `TEAM_TOTAL`). Vérifier
  si le seuil `svMinProbability` (0.68) est même atteignable pour ces
  marchés avant de les inclure dans l'analyse.

---

## 5. Prochaines étapes concrètes

- [ ] Laisser tourner la Phase 1 (aucune action — accumulation forward)
- [ ] Revérifier le volume settled par marché périodiquement (`docker exec
evcore-postgres psql` sur `bet` filtré `market IN (...)`)
- [ ] Une fois le volume minimum atteint sur au moins un marché : écrire le
      script de la Phase 2
- [ ] Revue humaine des résultats + décision d'extension `safeValueMarkets`
- [ ] Si extension : mettre à jour `safeValueMarkets`, `SAFE_MARKETS`
      (`safe.strategy.ts`), les tests associés, et ce document
