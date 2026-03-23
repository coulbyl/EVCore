# Analyse coupon — 20 mars 2026

> Analyse post-match des sélections du coupon du 20 mars.
> Compléter au fil des résultats du weekend, synthèse globale en fin de weekend.

---

## Sélections analysées

### Sélection 1 — Rodez vs Bastia · PERDU · 1-1

**Pick : V1 + BB NON** · λ home 1.47 · λ away 0.49 · xG total 1.96 · EV prédit +1.15

**Résultat** : 1-1 — Bastia a marqué malgré λ_away = 0.49 (P = 38.7%). V1 et BB NON tous deux ratés.

**Observations :**

- λ_away = 0.49 → P(Bastia marque) ≈ 38.7% — sous-estimé, Bastia a marqué
- EV de +1.15 était un signal d'alerte (edge irréaliste pour un marché efficient)
- Le NUL à 26.2% est arrivé — événement dans les probabilités, pas une anomalie

**Cause principale :** λ_away sous-estimé + V1 raté (draw)

---

### Sélection 2 — Boulogne vs Nancy · PERDU · 0-0

**Pick : V1 + PLUS DE 2.5** · λ home 1.90 · λ away 0.75 · xG total 2.64 · EV prédit +0.75

**Résultat** : 0-0 — aucun but. P(0-0) sous Poisson(2.64) ≈ 7.1% — événement de queue.

**Observations :**

- P(Over 2.5) = 49.2% au moment de la sélection — quasi coin flip
- λ_home = 1.90 → P(Boulogne ne marque pas) ≈ 14.9%, c'est arrivé
- Alternative V1 + BB NON (EV +0.617) aurait aussi perdu (0-0)
- Aucun pick du coupon n'aurait gagné sur ce match

**Cause principale :** Tail event (7%) — composant Over 2.5 trop incertain pour un combo

---

### Sélection 3 — Lens vs Angers · PERDU · 5-1

**Pick : V1 + BB NON** · λ home 2.58 · λ away 0.41 · xG total 3.00 · EV prédit +0.33

**Résultat** : 5-1 — Lens a gagné massivement (V1 ✓), mais Angers a marqué 1 but de consolation (BB NON ✗).

**Observations :**

- V1 parfaitement identifié (P = 84%, confirmé 5-1)
- λ_away = 0.41 → P(Angers marque) ≈ 33.6% — but de consolation arrivé
- V1 + PLUS DE 2.5 (second candidat, EV +0.12) **aurait gagné** sur 5-1
- Biais Poisson : P(away marque | home gagne largement) > P(away marque) — les buts de consolation arrivent quand l'intensité défensive chute

**Cause principale :** But de consolation dans victoire large — biais structurel du Poisson sur BB NON

---

### Sélections 4, 5, 6 — non générées

Le modèle n'a généré que 3 bets ce jour-là. Aucune sélection supplémentaire en DB.

---

## Patterns observés (provisoire — 3 matchs)

### 1. λ_away systématiquement sous-estimé

| Match          | λ_away | P(away marque) | Réalité              |
| -------------- | ------ | -------------- | -------------------- |
| Rodez-Bastia   | 0.49   | 38.7%          | Bastia a marqué      |
| Boulogne-Nancy | 0.75   | 52.7%          | Nancy n'a pas marqué |
| Lens-Angers    | 0.41   | 33.6%          | Angers a marqué      |

Sur les 2 matchs avec λ_away < 0.5, l'équipe extérieure a marqué dans les 2 cas.
**À vérifier sur l'ensemble du backtest : biais systématique sur λ_away < 0.5 ?**

### 2. Biais BB NON dans les victoires larges

Le modèle sélectionne V1 + BB NON quand λ_home est élevé — c'est précisément le scénario à risque de but de consolation. Le Poisson suppose un taux de buts constant, indépendant du score en cours. En réalité, une équipe qui mène 3-0 gère défensivement et l'adversaire marque en garbage time.

**P(away marque | home gagne largement) > P(away marque)**

### 3. EV très élevés = signal d'alerte

| Match          | EV prédit | Résultat |
| -------------- | --------- | -------- |
| Rodez-Bastia   | +1.149    | PERDU    |
| Boulogne-Nancy | +0.749    | PERDU    |
| Lens-Angers    | +0.328    | PERDU    |

Les deux picks avec les EV les plus élevés sont ceux qui ont le plus échoué. Un edge > 50% sur un marché semi-efficient est suspect — les lambdas sont probablement trop agressifs.

### 4. Football de bas de tableau français (Ligue 2 / National)

