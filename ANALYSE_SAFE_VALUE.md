# EVCore — Analyse Safe Value

**Période analysée :** 31 mars – 10 avril 2026  
**Rapport généré :** 10 avril 2026

> **Archive historique** — ce rapport a été écrit quand le moteur produisait
> encore des **coupons combinés**. La notion de coupon a depuis été retirée :
> le moteur publie désormais des **picks individuels** par fixture, plus un
> éventuel pick "safe value" distinct. Les conclusions ci-dessous restent
> valables pour la partie **picks individuels** ; les sections sur les
> coupons combinés sont conservées pour contexte historique uniquement.

---

## 1. Bilan de la période

### Coupons générés (settlés)

| Date    | Coupon                | Type       | Legs | Résultat | Qualité moy. |
| ------- | --------------------- | ---------- | ---- | -------- | ------------ |
| 31 mars | CPN-2026-03-31-E0559F | —          | 1    | **WON**  | —            |
| 31 mars | CPN-2026-03-31-F131E0 | —          | 2    | LOST     | —            |
| 01 avr. | CPN-2026-04-01-609028 | —          | 1    | LOST     | —            |
| 01 avr. | CPN-2026-04-01-E75250 | —          | 1    | LOST     | —            |
| 03 avr. | CPN-2026-04-03-949660 | —          | 6    | LOST     | —            |
| 03 avr. | CPN-2026-04-03-9293C9 | —          | 6    | LOST     | —            |
| 06 avr. | CPN-2026-04-06-B7F60E | SPECULATIF | 3    | LOST     | 0.1156       |
| 06 avr. | CPN-2026-04-06-5EDD2D | PREMIUM    | 3    | LOST     | 0.2562       |
| 06 avr. | CPN-2026-04-06-F23D43 | SPECULATIF | 1    | **WON**  | 0.0965       |
| 08 avr. | CPN-2026-04-08-8B0430 | SPECULATIF | 1    | LOST     | 0.0903       |
| 09 avr. | CPN-2026-04-09-6DD33D | PREMIUM    | 2    | LOST     | 0.2540       |

**Taux de gain coupons :** 2/11 = **18%**

### Picks individuels (bets pool)

| Date      | GAGNE  | PERDU  | Taux    |
| --------- | ------ | ------ | ------- |
| 31 mars   | 2      | 1      | 67%     |
| 01 avr.   | 0      | 2      | 0%      |
| 03 avr.   | 4      | 8      | 33%     |
| 05 avr.   | 2      | 1      | 67%     |
| 06 avr.   | 3      | 4      | 43%     |
| 08 avr.   | 0      | 1      | 0%      |
| 09 avr.   | 1      | 1      | 50%     |
| **Total** | **12** | **18** | **40%** |

**Conclusion partielle :** les picks individuels EV gagnent à ~40%, ce qui est cohérent avec un portefeuille EV+. Mais les coupons, eux, s'effondrent à 18% — un écart qui s'explique entièrement par les mathématiques.

---

## 2. Pourquoi les coupons perdent-ils autant ?

### Le problème de la multiplication des probabilités

Les picks EV sélectionnés ont des probabilités typiquement entre 25% et 57%. C'est voulu : un EV+ sur une cote de 3.00 ne peut venir que d'un événement improbable bien évalué.

Mais en coupon, ces probabilités se **multiplient** :

| Prob. moy. par leg | 2 legs | 3 legs | 6 legs |
| ------------------ | ------ | ------ | ------ |
| 35%                | 12.3%  | 4.3%   | 0.2%   |
| 45%                | 20.3%  | 9.1%   | 0.8%   |
| 55%                | 30.3%  | 16.6%  | 2.8%   |

**Les 2 coupons à 6 legs du 3 avril n'avaient mathématiquement quasiment aucune chance de passer** — peu importe la qualité des picks.

Exemple concret du 3 avril : 12 picks à probabilités 23%-64%, assemblés en 2 coupons de 6 → perte garantie à >99%.

### Ce que les audits révèlent

Les raisons de rejet sur la période :

| Raison                                  | Occurrences |
| --------------------------------------- | ----------- |
| EV insuffisant (< 0.08)                 | **839**     |
| Probabilité directionnelle insuffisante | 632         |
| Score qualité insuffisant               | 61          |
| Cote trop haute (EV plafonné)           | 47          |
| EV au-dessus du plafond dur             | 28          |
| Cote trop basse                         | 19          |

**839 picks à EV insuffisant** — c'est le bassin potentiel de la "safe value". Beaucoup ont des probabilités ≥ 60-80%, rejetés uniquement parce que leur EV ne franchit pas le seuil de 0.08.

De plus, **82 picks viables au niveau pick ont été refusés** uniquement parce que le score modèle était trop faible pour la fixture.

---

## 3. Le pool "Safe Value" existe déjà dans les données

### Exemples de picks haute probabilité rejetés

Extraits représentatifs des audits :

| Marché               | Prob. | EV     | Raison rejet                   |
| -------------------- | ----- | ------ | ------------------------------ |
| V1 Spain vs Egypt    | 94.1% | +0.082 | EV insuffisant (< 0.08 strict) |
| V1 Senegal vs Gambia | 79.6% | -0.069 | EV insuffisant                 |
| PLUS DE 0.5 MT       | 78.9% | +0.096 | Score qualité insuffisant      |
| PLUS DE 0.5 MT       | 76.5% | +0.109 | Score qualité insuffisant      |
| PLUS DE 1.5          | 78.5% | +0.091 | Score qualité insuffisant      |
| MOINS DE 3.5         | 76.0% | +0.056 | EV insuffisant                 |
| MOINS DE 3.5         | 74.3% | +0.010 | EV insuffisant                 |
| V1 England vs Japan  | 67.7% | +0.056 | EV insuffisant                 |
| PLUS DE 2.5          | 66.0% | +0.208 | Cote trop basse                |
| V2 (72.0%)           | 72.0% | +0.361 | Cote trop basse                |

