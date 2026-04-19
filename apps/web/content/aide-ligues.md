# Guide des paris par ligue

> Ce guide explique quels paris fonctionnent dans chaque ligue, sur quelle fourchette de cotes, et lesquels sont à éviter. Les résultats sont issus de simulations sur 3 saisons passées. 🟢 à jouer si le moteur le propose · ⚠️ données insuffisantes, prudence · 🔴 à éviter même si la cote semble intéressante.

---

## Abréviations

Pour lire les tableaux de chaque ligue :

- **Résultat du match** : victoire à domicile, match nul ou victoire à l'extérieur
- **Les 2 équipes marquent** : les deux équipes inscrivent au moins un but (Oui ou Non)
- **Plus/Moins de buts** : plus ou moins de 2.5 buts dans le match
- **Vainqueur à la mi-temps** : quelle équipe mène (ou égalité) à la pause
- **Plus de 1.5 buts à la mi-temps** : au moins 2 buts marqués avant la mi-temps

---

## Règles communes

Ces règles s'appliquent à toutes les ligues. Le moteur les vérifie automatiquement :

- Le moteur ne propose un pari que s'il détecte un avantage réel par rapport aux cotes Pinnacle
- Si la cote est inférieure au minimum de la ligue, le pari est ignoré
- Si l'avantage calculé dépasse 90 %, c'est une erreur du modèle — ne pas jouer

---

## Canal prédiction

Le dashboard affiche aussi un **canal prédiction** distinct du canal pari.

- **Un pari (`BET`)** signifie que le moteur voit de la valeur contre la cote bookmaker
- **Une prédiction** signifie que le modèle voit une issue plus probable que les autres, même sans avantage de cote

Le badge de prédiction apparaît sous la forme :

- **`→ DOM 63%`** = le modèle voit une victoire domicile comme issue la plus probable, avec **63 %** de confiance
- **`→ EXT 58%`** = victoire extérieur jugée la plus probable
- **`→ NUL 56%`** = match nul jugé le plus probable

### Comment le lire

- **`BET` + prédiction** : les deux canaux vont dans le même sens, c'est le cas le plus fort
- **`NO BET` + prédiction** : le modèle a une lecture claire du match, mais sans edge suffisant pour parier
- **`BET` sans prédiction** : le pari vient d'un angle valeur, pas d'un favori net dans les probabilités 1X2

### Couleurs et statut

- **Indigo** : prédiction encore en attente
- **Vert** : prédiction correcte après settle
- **Rouge** : prédiction incorrecte après settle

Dans la carte "Prédictions du jour", le point de statut suit la même logique :

- vert = correct
- rouge = incorrect
- gris = en attente

### Ce qu'il faut retenir

- Une **prédiction n'est pas un conseil de mise**
- Elle sert surtout à lire la conviction brute du modèle sur le **1X2**
- Une prédiction à **55-60 %** est déjà un signal exploitable dans les ligues calibrées
- Si la ligue est désactivée pour le canal prédiction, aucun badge n'apparaît même si un `BET` existe

---

## Canal Safe Value

Le badge **Safe** correspond à un canal différent du pari EV principal.

Il cherche des picks :

- à **probabilité élevée** (`P >= 68 %`)
- avec un **EV minimum positif** (`EV >= 5 %`)
- dans une zone de **cotes courtes** (`1.15 à 2.20`)

L'idée n'est pas de trouver le plus gros edge, mais un pick plus stable et plus lisible, souvent sur un favori ou un scénario très attendu par le modèle.

### Ce que montre le backtest relancé le 19 avril 2026

- **155 picks**
- **99 gagnants**
- **63.9 % de win rate**
- **cote moyenne 1.58**
- **ROI global -1.1 %**

Le point important : **un fort taux de réussite ne suffit pas** sur des cotes courtes. Le Safe Value gagne souvent, mais peut quand même être peu rentable ou légèrement négatif si les gagnants paient trop peu.

### Comment le lire

- **`BET` + `Safe`** : le match a à la fois un angle valeur et un pick plus conservateur
- **`NO BET` + `Safe`** : cas possible si le signal EV principal ne passe pas, mais que le modèle voit encore un favori très solide
- **`Safe` seul n'est pas un feu vert automatique** : il faut surtout le lire comme un pick à faible variance, pas comme le meilleur rendement attendu du jour