Rodez, Bastia, Boulogne, Nancy, Lens (Ligue 1 mais en forme), Angers — plusieurs matchs en divisions inférieures françaises où les xG historiques sont moins fiables et les matchs plus fermés/tactiques.

**À investiguer :** le modèle sur-estime-t-il λ_home dans les divisions inférieures françaises ?

---

## Pistes d'amélioration (à confirmer en fin de weekend)

1. **Plancher sur λ_away** — les valeurs < 0.5 sous-estiment la capacité à marquer, même pour les équipes faibles en déplacement
2. **Pénaliser BB NON quand λ_home > 2.0** — corriger le biais consolation, ou ajuster P(BTTS_NON) à la hausse dans ces configurations
3. **Exclure les composants quasi-coin flip des combos** — Over/Under avec P ∈ [45%, 55%] ne devrait pas entrer dans un combo
4. **Calibration par ligue** — les lambdas des divisions inférieures françaises méritent un ensemble de données séparé ou un facteur de correction
5. **Backtester spécifiquement** les matchs avec λ_away < 0.6 : taux réel de BTTS_OUI vs prédit

---

## À compléter en fin de weekend

- [ ] Calculer le Brier score empirique du coupon du 20
- [ ] Vérifier si le pattern λ_away < 0.5 tient sur les autres matchs
- [ ] Conclure sur les pistes d'amélioration à prioriser

---

# Analyse coupon — 21 mars 2026

> 9 legs générés. Coupon d'observation sélectionné avant les matchs de 19h.
> Résultats à compléter ce soir.

---

## Coupon d'observation sélectionné

| Leg | Match                            | Pick               | Prob  | EV    | Cote |
| --- | -------------------------------- | ------------------ | ----- | ----- | ---- |
| 1   | Southampton vs Oxford United     | V1 + BB NON        | 55.3% | +0.59 | 2.87 |
| 2   | Racing Santander vs Albacete     | NUL + MOINS DE 2.5 | 27.7% | +0.94 | 7.03 |
| 3   | Hull City vs Sheffield Wednesday | MOINS DE 2.5       | 52.8% | +0.21 | 2.29 |
| 4   | Parma vs Cremonese               | **V1 seul**        | 66.2% | +0.38 | 2.09 |

**Probabilité combinée théorique : ~5.4%**

Choix de Parma en V1 seul (et non V1+BBNON sélectionné par le modèle) : décision humaine pour éliminer le biais consolation identifié sur les matchs du 20. Le modèle proposait EV +1.16 sur le combo — niveau jugé suspect.

---

## Les 9 legs — analyse pré-match

### Leg 1 — Parma vs Cremonese · _résultat à compléter_

**Pick modèle : V1 + BB NON** · **Pick coupon : V1 seul**
λ home 1.46 · λ away 0.33 · xG 1.79 · P(V1) = 66.2% · EV(V1) +0.384

- V1 seul retenu : élimine le biais BB NON (λ_away=0.33 → P(Cremonese marque) ≈ 28.1%)
- EV du combo (+1.16) jugé suspect — même niveau que Rodez-Bastia (perdu)
- P(MOINS DE 2.5) = 73.3% — match fermé très probable

**Résultat :** 0-2 · **LOST** ❌ — Cremonese gagne à l'extérieur, V1 faux. L'ajustement humain (V1 seul au lieu du combo) n'a rien changé — le pick de base était incorrect.

---

### Leg 2 — Guingamp vs Reims · PERDU · 0-2

**Pick modèle : V1 + BB NON** · Non retenu dans le coupon
λ home 1.03 · λ away 0.58 · xG 1.61 · P(V1) = 45.7%

- Exclu : P(V1) < 50%, Guingamp pas favori clair. λ_away = 0.58 trop haut pour parier BB NON

**Résultat :** 0-2 FINAL · **LOST** ❌ — Reims gagne à l'extérieur, Guingamp ne marque pas. Confirme l'analyse pré-match : V1 non justifié sur ce profil (P < 50%).

---

### Leg 3 — Racing Santander vs Albacete · _résultat à compléter_

**Pick modèle : NUL + MOINS DE 2.5** · **Pick coupon : retenu**
λ home 1.11 · λ away 0.83 · xG 1.94 · P = 27.7% · EV +0.944 · Cote 7.03

- Seul pick sans biais identifié — math vérifiée : P(0-0) + P(1-1) ≈ 27.6% ✓
- Aucune dépendance à λ_away sous-estimé ni risque consolation
- Long shot honnête : NUL à 31%, Moins de 2.5 à 69.4%

**Résultat :** 0-4 · **LOST** ❌ — Albacete gagne 4-0, Racing ne marque pas. NUL + U2.5 raté sur les deux composants.

