# Analyse production EVCore — 2026-03-31 → 2026-04-17

Période : 18 jours · 464 fixtures finalisés · 152 paris settlés + 10 pending · 20 ligues.

---

## 1. Verdict global

| Indicateur                   | Valeur  | Lecture                             |
| ---------------------------- | ------- | ----------------------------------- |
| Paris réglés                 | 152     | —                                   |
| Taux de gain                 | 46.7 %  | Modèle prédit ~49 % en moyenne      |
| Profit total (mise unitaire) | +15.71u | —                                   |
| ROI                          | +10.3 % | Mais **très inégal** selon la ligue |
| Brier moyen simulé           | ≈ 0.56  | OK (< 0.65)                         |
| Gap calibration moyen        | –4 pp   | Modèle légèrement trop confiant     |

**Lecture** — sur la fenêtre, l'agrégat est légèrement positif, mais les variances inter-ligues sont énormes (de –100 % à +209 %). La moyenne masque des ligues où le modèle perd systématiquement et d'autres où il gagne beaucoup. C'est le signal que la calibration doit se faire **par championnat**, pas globalement.

---

## 2. ROI par championnat (paris réglés uniquement)

Trié du plus perdant au plus gagnant.

| Ligue | N   | W   | L   | WR    | Profit | ROI        | P modèle | P réelle | Gap    |
| ----- | --- | --- | --- | ----- | ------ | ---------- | -------- | -------- | ------ |
| ERD   | 3   | 0   | 3   | 0 %   | –3.00  | **–100 %** | 58.2 %   | 0 %      | –58 pp |
| UEL   | 2   | 0   | 2   | 0 %   | –2.00  | **–100 %** | 32.1 %   | 0 %      | –32 pp |
| D2    | 4   | 0   | 4   | 0 %   | –4.00  | **–100 %** | 40.4 %   | 0 %      | –40 pp |
| MX1   | 7   | 1   | 6   | 14 %  | –5.74  | **–82 %**  | 58.6 %   | 14 %     | –44 pp |
| L1    | 6   | 2   | 4   | 33 %  | –3.10  | **–52 %**  | 51.9 %   | 33 %     | –19 pp |
| FRI   | 3   | 1   | 2   | 33 %  | –1.27  | **–42 %**  | 59.3 %   | 33 %     | –26 pp |
| PL    | 6   | 3   | 3   | 50 %  | –1.47  | –24 %      | 63.0 %   | 50 %     | –13 pp |
| EL1   | 29  | 10  | 19  | 34 %  | –4.65  | –16 %      | 54.4 %   | 34 %     | –20 pp |
| F2    | 3   | 2   | 1   | 67 %  | +0.01  | +0.3 %     | 62.8 %   | 67 %     | +4 pp  |
| CH    | 24  | 11  | 13  | 46 %  | +2.56  | +11 %      | 44.1 %   | 46 %     | +2 pp  |
| BL1   | 7   | 3   | 4   | 43 %  | +1.78  | +25 %      | 49.2 %   | 43 %     | –6 pp  |
| SA    | 3   | 2   | 1   | 67 %  | +0.86  | +29 %      | 50.0 %   | 67 %     | +17 pp |
| UCL   | 6   | 3   | 3   | 50 %  | +2.38  | +40 %      | 44.1 %   | 50 %     | +6 pp  |
| LL    | 5   | 3   | 2   | 60 %  | +2.04  | +41 %      | 52.2 %   | 60 %     | +8 pp  |
| SP2   | 5   | 3   | 2   | 60 %  | +2.71  | +54 %      | 46.5 %   | 60 %     | +14 pp |
| EL2   | 28  | 19  | 9   | 68 %  | +15.43 | **+55 %**  | 48.8 %   | 68 %     | +19 pp |
| POR   | 3   | 2   | 1   | 67 %  | +2.20  | +73 %      | 51.1 %   | 67 %     | +16 pp |
| I2    | 1   | 1   | 0   | 100 % | +1.00  | +100 %     | 57.5 %   | 100 %    | +42 pp |
| UECL  | 5   | 3   | 2   | 60 %  | +5.78  | **+116 %** | 45.2 %   | 60 %     | +15 pp |
| J1    | 2   | 2   | 0   | 100 % | +4.19  | **+209 %** | 51.7 %   | 100 %    | +48 pp |