Ces picks ont une forte probabilité réelle selon le modèle, mais sont exclus du flux EV principal pour des raisons techniques, pas de fiabilité.

---

## 4. Est-ce une bonne idée ?

**Verdict : oui, sous conditions strictes.**

### Arguments pour

1. **Le problème est réel** : le moteur EV produit des picks à haute variance (P = 25-55%). Ces picks sont corrects pour le ROI long terme, mais désastreux en coupon combiné.

2. **Le pool safe existe** : les 839 rejets "EV insuffisant" contiennent des dizaines de picks à P ≥ 65-80% chaque jour. Ce ne sont pas des picks "mauvais" — ils sont simplement trop chers pour le bookmaker (cote faible = EV limité).

3. **La complémentarité est naturelle** : picks EV = paris individuels ou combinés très courts. Picks safe = coupons de 2-3 sélections à haute probabilité, cotes modestes mais combinées décentes.

4. **C'est une pratique sharp connue** : les betteurs professionnels séparent "value bets" (Paris à EV+) et "high-prob accumulators" (paris sur la régularité). Ces deux portefeuilles coexistent chez les bookmakers sérieux.

### Arguments contre / risques

1. **"Haute probabilité" ne signifie pas "certitude"** : un pick à 75% perd encore 1 fois sur 4. Un coupon de 3 picks à 75% passe à ~42% — toujours moins d'1 fois sur 2.

2. **Margin bookmaker amplifiée** : les cotes basses (1.15-1.50) ont souvent une marge plus forte en proportion. Le EV peut être légèrement négatif sans qu'on s'en aperçoive.

3. **Biais de confirmation** : les matchs très déséquilibrés (ex : Spain vs Egypt, Senegal vs Gambia) que le moteur détecte à 94% ou 80% sont aussi ceux où la cote reflète déjà parfaitement la probabilité. Il n'y a pas d'inefficience à exploiter.

4. **Indépendance des picks** : si 3 matchs partagent la même condition (ex : météo, journée chargée), leur probabilité n'est pas indépendante. Le coupon combined est alors plus risqué qu'annoncé.

### Conclusion

L'idée est **bonne si la couche safe est séparée, disciplinée, et backtestée indépendamment**. Elle est **dangereuse si on relâche les contraintes EV sans guard-rails**.

---

## 5. Ce qu'il faut implémenter — Plan concret

### Nouvelle couche : `SAFE_VALUE`

Critères distincts du flux EV principal :

| Critère           | Flux EV (actuel)              | Flux SAFE VALUE (nouveau)                                                                |
| ----------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| Probabilité       | ≥ seuil directionnel (30-45%) | **≥ 68%** (strict)                                                                       |
| EV minimum        | ≥ 0.08                        | **≥ 0.00** (non-négatif)                                                                 |
| EV maximum        | plafond dur                   | plafond identique                                                                        |
| Cote min.         | 1.30 (actuel)                 | **1.15** (autorisé)                                                                      |
| Cote max.         | illimitée (avec cap EV)       | **2.20** (pas de valeur gonflée)                                                         |
| Score modèle      | selon seuil compétition       | **même seuil** (ne pas baisser)                                                          |
| Marchés autorisés | tous                          | **PLUS DE 0.5 MT, PLUS DE 1.5, MOINS DE 3.5, V1/V2, 1X, 2X fortes favorites uniquement** |

### Coupon `SAFE` distinct

- Type de coupon : `SAFE` (nouveau type, distinct de SPECULATIF/PREMIUM)
- **2 legs maximum** (jamais 3 si les deux picks ont déjà une incertitude)
- Legs issus exclusivement du flux SAFE_VALUE
- Jamais mélanger un pick EV et un pick safe dans le même coupon
- avgQuality non applicable (métrique EV inadaptée à ce mode)

### Métriques de backtest spécifiques

Le backtest pour SAFE_VALUE doit mesurer :

- **Taux de passage coupon** (non pas ROI individuel)
- **Taux de passage 2-leg** par seuil de probabilité (P ≥ 68%, 72%, 75%)
- **ROI combiné** : on mise 1 unité sur le coupon, on compare au gain combiné
- **Calibration** : est-ce que P ≥ 68% prédit bien ~68% de passage ?

---

## 6. Recommandation immédiate

Avant d'implémenter quoi que ce soit :

1. **Backtest rétroactif** sur la période 31 mars – 10 avril : extraire tous les picks avec P ≥ 68% et EV ≥ 0, simuler des coupons 2-legs, calculer le taux de passage réel.

2. **Définir les marchés** : se concentrer d'abord sur PLUS DE 0.5 MT, PLUS DE 1.5, et MOINS DE 3.5 — ce sont les marchés les plus fréquents à haute probabilité dans les données.

3. **Ne pas modifier le flux EV** : la couche safe est additive. Elle ne remplace rien, elle ajoute un second canal de génération de coupons.

4. **Mettre un guard-rail de séparation** : un même match ne peut pas fournir un pick EV ET un pick safe dans deux coupons différents le même jour (éviter la surexposition).

---

_Ce rapport est basé sur l'analyse de 13 fichiers d'audit couvrant 11 jours de données réelles (31 mars – 10 avril 2026), soit 265 fixtures analysées, 1 627 picks évalués._
