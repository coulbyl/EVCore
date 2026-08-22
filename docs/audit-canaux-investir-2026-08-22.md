# Audit — VALUE/SAFE, canaux par ligue, et redéfinition d'Investir

> Rédigé le 2026-08-22, à la fin de la reconstruction du composeur de coupon
> (ROADMAP.md Bloc 12). Toutes les mesures viennent de la base de production :
> 54 614 sélections réglées à cote réelle, 5 passes de régénération de coupons
> couvrant 2025-01 → 2026-08.
>
> Ce document répond à trois questions posées ensemble : VALUE et SAFE
> doivent-ils encore exister ; que réussit et que rate chaque canal par ligue ;
> et faut-il refonder Investir comme point de filtre unique.

---

## 1. Verdict en une page

**VALUE et SAFE, en tant que canaux, ne produisent presque rien qui leur soit
propre.** 92% des sélections de VALUE et 95% de celles de SAFE reprennent
exactement un pick déjà émis en Phase 1 — même run, même marché, même pick,
même probabilité à 4 décimales. Et l'acte de re-sélectionner **dégrade** la
calibration : sur le même vivier de picks Phase 1, ratio réalisé/annoncé 0.915
pour ceux qu'ils ne reprennent pas, **0.739** pour ceux qu'ils reprennent.

**Mais il y a une nuance qui interdit de les supprimer d'un trait** : les 8% de
picks réellement propres à VALUE font **+14.1% de ROI** (n=173) contre −0.8%
pour ses doublons. C'est faible statistiquement (SE 10.1), mais c'est le seul
endroit du système où une couche de sélection ajoute quelque chose plutôt que
d'en retirer. SAFE n'a pas cette excuse : ses 29 picks propres font −19.7%.

**Sur les canaux : 2 sur 18 sont positifs** après shrinkage empirique —
DOUBLE_CHANCE (+2.24%) et DRAW (+0.74%). Tout le reste est négatif, et la
moyenne globale est de −4.48%.

**Sur les couples canal × ligue : 16 sur 120** dépassent zéro après shrinkage,
et **11 des 15 meilleurs sont DRAW**. Il n'y a pas une mosaïque de niches
rentables à découvrir : il y a un canal qui marche, et du bruit autour.

**Sur Investir : la structure actuelle n'est pas soutenue par la mesure.** Les
5 plafonds `topN` ont été testés en apparié : **aucun n'est significatif**, et
les deux plus proches du seuil sont négatifs. Sur DRAW, le plafond coûte 4.4
points par jour sur le meilleur canal du système. Le concept de `topN` est à
supprimer en entier, sans exception — y compris pour VALUE, dont l'avantage
apparent (t = 0.80 sur cinq essais) est ce que le hasard produit.

---

## 2. VALUE et SAFE doivent-ils exister ?

### 2.1 Ce qu'ils produisent réellement

Ce sont des filtres de Phase 2 depuis le 2026-08-18 : ils ne scannent plus
`evaluatedMarkets`, ils choisissent parmi les décisions de Phase 1.

| canal | sélections | doublons Phase 1 | picks propres |
| ----- | ---------- | ---------------- | ------------- |
| VALUE | 2 122      | 1 949 (92%)      | 173 (8%)      |
| SAFE  | 632        | 603 (95%)        | 29 (5%)       |

### 2.2 Sélectionner dégrade la calibration

Test A/B direct sur le **même** vivier de picks Phase 1, selon que VALUE/SAFE
les ont repris ou non :

|                              | n      | annoncé | réel  | ratio     |
| ---------------------------- | ------ | ------- | ----- | --------- |
| picks Phase 1 **non repris** | 49 308 | 0.501   | 0.459 | **0.915** |
| picks Phase 1 **repris**     | 2 552  | 0.656   | 0.485 | **0.739** |

L'acte de sélection coûte 18 points de ratio. Le mécanisme est visible dans les
colonnes du milieu : ils choisissent les probabilités annoncées les plus hautes
(0.656 contre 0.501), et c'est précisément là que le modèle se trompe le plus.