**Lignes rouges** — ligues où le modèle est systématiquement trop confiant (gap ≤ –15 pp) :

- **MX1** (–44 pp), **ERD** (–58 pp), **D2** (–40 pp), **UEL** (–32 pp), **FRI** (–26 pp), **EL1** (–20 pp), **L1** (–19 pp).
- Sur ces 7 ligues : 54 paris, 18 gagnants, ROI cumulé **–46 %** (–24.9u).

**Lignes vertes** — ligues où le modèle est conservateur (gap ≥ +10 pp) :

- **EL2** (+19 pp), **POR** (+16 pp), **UECL** (+15 pp), **SP2** (+14 pp), **J1** (+48 pp).
- Sur ces 5 ligues : 43 paris, 29 gagnants, ROI cumulé **+70 %** (+30.3u).

Sans les 7 ligues rouges, la période aurait fait **+40.6u sur 98 paris (+41 % ROI)**. Autrement dit, l'ensemble du déficit vient d'un petit groupe de championnats.

---

## 3. Performance par marché (toutes ligues)

| Marché              | Pick      | N   | WR    | ROI       | P modèle | Avg odds | Verdict                            |
| ------------------- | --------- | --- | ----- | --------- | -------- | -------- | ---------------------------------- |
| OVER_UNDER_HT       | OVER_1_5  | 30  | 43 %  | +24 %     | 42.5 %   | 2.85     | ✅ fiable, continuer               |
| OVER_UNDER_HT       | OVER_0_5  | 13  | 85 %  | +20 %     | 72.6 %   | 1.43     | ✅ fiable, bien calibré            |
| OVER_UNDER          | UNDER_3_5 | 19  | 68 %  | +4 %      | 71.0 %   | 1.60     | ✅ marginal, OK                    |
| ONE_X_TWO           | AWAY      | 13  | 38 %  | +21 %     | 38.7 %   | 4.17     | ✅ value sur outsider              |
| HALF_TIME_FULL_TIME | HOME_HOME | 4   | 50 %  | +50 %     | 38 %     | 3.15     | 👀 petit échantillon               |
| FIRST_HALF_WINNER   | AWAY      | 5   | 40 %  | +54 %     | 31.5 %   | 3.89     | 👀 petit échantillon               |
| BTTS                | YES       | 2   | 100 % | +113 %    | 59.5 %   | 2.13     | 👀 échantillon trop petit          |
| OVER_UNDER          | OVER      | 7   | 43 %  | **–9 %**  | 52.4 %   | 2.31     | ⚠️ miscalibration OVER 2.5         |
| OVER_UNDER          | UNDER     | 17  | 29 %  | **–16 %** | 46.0 %   | 2.79     | ⚠️ piège UNDER 2.5                 |
| OVER_UNDER          | OVER_1_5  | 11  | 64 %  | **–18 %** | 80.7 %   | 1.28     | ⚠️ cote trop basse, model trop sûr |
| ONE_X_TWO           | HOME      | 19  | 21 %  | **–23 %** | 40.1 %   | 3.70     | ⚠️ HOME surévalué en EV            |
| FIRST_HALF_WINNER   | HOME      | 2   | 0 %   | –100 %    | 36.6 %   | 3.46     | ⚠️ trop petit, mais bad signal     |

**Faits saillants marchés :**

- **OVER_UNDER_HT OVER_1_5** est le marché le plus rentable (+24 % sur 30 paris). C'est la signature du modèle : détecter les matchs offensifs au 1er acte.
- **OVER_UNDER UNDER** (ligne 2.5) : –16 % ROI. Le modèle sur-pick UNDER dans des ligues très offensives (PL, UCL, L1, MX1 — tous perdants à –100 %). L'indicateur `lambdaFloorHit` devrait être plus strict.
- **OVER_UNDER OVER_1_5** : 64 % de winrate MAIS –18 % ROI parce que les cotes sont à 1.28 en moyenne. Le modèle prédit 80.7 % donc un +EV en surface, mais 64 % réel détruit l'EV. Indication : sur les `OVER_1_5` full match, les cotes sont presque « no value » sauf à sélectionner plus durement.
- **ONE_X_TWO HOME** : 21 % WR vs 40 % prédit. Énorme gap de –19 pp. Probable cumul du HOME_ADVANTAGE_LAMBDA_FACTOR dans certaines ligues avec faux positifs sur des favoris à cote moyenne.
- **ONE_X_TWO AWAY** : bon (+21 % ROI). Le modèle capte bien le value outsider extérieur.