### Ce qu'on retient du backtest actuel

Le Safe Value devient vraiment utile quand on descend au niveau **ligue + marché + type de pick**.

#### 🟢 Segments qui ressortent bien

- **Premier League — 1X2 domicile < 2.0**  
  `4/4` gagnants, **+47.0 % ROI**, cote moyenne `1.47`
- **Premier League — Under 3.5 < 2.0**  
  `2/2` gagnants, **+53.5 % ROI**, cote moyenne `1.54`
- **Ligue 1 — 1X2 domicile < 2.0**  
  `9/11` gagnants, **+28.5 % ROI**, cote moyenne `1.59`
- **Serie B — Under 3.5 < 2.0**  
  `4/4` gagnants, **+42.8 % ROI**, cote moyenne `1.43`
- **League One — Plus de 0.5 but à la mi-temps < 2.0**  
  `5/6` gagnants, **+14.0 % ROI**, cote moyenne `1.40`

#### ⚠️ Segments lisibles mais pas assez rentables

- **League Two — 1X2 domicile < 2.0**  
  `11/18` gagnants, **-1.4 % ROI**  
  Le modèle lit souvent correctement le favori, mais le prix reste trop court.
- **Championship — 1X2 domicile < 2.0**  
  `8/11` gagnants, **+7.2 % ROI**  
  C'est le seul sous-segment un peu propre, mais la ligue globale reste à peine négative.
- **UEFA Europa League — 1X2 domicile < 2.0**  
  `4/6` gagnants, **+3.2 % ROI**  
  Trop fragile pour en faire une règle forte.

#### 🔴 Segments à éviter

- **UEFA Europa Conference League — 1X2 domicile < 2.0**  
  `3/9` gagnants, **-47.6 % ROI**
- **La Liga — 1X2 domicile < 2.0**  
  `3/6` gagnants, **-21.8 % ROI**
- **Ligue 1 — Under 3.5 < 2.0**  
  `1/3` gagnant, **-50.3 % ROI**
- **2. Bundesliga — 1X2 domicile < 2.0**  
  `5/9` gagnants, **-12.0 % ROI**

### Lecture par ligue

#### Premier League

- Le Safe Value marche surtout sur les **favoris domicile en 1X2**
- Le **Under 3.5** court est aussi ressorti proprement
- Le signal est bon, mais encore sur faible volume

#### Ligue 1

- Le vrai segment utile est le **1X2 domicile**
- Le canal Safe devient trompeur dès qu'il bascule sur **Under 3.5**

#### Serie B

- Le meilleur signal actuel est **Under 3.5**
- Le Safe y fonctionne mieux sur les buts que sur le pur 1X2

#### League One

- Le Safe global n'est pas rentable
- En revanche, **Over 0.5 but à la mi-temps** sauve clairement le canal
- Le **1X2 domicile** y est trop souvent joué à un mauvais prix

#### Championship

- Le Safe global reste faible
- Si on le lit quand même, il faut se limiter aux **favoris domicile sous 2.0**
- Dès qu'on monte en cote sur le 1X2 domicile, le canal se casse

#### UEFA Europa Conference League

- Le Safe Value est mauvais presque partout
- Le signal le plus toxique est le **1X2 domicile**
- Ici, le badge **Safe** ne doit pas être interprété comme un bon signe

### Règle pratique

- Le badge **Safe** est utile pour repérer les matchs où le modèle voit un favori clair
- Il devient réellement exploitable seulement dans les ligues et segments qui tiennent au backtest
- Si tu veux maximiser le rendement, le canal **EV** reste prioritaire
- Si tu veux filtrer les picks trop agressifs, le **Safe Value** est un bon contrepoint visuel, mais pas une validation autonome

---

## Premier League (PL) ✅

**Profil :** championnat très concurrentiel où les bookmakers évaluent très bien les favoris. Les opportunités se trouvent uniquement sur les outsiders et les matchs nuls à cotes élevées.

### 🟢 À jouer

- 🟢 **Match nul** — cotes **5.00 à 7.99** — rendement observé **+83.8 %** sur 74 paris
- 🟢 **Victoire extérieur** — cotes **3.00 à 6.99** — rendement observé **+61.8 %** sur 24 paris
- 🟢 **Les 2 équipes marquent : Oui** — cotes **2.00 à 2.99** — rendement observé **+16.6 %** sur 12 paris