---

### Leg 4 — Southampton vs Oxford United · GAGNÉ · 2-0

**Pick modèle : V1 + BB NON** · **Pick coupon : retenu tel quel**
λ home 2.40 · λ away 0.50 · xG 2.90 · P = 55.3% · EV +0.587 · Cote 2.87

- Meilleur V1 solide du batch (P=80% sur V1 seul, cote trop basse → combo sélectionné)
- Risque : λ_away = 0.50 → P(Oxford marque) ≈ 39.3% — profil identique à Bastia et Angers (perdus hier)
- Test clé : le biais consolation se confirme-t-il avec λ_away ≈ 0.50 ?

**Résultat :** 2-0 · **WON** ✅ — V1 confirmé (P=80%), Oxford ne marque pas. BB NON validé. Test biais consolation : λ_away=0.50 → Oxford n'a pas marqué cette fois.

---

### Leg 5 — Borussia Dortmund vs Hamburger SV · PERDU · 3-2

**Pick modèle : MOINS DE 2.5** · Non retenu dans le coupon
λ home 1.97 · λ away 0.79 · xG 2.76 · P(U2.5) = 47.9% · EV +0.201

- Exclu : P(U2.5) < 50% — le modèle pense lui-même que Over est plus probable (52.1%)
- xG = 2.76 penche structurellement vers le Over

**Résultat :** 3-2 · **LOST** ❌ — Over 2.5 confirmé (4 buts), Under raté. P(U2.5) = 47.9% — quasi coin flip, confirme que ce pick n'aurait pas dû être retenu.

---

### Leg 6 — SV Elversberg vs Arminia Bielefeld · PERDU · 3-1

**Pick modèle : NUL + MOINS DE 2.5** · Non retenu (probabilité trop basse pour un 4ème leg)
λ home 1.54 · λ away 1.12 · xG 2.65 · P = 19.1% · EV +0.271

- Profil propre, math cohérente, pick de qualité — écarté uniquement pour P=19.1% trop basse
- Était EN COURS à 0-0 au moment de l'analyse, 1-0 à la mi-temps, 3-1 final
- Arminia Bielefeld : carton rouge 51' → match à 10 vs 11 pendant 40 minutes