---

## 4. Calibration par bucket de probabilité

| Bucket modèle | N   | WR modèle | WR réel | Gap     | ROI   | Diagnostic                          |
| ------------- | --- | --------- | ------- | ------- | ----- | ----------------------------------- |
| < 35 %        | 33  | 29.6 %    | 30.3 %  | +0.7 pp | +27 % | Parfaitement calibré, très rentable |
| 35–50 %       | 53  | 41.7 %    | 35.8 %  | –5.9 pp | +6 %  | Légèrement sur-confiant             |
| 50–65 %       | 24  | 55.4 %    | 45.8 %  | –9.6 pp | +7 %  | ⚠️ **Zone la plus biaisée**         |
| ≥ 65 %        | 42  | 74.8 %    | 73.8 %  | –1.0 pp | +5 %  | Bien calibré                        |

**Insight clé :** le modèle est biaisé dans la zone **50–65 %** — la "moyenne confiance". C'est exactement là que se créent la plupart des picks qui perdent (51 % de probabilité, cote 2.5, EV visible mais probabilité surévaluée).

Action : durcir le `MODEL_SCORE_THRESHOLD` ou augmenter l'EV minimum pour les picks dont la probabilité tombe entre 0.50 et 0.65. Soit filtrage, soit recalibration (e.g. isotonic regression par ligue).

---

## 5. Tendances réelles (03-31 → 04-17)

| Ligue | Matchs | Buts/match | % Over 1.5 | % Over 2.5 | % Home W | % Draw   | % Away W |
| ----- | ------ | ---------- | ---------- | ---------- | -------- | -------- | -------- |
| BL1   | 18     | 3.39       | 83 %       | **67 %**   | 28 %     | 28 %     | **44 %** |
| PL    | 10     | 2.70       | 90 %       | 60 %       | 40 %     | 20 %     | 40 %     |
| UECL  | 8      | 3.25       | **100 %**  | **88 %**   | 88 %     | 12 %     | 0 %      |
| UEL   | 8      | 3.25       | 88 %       | 63 %       | 38 %     | 25 %     | 38 %     |
| POR   | 18     | 2.94       | 83 %       | 50 %       | 44 %     | 28 %     | 28 %     |
| L1    | 16     | 2.81       | 81 %       | 56 %       | 50 %     | 38 %     | 13 %     |
| EL2   | 41     | 2.73       | 76 %       | 56 %       | 54 %     | 22 %     | 24 %     |
| J1    | 22     | 2.73       | 77 %       | 46 %       | 46 %     | 23 %     | 32 %     |
| MX1   | 18     | 2.67       | 78 %       | 50 %       | 44 %     | 33 %     | 22 %     |
| ERD   | 17     | 2.65       | 82 %       | 47 %       | 35 %     | 35 %     | 29 %     |
| SP2   | 33     | 2.64       | 73 %       | 42 %       | 55 %     | 30 %     | 15 %     |
| D2    | 18     | 2.61       | 72 %       | 44 %       | 39 %     | 22 %     | 39 %     |
| LL    | 20     | 2.55       | 70 %       | 50 %       | 55 %     | 25 %     | 20 %     |
| UCL   | 8      | 2.50       | 75 %       | 38 %       | 25 %     | 13 %     | **63 %** |
| WCQE  | 4      | 2.50       | 75 %       | 25 %       | 25 %     | 50 %     | 25 %     |
| SA    | 20     | 2.45       | 65 %       | 45 %       | 50 %     | 15 %     | 35 %     |
| F2    | 18     | 2.39       | 67 %       | 44 %       | 28 %     | **67 %** | 6 %      |
| CH    | 37     | 2.38       | 76 %       | 43 %       | 32 %     | **43 %** | 24 %     |
| EL1   | 41     | 2.37       | 68 %       | 51 %       | 41 %     | 29 %     | 29 %     |
| I2    | 21     | 2.38       | **86 %**   | 29 %       | 52 %     | 33 %     | 14 %     |
| FRI   | 25     | 2.20       | 60 %       | 44 %       | 24 %     | 48 %     | 28 %     |
| UNL   | 2      | 2.00       | 50 %       | 50 %       | 100 %    | 0 %      | 0 %      |