### ⚠️ Trop peu de données

- ⚠️ **Plus de 1.5 buts à la mi-temps** — cotes 2.00 à 2.99 — bon résultat mais seulement 3 paris

### 🔴 À éviter

- 🔴 **Match nul** à cotes ≥ 8.00 — résultats systématiquement négatifs
- 🔴 **Les 2 équipes marquent : Non** — le niveau offensif de la PL rend ce pari perdant
- 🔴 **Vainqueur à la mi-temps (toutes options)** — résultats négatifs sur 3 saisons

> **En pratique :** Le match nul entre 5.0 et 8.0 est le signal le plus fiable de tout le système. La victoire extérieure fonctionne aussi sur toute la fourchette 3.0–7.0. Éviter de parier sur la victoire à domicile — le moteur ne trouve pas d'avantage dans cette ligue pour ce pari.

---

## Bundesliga (BL1) ✅

**Profil :** championnat à fort scoring, en moyenne 3.4 buts par match. Les paris sur les buts et la mi-temps sont les plus adaptés.

### 🟢 À jouer

- 🟢 **Les 2 équipes marquent : Oui** — cotes **2.00 à 2.99** — rendement observé **+48.1 %** sur 10 paris
- 🟢 **Les 2 équipes marquent : Non** — cotes **3.00 à 4.99** — rendement observé **+68.1 %** sur 8 paris
- 🟢 **Vainqueur à la mi-temps : équipe visiteur** — cotes **3.00 à 4.99** — rendement observé **+21.9 %** sur 27 paris

### ⚠️ Trop peu de données

- ⚠️ **Plus de 2.5 buts** — cotes 2.00 à 2.99 — bon résultat mais seulement 7 paris
- ⚠️ **Plus de 1.5 buts à la mi-temps** — cotes 2.00 à 2.99 — bon résultat mais seulement 5 paris

### 🔴 À éviter

- 🔴 **Les 2 équipes marquent : Non** à cotes 2.00 à 2.99 — trop risqué dans ce championnat à gros scores
- 🔴 **Victoire à domicile** — résultats négatifs dans cette ligue

> **En pratique :** "Les 2 équipes marquent : Non" ne fonctionne que si les cotes sont **au-dessus de 3.0** — à cotes courtes, c'est perdant car la Bundesliga marque beaucoup. Le vainqueur à la mi-temps côté visiteur est le meilleur signal de volume.

---

## Série A (SA) ✅

**Profil :** championnat tactique et équilibré, moins de buts que les autres ligues. Les paris sur les buts et les nuls de mi-temps sont les plus pertinents.

### 🟢 À jouer

- 🟢 **Les 2 équipes marquent : Oui** — cotes **2.00 à 2.99** — signal principal de la ligue
- 🟢 **Vainqueur à la mi-temps : match nul** — cotes **3.00 à 4.99** — signal secondaire validé

### ⚠️ Trop peu de données

- ⚠️ **Match nul** à cotes ≥ 5.0 — signal possible mais pas encore confirmé

### 🔴 À éviter

- 🔴 **Victoire à domicile** à cotes ≥ 3.00 — le moteur surestime trop souvent la domination à domicile dans cette ligue
- 🔴 **Moins de 2.5 buts** — résultats négatifs malgré le faible scoring apparent

> **En pratique :** Ligue défensive — miser sur "les 2 équipes marquent : Oui" et les nuls à la mi-temps. Éviter les paris "moins de buts" car le moteur les évalue mal dans cette ligue.

---

## Premier Liga Portugal (POR) ✅

**Profil :** peu de paris générés, mais excellente précision quand le moteur intervient. Signal clair sur les matchs nuls.

### 🟢 À jouer

- 🟢 **Match nul** — cotes **3.00 à 4.99** — rendement observé **+109.7 %** sur 9 paris
- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99** — rendement observé **+16.1 %** sur 8 paris

### 🔴 À éviter

- 🔴 **Victoire à domicile** à cotes ≥ 3.00 — hors de la zone profitable
- 🔴 **Victoire à l'extérieur** — résultats négatifs de manière constante

> **En pratique :** Le match nul en cotes moyennes (3.0–5.0) est le signal dominant. Le moteur propose peu de paris dans cette ligue — attendre sa sélection sans forcer.

---

## Championship (CH) ✅