Ce n'est pas propre à VALUE/SAFE. CONSENSUS avait la même pathologie sous une
forme plus pure — il publiait `maxProbability`, le maximum des canaux
d'accord, et le maximum de _k_ estimations bruitées est biaisé vers le haut par
construction : ratio 0.726 alors qu'il agrège DOMINANT à 0.918. Il a cessé
d'émettre des sélections le 2026-08-22.

### 2.3 La nuance qui compte

En séparant doublons et picks propres :

| canal | origine         | n     | ratio     | ROI         | SE    |
| ----- | --------------- | ----- | --------- | ----------- | ----- |
| VALUE | doublon Phase 1 | 1 949 | 0.721     | −0.80%      | 3.08  |
| VALUE | **pick propre** | 173   | **0.845** | **+14.13%** | 10.11 |
| SAFE  | doublon Phase 1 | 603   | 0.787     | −7.69%      | 3.11  |
| SAFE  | pick propre     | 29    | 0.667     | −19.66%     | 14.84 |

VALUE, quand il émet un pick que personne d'autre n'a émis, est mieux calibré
(0.845 contre 0.721) et rentable. À n=173 et t≈1.4, ce n'est pas établi — mais
c'est la seule piste du système où une couche de sélection **ajoute**.

### 2.4 Recommandation

- **SAFE : à supprimer comme canal.** 95% de doublons, ses picks propres sont
  les pires du lot (n=29, −19.7%), et son ROI shrinké est le 4ᵉ pire des 18
  canaux (−6.88%). Il n'est déjà plus dans le pool de coupon. Ce qu'il
  exprimait — « haute probabilité » — est directement lisible sur la
  probabilité calibrée, sans canal dédié.
- **VALUE : à réduire à ses picks propres, pas à supprimer.** Il ne devrait
  émettre une sélection que lorsqu'aucun canal de Phase 1 n'a déjà émis ce
  pick. C'est un changement d'une ligne dans `value.strategy.ts` (ignorer les
  candidats déjà présents dans `previousDecisions`), et il isole exactement le
  segment qui performe. **À valider avant de shipper** : n=173 ne suffit pas,
  il faut un backtest dédié au niveau jambe.
- **Ne pas les supprimer du modèle de données.** Des milliers de lignes
  historiques portent ces canaux, et les abonnements `CHANNEL_VALUE`/
  `CHANNEL_SAFE` existent.

---

## 3. Ce qui marche, et ce qui échoue

### 3.1 Par canal, après shrinkage

Chaque canal est ramené vers la moyenne globale proportionnellement à sa
fiabilité (`t2/(t2+SE²)`). La variance réelle entre canaux est de 0.00165, soit
un écart-type de **4.1 points de ROI** — l'hétérogénéité entre canaux est
réelle, mais son amplitude est du même ordre que la marge du bookmaker.

| canal               | n      | ROI brut | poids | **ROI shrinké** |
| ------------------- | ------ | -------- | ----- | --------------- |
| DOUBLE_CHANCE       | 1 431  | +4.34%   | 0.76  | **+2.24%**      |
| DRAW                | 7 235  | +1.74%   | 0.84  | **+0.74%**      |
| VALUE               | 2 122  | +0.42%   | 0.65  | −1.28%          |
| DOMINANT            | 5 131  | −1.51%   | 0.90  | −1.80%          |
| TEAM_TOTAL          | 1 417  | −2.08%   | 0.75  | −2.69%          |
| DRAW_NO_BET         | 811    | −4.61%   | 0.67  | −4.57%          |
| GOALS               | 17 422 | −4.63%   | 0.97  | −4.63%          |
| OVER_UNDER_HT       | 712    | −4.87%   | 0.65  | −4.73%          |
| FIRST_HALF          | 4 547  | −4.82%   | 0.86  | −4.77%          |
| RESULT_TOTAL_GOALS  | 1 028  | −8.46%   | 0.29  | −5.62%          |
| WIN_EITHER_HALF     | 915    | −6.97%   | 0.71  | −6.24%          |
| BTTS                | 5 191  | −6.70%   | 0.91  | −6.50%          |
| RESULT_BTTS         | 1 370  | −12.20%  | 0.27  | −6.60%          |
| SAFE                | 632    | −8.24%   | 0.64  | −6.88%          |
| CLEAN_SHEET         | 1 193  | −10.13%  | 0.50  | −7.30%          |
| CORRECT_SCORE       | 1 764  | −17.83%  | 0.31  | −8.64%          |
| HALF_TIME_FULL_TIME | 496    | −18.95%  | 0.29  | −8.66%          |
| WIN_TO_NIL          | 1 197  | −15.96%  | 0.45  | −9.63%          |