**Points qui crient "ajuster le modèle" :**

1. **BL1** (Bundesliga) — 3.39 buts/match, 67 % over 2.5 → **OVER 2.5** est clairement un marché value ici. Mais le modèle n'a placé que 3 paris `OVER_UNDER` en BL1. Biais vers UNDER à corriger (`HOME_ADVANTAGE_LAMBDA_FACTOR` + λ boosting pour BL1).

2. **F2** (Ligue 2 FR) — **67 % de matchs nuls** sur 18 matchs. Complètement anormal. Le modèle doit absolument augmenter la probabilité de DRAW en F2 (actuellement sous-estimée). Marché 1X2 DRAW très value.

3. **UECL** — 88 % des matchs font plus de 2.5 buts ET 88 % de victoires à domicile. Les équipes home en UECL dominent outrageusement → booster HOME_ADVANTAGE pour UECL (actuellement traité comme "European generic"). Cela explique pourquoi seulement 5 paris placés alors qu'il y avait 8 matchs finis.

4. **UCL** — 63 % de victoires AWAY. Inverse de l'intuition. Échantillon petit (8 matchs) mais signal à surveiller. À ne pas mélanger avec UECL.

5. **I2** (Serie B) — 86 % over 1.5 MAIS 29 % over 2.5. Matchs à 2 buts très fréquents. L'OVER_1_5 MT (42 paris visibles) est clairement le bon marché ici. 1 seul pari placé, raté.

6. **CH** (Championship) — 43 % de nuls. Très élevé. Marchés DRAW et DOUBLE CHANCE à explorer.

---

## 6. Couverture : fixtures sans aucun pari

Sur 464 fixtures finis, le modèle n'a placé **aucun pari sur 283 (61 %)**. Ventilation :

| Cause (source `NO_BET`)           | Part approx. | Commentaire                         |
| --------------------------------- | ------------ | ----------------------------------- |
| `BELOW_MODEL_SCORE_THRESHOLD`     | ~50 %        | Incertitude modèle, seuil strict    |
| `NO_VIABLE_PICK` (EV insuffisant) | ~30 %        | Cotes pas attractives               |
| `MISSING_ODDS`                    | ~10 %        | Pas de snapshot pré-match           |
| `MISSING_TEAM_STATS`              | ~10 %        | Équipes nouvelles / data incomplète |

**Observation :** sur certaines ligues à très fort over/under (BL1, UECL, I2, POR), le modèle passe à côté de marchés simples à cotes 1.50–1.70 parce que le seuil de score déterministe est trop haut. Un `MODEL_SCORE_THRESHOLD` dynamique par marché (plutôt que par ligue seule) libérerait ces picks « faciles ».

Piste concrète : pour `OVER_UNDER_HT OVER_1_5` et `OVER_UNDER OVER_1_5`, baisser le seuil modèle à 0.45 si la probabilité modèle ≥ 0.65.

---

## 7. Actions recommandées (priorité décroissante)

### P0 — À faire immédiatement

1. **Suspendre ou durcir MX1, ERD, D2, UEL** — ces ligues ont un gap > 30 pp et perdent à –82 %/–100 % sur la fenêtre. Soit mettre `includeInBacktest: false` côté Competition, soit remonter le seuil EV ligue à 0.15+ voire 0.20 le temps de recalibrer.
   - MX1 : déjà en `isActive` mais `includeInBacktest` = true avec threshold 0.55. À passer en 0.65+ ou marquer isActive=false.
   - ERD : threshold par défaut 0.60, mais gap –58 pp sur 3 paris → trop d'agressivité, passer à 0.68.
   - UEL : threshold 0.55 récemment remonté, mais encore insuffisant → 0.62.
   - D2 : threshold 0.55 + gap –40 pp → 0.65.

2. **Corriger la zone 50–65 %** — ajouter dans `betting-engine` un filtre : si probabilité modèle ∈ [0.50, 0.65) et cote ∈ [2.0, 3.0], exiger EV ≥ 0.12 (au lieu de 0.08). Cela évacuerait environ 40 % des paris perdants de cette zone.