**Résultat :** 3-1 · PERDU — exogenous event (rouge 51'). Les 2 buts supplémentaires d'Elversberg sont directement liés à l'infériorité numérique. Ce n'est pas un échec de calibration du modèle — aucun modèle Poisson ne peut prédire un carton rouge. À exclure de l'analyse des biais.

---

### Leg 7 — Hull City vs Sheffield Wednesday · _résultat à compléter_

**Pick modèle : MOINS DE 2.5** · **Pick coupon : retenu**
λ home 2.03 · λ away 0.53 · xG 2.56 · P = 52.8% · EV +0.210 · Cote 2.29

- Seul pick standalone pur du batch — pas de combo, pas de BB NON
- EV modeste mais honnête, aucun biais identifié
- Risque : λ_home = 2.03, Hull peut scorer 2+ facilement

**Résultat :** 3-1 · **LOST** ❌ — Hull score 3 buts, Over 2.5. λ_home=2.03 s'est exprimé. Risque identifié en pré-match confirmé.

---

### Leg 8 — Estac Troyes vs Dunkerque · PERDU · 5-1

**Pick modèle : NUL + MOINS DE 2.5** · Non retenu
λ home 1.31 · λ away 1.05 · xG 2.36 · P = 22.5% · EV +0.114

- Exclu : EV le plus bas du batch. V2 (EV +0.260) rejeté par filtre "Cote trop haute" (4.22)

**Résultat :** 5-1 · **LOST** ❌ — NUL+U2.5 raté (Troyes gagne largement). Pick exclu à juste titre (EV plancher).

---

### Leg 9 — Bayern München vs Union Berlin · WON · 4-0

**Pick modèle : V1 + BB NON** · Non retenu
λ home 3.31 · λ away 0.60 · xG 3.91 · P = 53.0% · EV +0.098

- Exclu : P(BB NON) = 56.7% — presque 1 chance sur 2 qu'Union marque. λ_home = 3.31 = risque consolation maximal. EV plancher (+0.098)

**Résultat :** 4-0 · **WON** ✅ (non retenu) — BB NON aurait aussi tenu (Union ne marque pas). Pick exclu pour risque consolation (λ_home=3.31, P(BB NON)=56.7%) — le risque ne s'est pas matérialisé cette fois.

---

## Classement des 9 legs (pré-match)

| Rang | Match                        | Pick      | Prob  | EV    | Retenu            | Score | Résultat     |
| ---- | ---------------------------- | --------- | ----- | ----- | ----------------- | ----- | ------------ |
| 1    | Southampton vs Oxford        | V1+BBNON  | 55.3% | +0.59 | ✓                 | 2-0   | **WON** ✅   |
| 2    | Racing Santander vs Albacete | NUL+U2.5  | 27.7% | +0.94 | ✓                 | 0-4   | **LOST** ❌  |
| 3    | Hull City vs Sheff. Wed.     | U2.5 seul | 52.8% | +0.21 | ✓                 | 3-1   | **LOST** ❌  |
| 4    | Elversberg vs Bielefeld      | NUL+U2.5  | 19.1% | +0.27 | — (P trop basse)  | 3-1   | LOST (exclu) |
| 5    | Parma vs Cremonese           | V1 seul\* | 66.2% | +0.38 | ✓ (\*ajusté)      | 0-2   | **LOST** ❌  |
| 6    | Guingamp vs Reims            | V1+BBNON  | 36.0% | +0.86 | — (V1 < 50%)      | 0-2   | LOST (exclu) |
| 7    | BVB vs Hamburg               | U2.5 seul | 47.9% | +0.20 | — (modèle ↑ Over) | 3-2   | LOST (exclu) |
| 8    | Troyes vs Dunkerque          | NUL+U2.5  | 22.5% | +0.11 | — (EV plancher)   | 5-1   | LOST (exclu) |
| 9    | Bayern vs Union Berlin       | V1+BBNON  | 53.0% | +0.10 | — (BB NON 56.7%)  | 4-0   | WON (exclu)  |

---

## Résultats du 21 mars

- [x] Parma vs Cremonese — **0-2 · LOST** ❌
- [x] Guingamp vs Reims — **0-2 · LOST** ❌ (non retenu)
- [x] Racing Santander vs Albacete — **0-4 · LOST** ❌
- [x] Southampton vs Oxford United — **2-0 · WON** ✅
- [x] BVB vs Hamburg — **3-2 · LOST** ❌ (non retenu)
- [x] Elversberg vs Bielefeld — **3-1 · LOST** ❌ (non retenu)
- [x] Hull City vs Sheff. Wed. — **3-1 · LOST** ❌
- [x] Troyes vs Dunkerque — **5-1 · LOST** ❌ (non retenu)
- [x] Bayern vs Union Berlin — **4-0 · WON** ✅ (non retenu)

**Coupon 21 mars : 1/4 — PERDU** ❌

---

## Synthèse weekend

### Bilan coupons

| Coupon  | Legs retenus | Gagnés          | Résultat |
| ------- | ------------ | --------------- | -------- |
| 20 mars | 3            | 0               | PERDU ❌ |
| 21 mars | 4            | 1 (Southampton) | PERDU ❌ |

### Biais λ_away < 0.5 — confirmé ?

| Match              | λ_away | P(away marque) | Résultat away                   |
| ------------------ | ------ | -------------- | ------------------------------- |
| Rodez-Bastia       | 0.49   | 38.7%          | Bastia ✓ a marqué               |
| Lens-Angers        | 0.41   | 33.6%          | Angers ✓ a marqué               |
| Southampton-Oxford | 0.50   | 39.3%          | Oxford ✗ n'a pas marqué         |
| Parma-Cremonese    | 0.33   | 28.1%          | Cremonese ✓ a marqué (2 buts !) |

3/4 cas avec λ_away < 0.5 : l'équipe extérieure a marqué. **Biais confirmé.**

### Biais BB NON / consolation λ_home > 2.0 — confirmé ?

| Match                 | λ_home | Pick BB NON  | Résultat              |
| --------------------- | ------ | ------------ | --------------------- |
| Lens-Angers           | 2.58   | BB NON       | LOST (but Angers 5-1) |
| Southampton-Oxford    | 2.40   | BB NON       | WON (Oxford 0)        |
| Hull City-Sheff. Wed. | 2.03   | U2.5 (proxy) | LOST (Hull 3-1)       |

Résultat mitigé : 1/3. Southampton contre-exemple net (λ_home=2.40, BB NON tenu). Le biais existe mais n'est pas systématique — à vérifier sur backtest complet.

### Décisions prises

- [x] **λ_away plancher** : biais confirmé sur 3/4 cas — à intégrer dans le modèle
- [ ] **BB NON pénalisé quand λ_home > 2.0** : non confirmé sur ce weekend — attendre plus de données
- [x] **Exclure quasi-coin flip des combos** : BVB Under (47.9%) → 3-2, LOST — règle validée
- [ ] **Calibration par ligue** : divisions inférieures FR sur-estimées — à backtester