Moyenne globale : **−4.48%**. La marge bookmaker moyenne est de 5.36% par
jambe : le système en récupère donc environ 0.9 point en moyenne, et jusqu'à
7.6 points sur son meilleur canal.

### 3.2 Par canal × ligue

**Attention méthodologique** : à cette granularité, seulement **24% de l'écart
observé entre cases est réel** — les 76% restants sont du bruit
d'échantillonnage. Les valeurs brutes sont donc trompeuses et les valeurs
shrinkées sont les seules exploitables. Une case à +27.95% brut (DRAW/CSL,
n=121) ne pèse que 5% de son propre signal et retombe à +2.21%.

| canal / ligue        | n     | ROI brut | poids | **shrinké** |
| -------------------- | ----- | -------- | ----- | ----------- |
| DRAW / I2            | 1 047 | +6.70%   | 0.37  | **+2.95%**  |
| DRAW / POR           | 561   | +10.36%  | 0.22  | **+2.90%**  |
| DOUBLE_CHANCE / UECL | 144   | +2.74%   | 0.23  | +2.35%      |
| DRAW / BL1           | 217   | +16.80%  | 0.09  | +2.25%      |
| DRAW / CSL           | 121   | +27.95%  | 0.05  | +2.21%      |
| DRAW / TUR1          | 213   | +8.60%   | 0.10  | +1.51%      |
| DRAW / SA            | 392   | +3.75%   | 0.19  | +1.31%      |
| DRAW / SCO1          | 180   | +0.02%   | 0.09  | +0.68%      |
| DRAW / F2            | 250   | −0.41%   | 0.14  | +0.58%      |
| DRAW / SWE2          | 485   | −0.27%   | 0.19  | +0.55%      |
| DOMINANT / FIN1      | 388   | +5.80%   | 0.30  | +0.45%      |

**16 cases sur 120 dépassent zéro. 11 des 15 premières sont DRAW.**

Il n'existe pas de mosaïque de niches rentables à cartographier. Il existe un
canal qui fonctionne (DRAW, le mieux calibré du système avec un ratio
réalisé/annoncé de 1.016), un second correct (DOUBLE_CHANCE), et du bruit.

### 3.3 Pourquoi — le mécanisme, pas la corrélation

Trois régularités expliquent l'essentiel, et elles sont plus utiles que
n'importe quelle liste de ligues.

**a) La fiabilité s'effondre avec la cote de la jambe.** Dans chaque canal :

| canal         | <1.5  | 1.5–2 | 2–2.5 | 2.5–3.5 | >3.5      |
| ------------- | ----- | ----- | ----- | ------- | --------- |
| DOMINANT      | 1.123 | 0.920 | 0.767 | 0.589   | **0.348** |
| DOUBLE_CHANCE | 0.982 | 0.803 | 0.721 | 0.583   | 0.555     |
| GOALS         | 0.984 | 0.908 | 0.828 | 0.748   | —         |

Le modèle est calibré là où le marché est d'accord avec lui, et catastrophique
là où il le contredit. DOMINANT au-delà de 3.5 annonce 57.5% et réalise 20%.

**b) L'edge revendiqué est anti-prédictif.** Sur 51 860 sélections :

| edge (`p − 1/cote`) | n      | annoncé | réel  | ratio     |
| ------------------- | ------ | ------- | ----- | --------- |
| < 0                 | 18 750 | 0.481   | 0.511 | **1.062** |
| 0.00–0.05           | 16 880 | 0.463   | 0.421 | 0.910     |
| 0.05–0.10           | 8 162  | 0.550   | 0.447 | 0.814     |
| 0.10–0.15           | 4 053  | 0.597   | 0.452 | 0.758     |
| 0.15–0.25           | 2 776  | 0.637   | 0.435 | 0.683     |
| > 0.25              | 1 239  | 0.699   | 0.375 | **0.537** |