**Profil :** bon nombre de paris générés. Deux signaux solides et complémentaires. Le moteur est particulièrement performant sur les paris de mi-temps à domicile.

### 🟢 À jouer

- 🟢 **Vainqueur à la mi-temps : équipe à domicile** — cotes **2.00 à 4.99** — rendement observé **+43.9 %** sur 35 paris, confirmé sur 2 saisons
- 🟢 **Les 2 équipes marquent : Non** — cotes **2.00 à 2.99** — rendement observé **+41.4 %** sur 22 paris

### ⚠️ Trop peu de données

- ⚠️ **Victoire à l'extérieur** — cotes 3.50 à 4.99 — bon résultat mais seulement 2 paris

### 🔴 À éviter

- 🔴 **Vainqueur à la mi-temps : équipe visiteur** — rendement **-86.8 %** sur 22 paris — le pire pari du système
- 🔴 **Match nul** — rendement **-56.9 %** sur 9 paris
- 🔴 **Les 2 équipes marquent : Oui** — 0 victoire sur 4 paris

> **En pratique :** Le vainqueur à la mi-temps côté domicile est le signal dominant — il fonctionne aussi bien en cotes courtes (2.0–3.0) qu'en cotes plus longues (3.0–5.0). Ne jamais parier sur l'équipe visiteur à la mi-temps dans ce championnat.

---

## Ligue 1 (L1) ✅

**Profil :** calibration saine, deux signaux clairs. Les favoris à domicile en cotes moyennes sont le cœur de cette ligue.

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99** — rendement observé **+46.8 %** sur 18 paris
- 🟢 **Les 2 équipes marquent : Oui** — cotes **2.10 à 2.99** — rendement observé **+9.2 %** sur 6 paris

### 🔴 À éviter

- 🔴 **Victoire à domicile** à cotes ≥ 3.00 — hors de la zone profitable
- 🔴 **Les 2 équipes marquent : Non** — résultats négatifs de manière constante
- 🔴 **Vainqueur à la mi-temps (toutes options)** — résultats négatifs sur 3 saisons

> **En pratique :** Uniquement les favoris à domicile entre 2.0 et 3.0. "Les 2 équipes marquent : Oui" est jouable, mais le signal est léger — éviter si les cotes tombent sous 2.10.

---

## Segunda División (SP2) ⚠️

**Profil :** deux bons signaux identifiés mais fiabilité globale non entièrement confirmée. À jouer avec prudence.

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **1.50 à 1.99** — rendement observé **+34.1 %** sur 12 paris
- 🟢 **Plus de 2.5 buts** — cotes **2.00 à 2.99** — rendement observé **+19.9 %** sur 19 paris

### 🔴 À éviter

- 🔴 **Victoire à domicile** à cotes ≥ 2.00 — en dehors de la zone de valeur
- 🔴 **Victoire à l'extérieur** — résultats négatifs

> **En pratique :** Uniquement les grands favoris à domicile (cotes inférieures à 2.0). Le "plus de 2.5 buts" en cotes courtes complète bien. Prudence sur l'exposition dans cette ligue.

---

## 2. Bundesliga (D2) ⚠️

**Profil :** bon signal sur les victoires à l'extérieur, mais fiabilité globale non entièrement confirmée.

### 🟢 À jouer

- 🟢 **Victoire à l'extérieur** — cotes **2.00 à 2.99** — rendement observé **+49.7 %** sur 12 paris

### 🔴 À éviter

- 🔴 **Victoire à domicile** — résultats négatifs de manière constante
- 🔴 **Moins de 2.5 buts** — résultats négatifs

> **En pratique :** Uniquement les victoires à l'extérieur en cotes courtes (2.0–3.0). Signal intéressant mais ligue à surveiller — ne pas trop miser dessus pour l'instant.

---

## Comment lire un pick proposé

Quand le moteur génère un pari, il a déjà vérifié toutes les règles de ce guide. Voici comment valider manuellement :

- **La ligue** — est-elle listée avec ✅ dans ce guide ?
- **Le type de pari et la direction** — est-ce dans la zone 🟢 de la ligue ?
- **La cote** — est-elle dans la fourchette indiquée ?

Si un pari ne correspond à aucun signal 🟢 de sa ligue, il vaut mieux ne pas le jouer — même si le moteur l'a sélectionné. Cela peut indiquer une ligue dont la configuration n'est pas encore finalisée.