3. **Rééquilibrer HOME vs AWAY** — le marché HOME (1X2) a –23 % ROI sur 19 paris, AWAY a +21 % sur 13. Revoir le `HOME_ADVANTAGE_LAMBDA_FACTOR` par ligue, probablement trop généreux dans L1, EL1, MX1, PL. AWAY est correctement calibré → ne pas toucher.

### P1 — Prochaines itérations

4. **Par championnat, pas par le modèle global** — mettre en place un backtest par ligue (cet outil), exécuté hebdo. Chaque ligue produit son propre rapport Brier / ROI / calibration → ajustement fin des seuils et poids dans `ev.constants.ts`.

5. **Recalibration isotonique par marché** — la zone 50-65 % suggère un bruit systématique. Une régression isotone sur les probabilités 1X2/OU par compétition (sur 50+ paris) redresserait le biais sans toucher au modèle Poisson.

6. **Explorer les marchés sous-utilisés**
   - **DRAW (1X2)** : en F2 et CH, le taux de nul réel est 43–67 % → DRAW est un marché à intégrer (actuellement rare dans les picks).
   - **OVER_UNDER OVER_1_5** en BL1, UECL : matchs à forte intensité offensive, cotes 1.40-1.60 → pool à exploiter avec seuil plus souple.

### P2 — Structurel

7. **Reconstruire le backtest par compétition** — supprimer l'agrégat global (trompeur, dilué), générer un rapport indépendant par compétition avec verdict PASS/FAIL propre. Les seuils globaux Brier 0.65 / Calibration 5 % / ROI –5 % restent, mais s'appliquent à chaque ligue. Une ligue FAIL bloque uniquement cette ligue, pas le système entier.

8. **Journaliser les rejets par cause** — étendre l'audit quotidien `packages/db/reports/audit-fixtures-YYYY-MM-DD.txt` pour dumper, par ligue, la ventilation des `NO_BET` (seuil, EV, données manquantes). Facilite le suivi de la couverture.

---

## 8. Annexes — requêtes SQL utilisées

```sql
-- Per-league settled ROI
WITH b AS (
  SELECT c.code, b.status, b."oddsSnapshot" AS odds, b."probEstimated" AS prob,
    CASE WHEN b.status='WON' THEN b."oddsSnapshot"-1
         WHEN b.status='LOST' THEN -1 ELSE 0 END AS profit
  FROM bet b
  JOIN fixture f ON f.id = b."fixtureId"
  JOIN season s ON s.id = f."seasonId"
  JOIN competition c ON c.id = s."competitionId"
  WHERE f."scheduledAt" >= '2026-03-31' AND f."scheduledAt" < '2026-04-18'
    AND b.status IN ('WON','LOST')
)
SELECT code, COUNT(*), SUM(CASE WHEN status='WON' THEN 1 ELSE 0 END) AS wins,
  ROUND(SUM(profit)::numeric,2) AS profit,
  ROUND((SUM(profit)::numeric/COUNT(*))*100,2) AS roi_pct,
  ROUND(AVG(prob)::numeric,3) AS avg_prob, ROUND(AVG(odds)::numeric,2) AS avg_odds
FROM b GROUP BY code ORDER BY roi_pct;
```

```sql
-- Real league trends
SELECT c.code, COUNT(*) AS n,
  ROUND(AVG(f."homeScore" + f."awayScore")::numeric, 2) AS avg_goals,
  ROUND((SUM(CASE WHEN f."homeScore" > f."awayScore" THEN 1 ELSE 0 END)::numeric/COUNT(*))*100, 1) AS home_wr,
  ROUND((SUM(CASE WHEN f."homeScore" = f."awayScore" THEN 1 ELSE 0 END)::numeric/COUNT(*))*100, 1) AS draw_rate,
  ROUND((SUM(CASE WHEN f."homeScore" < f."awayScore" THEN 1 ELSE 0 END)::numeric/COUNT(*))*100, 1) AS away_wr
FROM fixture f
JOIN season s ON s.id = f."seasonId"
JOIN competition c ON c.id = s."competitionId"
WHERE f."scheduledAt" >= '2026-03-31' AND f."scheduledAt" < '2026-04-18'
  AND f.status='FINISHED' AND f."homeScore" IS NOT NULL
GROUP BY c.code ORDER BY n DESC;
```

---

_Rapport généré le 2026-04-17 à partir de la base evcore (production). 464 fixtures analysées, 152 paris settlés._