Le taux réel est **plat** (0.51 → 0.38) pendant que l'annoncé grimpe de 0.481 à
0.699. L'edge ne porte aucune information sur le résultat, seulement sur
l'ampleur de l'erreur du modèle. Là où le modèle price _en dessous_ du marché,
il est même sous-confiant.

C'est le constat le plus lourd de conséquences pour EVCore : **le seuil
`EV ≥ 8%` sélectionne sur une quantité anti-prédictive**, et `VALUE_MIN_EDGE =
0.10` cible exactement la région qui réalise 0.694 de ce qu'elle annonce.

**c) La marge domine.** 5.36% par jambe. Le meilleur canal en récupère 7.6
points, la moyenne 0.9. Prendre la meilleure cote parmi les 4 bookmakers
disponibles rapporte +0.57% par jambe (mesuré, 531 jambes améliorées sur
2 088) — réel et gratuit, mais pas de quoi inverser le signe.

---

## 4. Investir aujourd'hui

### 4.1 Ce que c'est

`investment.constants.ts` + `investment.service.ts` définissent :

- **18 modes** : `probability`, `value`, et 16 modes mono-canal
- **une table `MODE_RANKING`** : par mode, un tri (`probability` ou `edge`) et
  un plafond `topN`, chacun justifié par un backtest daté différent
- **4 buckets de probabilité**, un seuil de cote courte, une liste de canaux à
  ROI négatif, une calibration par canal sur 180 jours, un détecteur
  d'incohérence lambda, un plafond de 15 picks

### 4.2 Les plafonds `topN` ne tiennent pas

Simulation jour par jour : pour chaque canal doté d'un plafond, ROI des N
premiers selon le tri du mode, contre ROI de la liste entière.

| canal      | tri  | topN | n top | ROI top | SE    | ROI liste entière | **écart** |
| ---------- | ---- | ---- | ----- | ------- | ----- | ----------------- | --------- |
| VALUE      | edge | 5    | 1 672 | +3.53%  | 3.35  | +0.42%            | **+3.11** |
| DRAW       | edge | 5    | 3 214 | −1.20%  | 2.64  | +1.74%            | **−2.94** |
| SAFE       | prob | 5    | 546   | −10.02% | 3.28  | −8.24%            | −1.78     |
| DOMINANT   | prob | 5    | 3 155 | −1.93%  | 1.64  | −1.51%            | −0.43     |
| TEAM_TOTAL | edge | 3    | 93    | +3.30%  | 12.16 | −2.08%            | +5.38     |

Un seul plafond sur cinq semble améliorer les choses. Mais la comparaison
ci-dessus mélange des jours différents ; le test correct est **apparié**, top-N
contre liste entière **le même jour** :

| canal      | écart par jour | SE   | **t**     | jours |
| ---------- | -------------- | ---- | --------- | ----- |
| VALUE      | +2.93%         | 3.67 | **+0.80** | 101   |
| TEAM_TOTAL | +6.91%         | 9.89 | +0.70     | 31    |
| DOMINANT   | −0.76%         | 1.52 | −0.50     | 333   |
| SAFE       | −6.19%         | 5.16 | −1.20     | 17    |
| DRAW       | −4.38%         | 2.52 | **−1.74** | 403   |

**Aucun plafond n'est significatif, dans aucun sens.** Et les deux qui
s'approchent le plus du seuil sont **négatifs**. Le meilleur positif est à
t = 0.80 ; sur cinq plafonds testés, le maximum attendu sous l'hypothèse nulle
tourne autour de 1.6–1.8. Conserver celui de VALUE reviendrait à garder la
meilleure de cinq cellules bruitées — exactement le winner's curse que cette
session a passé sa journée à diagnostiquer.

Il y a aussi une raison conceptuelle, indépendante des chiffres : **un plafond
`topN` est lui-même une couche de sélection**, et toutes les couches de
sélection mesurées ce jour-là ont dégradé le résultat — VALUE/SAFE sur les
picks Phase 1 (0.915 → 0.739), CONSENSUS via son `maxProbability`, le composeur
de coupon sur ses propres jambes. Il n'y a aucune raison d'attendre qu'une
sixième fasse exception, et la mesure confirme qu'elle n'en fait pas.

Le commentaire de `MODE_RANKING` affirme pourtant que le tri par edge sur DRAW
« s'améliore de façon monotone chaque année (2023 −11% → 2026 +12%) ». Sur
l'ensemble des données, il fait perdre. C'est le même piège que le reste de la
session : une tranche annuelle de quelques centaines de lignes n'a pas la
puissance de trancher, et on a lu une tendance dans du bruit.

### 4.3 Diagnostic

Investir a été construit comme **une surface de revue exhaustive** : un mode
par canal, pour que rien ne soit invisible. C'était un bon objectif quand la
question était « que calcule-t-on sans le regarder ». Ce n'en est plus un
maintenant qu'on sait que **16 des 18 canaux sont perdants** et que la
granularité fine est à 76% de bruit.

Le coût de cette exhaustivité est triple : 18 modes à maintenir et à
documenter ; une table de tri dont 4 entrées sur 5 sont contredites par la
mesure ; et un utilisateur qui doit choisir entre 18 vues sans qu'aucune ne lui
dise laquelle vaut quelque chose.

---

## 5. Redéfinition proposée

> **Implémenté le 2026-08-22** (branche `fix/todo-2026-08-15`, ROADMAP.md
> Bloc 13). Ce qui suit décrit la cible ; c'est aussi ce que le code fait
> désormais, à une réserve près : la réduction de VALUE à ses picks propres
> (§2.4) reste **non shippée**, en attente d'une validation au niveau jambe.

### 5.1 Principe

Investir doit devenir **le point de filtre unique**, et un filtre se juge à ce
qu'il **exclut**, pas à ce qu'il expose. Trois règles :

1. **Ne montrer que ce qui est mesurément défendable.** Deux canaux sont
   positifs après shrinkage. Ils méritent une place ; les 16 autres méritent
   une explication, pas un onglet.
2. **Trier sur la probabilité calibrée, jamais sur l'EV ni sur l'edge.** Mesuré
   au niveau coupon : le tri par EV perd contre le tri par probabilité dans 13
   configurations appariées sur 16, et hors échantillon −25.94% contre −6.57%.
3. **Afficher la fréquence de réussite à côté de la cote, toujours.** Une cote
   sans son taux se lit comme une promesse.

### 5.2 Structure cible

Remplacer les 18 modes par **trois vues** :

- **« Ce qu'on assume »** — DOUBLE_CHANCE et DRAW, les deux canaux positifs
  après shrinkage, triés par probabilité calibrée. Avec, pour DRAW, la
  restriction de ligue qui existe déjà (`DRAW_STAKED_LEAGUES`) : I2, POR, BL1,
  CSL sont ses 4 meilleures cases mesurées.
- **« En observation »** — tout le reste, une seule liste filtrable par canal,
  avec le ROI shrinké du canal affiché en tête. Pas un onglet par canal : une
  colonne.
- **« Écarté »** — ce que les garde-fous ont retiré et pourquoi (edge > 0.10,
  cote < 1.20, AVOID). C'est la vue qui manque aujourd'hui, et c'est celle qui
  rend un filtre auditable.

### 5.3 Ce qui disparaît

- **`topN` en entier — à supprimer, sans exception.** Pas « sauf VALUE » : son
  avantage est à t = 0.80 sur cinq essais, donc indiscernable du hasard, et
  DRAW montre que se tromper coûte 4.4 points par jour sur le meilleur canal du
  système. Une liste complète par canal, plafonnée par le seul
  `INVESTMENT_LIMITS.maxPicks` global, est à la fois plus simple et mieux
  soutenue par la mesure.
- `MODE_RANKING` et ses 18 entrées → un tri unique : la probabilité calibrée.
- `VALUE_MODE_CHANNELS`, `SINGLE_CHANNEL_MODE_MAP`, `SingleChannelMode` → une
  liste de canaux et un filtre.
- `NEGATIVE_ROI_CHANNELS` (liste figée de 2 canaux, datée du 2026-07-06) → le
  ROI shrinké calculé, qui dit que 16 canaux sur 18 sont négatifs. Une liste
  codée en dur qui en nomme 2 est trompeuse.
- `PROBABILITY_BUCKETS` (4 niveaux) → la probabilité calibrée elle-même, qui
  est désormais fiable (ratio 1.016).

### 5.4 Ce qui reste et se renforce

- La **calibration par canal** (`channel-reliability.ts`) — c'est l'acquis de
  la session, ratio passé de 0.819 à 1.016.
- Le **plafond d'edge** (`MAX_LEG_EDGE = 0.10`) et le **plancher de cote**
  (`MIN_LEG_ODDS = 1.20`), à remonter du coupon vers Investir pour qu'ils
  s'appliquent à toute surface de mise.
- Le **détecteur d'incohérence lambda** (pick UNDER quand λ dit OVER) — c'est
  le bon type de signal : une caractéristique du pick, pas un historique de
  résultats. Vérifié à −7 à −9pp de taux de réussite sur des milliers de cas.
- **AVOID**, seul signal de sélection du système qui ait jamais tenu (−20% de
  ROI sur ce qu'il écarte, 3 saisons) — et lui aussi construit sur une
  divergence, pas sur un historique découpé.

---

## 6. Ce qu'il ne faut pas refaire

**Ne pas chercher de signal en découpant les résultats passés.** Six familles
testées le 2026-08-22, toutes mortes ou inversées : tri par EV, `signalScore`
(canal×jour×ligue), edge revendiqué, qualité par (canal, tranche), qualité par
(ligue, canal, tranche), ajustement conditionné à la sélection. La
décomposition de variance dit pourquoi — 88% de bruit à granularité fine contre
46-72% au niveau canal ou ligue seuls.

**Ne pas décider sur un ROI de coupon.** SD 1.821 à 3 coupons/jour : 10 points
demandent ~2.5 ans à détecter, 2 points ne le seront jamais. La boucle
d'apprentissage doit tourner au niveau **jambe** (SD 1.247, ~7 000/mois, 2
points en ~4 mois).

**Ne pas lire une tranche annuelle comme une tendance.** C'est ce qui a produit
la règle `DRAW / edge / top5`, qui coûte 4.4 points par jour sur le meilleur
canal du système.

**Ne pas garder « celui qui marche » parmi plusieurs règles testées.** Cinq
plafonds `topN` ont été mesurés ; un seul paraît positif, à t = 0.80. Sur cinq
essais c'est exactement ce que le hasard produit. La règle générale : quand on
teste _k_ variantes, la meilleure doit franchir un seuil relevé en conséquence,
sinon on ne sélectionne que du bruit — c'est le même mécanisme que le winner's
curse du composeur, appliqué aux règles plutôt qu'aux picks.

---

## 7. Ce qui reste crédible

**Le mouvement des cotes.** 16 615 matchs ont des cotes suivies sur ~15h en
moyenne et personne ne les a jamais regardées. C'est le prédicteur le mieux
établi de la littérature sur les paris sportifs, et surtout c'est une entrée
**causale** — pas un historique de résultats découpé en tranches, catégorie
dans laquelle tombent les six signaux morts. C'est aussi la forme du seul
signal qui ait tenu chez nous, `AVOID`.

C'est la seule piste de découverte que cet audit laisse ouverte.

---

## Annexe — sources et méthode

- Population : `channel_selection` rank 1, décisions `SELECTED`, cote réelle
  présente, résultat réglé. 54 614 lignes pour l'analyse canal/ligue, 51 860
  hors canaux meta pour l'analyse d'edge.
- **Shrinkage** : empirical Bayes. Variance réelle entre cases = variance
  observée − variance d'échantillonnage ; chaque case ramenée vers son parent
  avec le poids `t²/(t²+SE²)`. C'est ce qui empêche une case à n=121 et +27.95%
  brut de passer pour un résultat.
- **ROI** : `cote − 1` si gagné, `−1` sinon. Mise plate.
- **Ratio de calibration** : taux réel / probabilité annoncée moyenne. Préféré
  à l'écart absolu parce que dans un produit de probabilités, c'est l'erreur
  **relative** qui compose.
- Toutes les SE supposent l'indépendance des observations, vérifiée sur les
  jambes de coupon (17/29/21 observés contre 15/33/19 attendus, χ² ≈ 1.2).
