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

### Ce que montre le backtest relancé le 25 avril 2026

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

**Profil :** championnat très concurrentiel où les bookmakers évaluent très bien les favoris. Les opportunités se trouvent uniquement sur les outsiders et les matchs nuls à cotes élevées. Backtest validé le 25 avril 2026 (Brier 0.596, ROI +71.4 %, 113 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Match nul** — cotes **5.00 à 7.99** — rendement observé **+83.8 %** sur 74 paris (22V/52D — signal dominant)
- 🟢 **Victoire extérieur** — cotes **3.00 à 6.99** — rendement observé **+61.8 %** sur 24 paris
- 🟢 **Les 2 équipes marquent : Oui** — cotes **2.00 à 2.99** — rendement observé **+16.6 %** sur 12 paris

### ⚠️ Trop peu de données

- ⚠️ **Plus de 1.5 buts à la mi-temps** — 3 paris seulement — résultat positif (+62 %) mais volume insuffisant

### 🔴 À éviter

- 🔴 **Match nul** à cotes ≥ 8.00 — résultats systématiquement négatifs
- 🔴 **Plus de 2.5 buts** — désactivé (aucun signal stable en PL contre Pinnacle)
- 🔴 **Les 2 équipes marquent : Non** — le niveau offensif de la PL rend ce pari perdant
- 🔴 **Vainqueur à la mi-temps (toutes options)** — résultats négatifs sur 3 saisons

> **En pratique :** Le match nul 5.0–8.0 est le signal le plus fiable du système (74 paris, stable sur 3 saisons). La victoire extérieure 3.0–7.0 complète. Ne jamais parier sur la victoire à domicile en Premier League.

---

## Bundesliga (BL1) ✅

**Profil :** championnat ouvert et très orienté buts. Après resserrage, le moteur y fonctionne surtout sur **BTTS**, sur le **vainqueur à la mi-temps côté visiteur**, et plus marginalement sur les **overs**.

### 🟢 À jouer

- 🟢 **Les 2 équipes marquent : Oui** — cotes **2.00 à 2.99** — rendement observé **+54.1 %** sur 15 paris
- 🟢 **Les 2 équipes marquent : Non** — cotes **3.00 à 4.99** — rendement observé **+68.1 %** sur 8 paris
- 🟢 **Vainqueur à la mi-temps : équipe visiteur** — cotes **3.00 à 4.99** — rendement observé **+21.2 %** sur 27 paris
- 🟢 **Plus de 2.5 buts** — cotes **2.00 à 2.99** — rendement observé **+21.0 %** sur 7 paris

### ⚠️ Trop peu de données

- ⚠️ **Plus de 1.5 buts à la mi-temps** — cotes 2.00 à 2.99 — bon résultat mais seulement 4 paris

### 🔴 À éviter

- 🔴 **Les 2 équipes marquent : Non** à cotes 2.00 à 2.99 — trop risqué dans ce championnat à gros scores
- 🔴 **Vainqueur à la mi-temps : match nul** — branche retirée après un rendement observé de **-4.9 %** sur 29 paris
- 🔴 **Mi-temps / fin de match : domicile / domicile** — aucun signal exploitable
- 🔴 **Moins de 3.5 buts** — retiré, profil trop défensif pour cette ligue
- 🔴 **Victoire à domicile** — résultats négatifs dans cette ligue

> **En pratique :** BL1 doit maintenant se lire comme une ligue **BTTS + dynamique visiteur à la mi-temps**. Le "BTTS Non" ne reste jouable qu'à **cotes hautes**, tandis que les lectures plus prudentes comme **Under 3.5** ou **nul à la mi-temps** ont été sorties de la calibration.

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

## La Liga (LL) ✅

**Profil :** ligue désormais très resserrée autour de quelques fenêtres utiles. Le moteur y fonctionne surtout sur les **buts**, avec un complément sur les **favoris domicile très courts** et une fenêtre précise sur le **match nul à la mi-temps**. Le backtest final validé garde peu de volume, mais une lecture bien plus propre.

### 🟢 À jouer

- 🟢 **Moins de 2.5 buts** — cotes **1.80 à 3.99** — rendement observé **+36.4 %** sur 14 paris
- 🟢 **Plus de 2.5 buts** — cotes **1.80 à 2.99** — rendement observé **+57.6 %** sur 5 paris
- 🟢 **Victoire à domicile** — cotes **1.80 à 1.99** — rendement observé **+40.3 %** sur 4 paris
- 🟢 **Vainqueur à la mi-temps : match nul** — cotes **3.50 à 3.99** — rendement observé **+143.0 %** sur 6 paris

### ⚠️ Signal rare mais propre

- ⚠️ **Moins de 1.5 but à la mi-temps** — uniquement sur des cas très sélectifs retenus par le moteur après resserrage — ne pas anticiper manuellement ce marché hors signal moteur

### 🔴 À éviter

- 🔴 **Victoire à domicile** à cotes **≥ 2.00** — en dehors de la zone propre, le signal se dégrade vite
- 🔴 **Victoire à l'extérieur** — pas de segment stable conservé dans la calibration actuelle
- 🔴 **Les 2 équipes marquent : Oui / Non** — branches retirées car elles dégradaient le ROI
- 🔴 **Vainqueur à la mi-temps : domicile ou extérieur** — résultats négatifs, désactivés
- 🔴 **Vainqueur à la mi-temps : match nul** sous **3.50** — zone trop fragile, retirée

> **En pratique :** En La Liga, il faut jouer peu mais propre. Priorité aux **marchés de buts**, puis au **1X2 domicile sous 2.0**. Le **nul à la mi-temps** n'est intéressant que dans la fenêtre **3.5–4.0** ; en dessous, on sort du signal utile. Le run final validé reste très sélectif, avec **33 paris** pour **+56.4 % de ROI**.

---

## Premier Liga Portugal (POR) ✅

**Profil :** très sélectif (≈ 3 à 4 paris par saison), mais très haute précision. Signal dominant sur les matchs nuls à cotes élevées et les favoris courts à domicile. Safe Value backtest au 25 avril 2026.

### 🟢 À jouer

- 🟢 **Match nul** — cotes **3.00 à 4.99**, EV ≥ 20 % — rendement observé **+263.5 %** sur 4 paris (3W/1L, cotes moyennes 4.85)
- 🟢 **Victoire à domicile** — cotes **≤ 2.34** — rendement observé **+121.3 %** sur 3 paris (3W/0L, favoris nets uniquement)

### 🔴 À éviter

- 🔴 **Victoire à domicile** à cotes ≥ 2.35 — 1W/4L sur le backtest, signal trop instable
- 🔴 **Victoire à l'extérieur** — résultats négatifs de manière constante

> **En pratique :** Le moteur place rarement des paris sur cette ligue, mais son taux de réussite est très élevé (9W/1L sur 3 saisons). Le match nul avec forte conviction (EV ≥ 20 %) est le signal dominant. Pour les domiciles, ne jouer que les favoris nets (cotes ≤ 2.34) — au-delà, le signal se dégrade fortement.

---

## Championship (CH) ✅

**Profil :** ligue britannique de deuxième division, propre et rentable. Les signaux dominants sont le **vainqueur mi-temps domicile** et le **BTTS Non**. Le 1X2 est désactivé (HOME et DRAW) — le moteur ne l'exploite plus dans cette ligue. Backtest validé le 25 avril 2026 (Brier 0.643, ROI **+32.2 %**, 86 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Vainqueur à la mi-temps : équipe à domicile** — cotes autour de **3.00 à 3.50** — rendement observé **+22.9 %** sur 41 paris, confirmé sur 2 saisons (S2 +48.5 %, S3 +27.9 %)
- 🟢 **Les 2 équipes marquent : Non** — cotes **2.00 à 2.50** — rendement observé **+54.6 %** sur 29 paris, stable sur les 3 saisons

### ⚠️ Trop peu de données

- ⚠️ **Plus de 0.5 but à la mi-temps** — 5 bets S3 +24.2 % — trop récent pour conclure
- ⚠️ **Moins de 2.5 buts** — 3 bets S3 +80 % — signal non encore consolidé

### 🔴 À éviter

- 🔴 **Vainqueur à la mi-temps : équipe visiteur** — rendement **-86.8 %** sur 22 paris — désactivé dans le moteur
- 🔴 **Match nul (1X2)** — rendement **-56.9 %** sur 9 paris — désactivé
- 🔴 **Les 2 équipes marquent : Oui** — 0 victoire sur 4 paris — désactivé
- 🔴 **Victoire à domicile ou à l'extérieur (1X2)** — signal absent ou trop fragmentaire — désactivé

> **En pratique :** Le **vainqueur mi-temps domicile** et le **BTTS Non** sont les deux axes à surveiller en Championship. Ne jamais parier sur l'équipe visiteur à la mi-temps — c'est le pire segment du système sur cette ligue.

---

## League One (EL1) ✅

**Profil :** ligue propre et rentable. Le signal dominant est la victoire extérieure en 1X2, complété par l'Under 2.5 et un sous-segment sur la mi-temps côté visiteur. Backtest validé le 25 avril 2026 (Brier 0.634, ROI +46.2 %, 58 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à l'extérieur** — cotes **2.00 à 3.99** — rendement observé **+70.1 %** sur 21 paris
- 🟢 **Victoire à domicile** — cotes **2.00 à 2.29** — rendement observé **+14.3 %** sur 19 paris
- 🟢 **Moins de 2.5 buts** — cotes **2.00 à 2.06** — rendement observé **+29.5 %** sur 11 paris
- 🟢 **Vainqueur à la mi-temps : équipe visiteur** — cotes **3.50 à 4.00** — rendement observé **+114.0 %** sur 5 paris

### ⚠️ Trop peu de données

- ⚠️ **Mi-temps / fin de match : domicile / domicile** — cotes 2.38 — résultat positif mais seulement 2 paris

### 🔴 À éviter

- 🔴 **Match nul** — résultats massivement négatifs dans cette ligue
- 🔴 **Les 2 équipes marquent (Oui et Non)** — pas de signal exploitable sur 3 saisons
- 🔴 **Plus de 2.5 buts** et **Plus de 3.5 buts** — branches retirées car elles dégradaient le ROI
- 🔴 **Vainqueur à la mi-temps : équipe domicile** — profil négatif et surconfiant

> **En pratique :** League One est maintenant une ligue à jouer de façon disciplinée. Priorité aux **1X2**, puis au **Under 2.5** quand la cote reste juste au-dessus de 2.0. Le signal **mi-temps extérieur** existe, mais seulement dans une fenêtre serrée autour de **3.5–4.0** — en dehors de cette zone, il redevient vite fragile.

---

## Ligue 1 (L1) ✅

**Profil :** calibration saine, deux signaux complémentaires. Les favoris à domicile en cotes moyennes sont le cœur de cette ligue. Backtest validé le 25 avril 2026 (Brier 0.616, ROI +46.4 %, 27 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99** — rendement observé **+46.8 %** sur 18 paris (11V/7D)
- 🟢 **Les 2 équipes marquent : Oui** — cotes **2.00 à 2.99** — rendement observé **+45.7 %** sur 9 paris (6V/3D)

### 🔴 À éviter

- 🔴 **Victoire à domicile** à cotes ≥ 3.00 — hors de la zone profitable
- 🔴 **Match nul** — aucun signal stable, désactivé
- 🔴 **Les 2 équipes marquent : Non** — résultats négatifs de manière constante
- 🔴 **Vainqueur à la mi-temps, Plus/Moins de buts** — tous désactivés

> **En pratique :** HOME 2.0–2.99 et BTTS YES 2.0–2.99 sont les deux seuls marchés à jouer. La variance inter-saison sur HOME est notable (S1 +91%, S2 -11%, S3 +109%) — le moteur sélectionne uniquement les cas à forte conviction.

---

## Segunda División (SP2) ✅

**Profil :** deux signaux solides et complémentaires — favoris à domicile en cotes courtes et Over 2.5 à cotes serrées. Backtest validé le 25 avril 2026 (Brier 0.649, ROI +26.8 %, 34 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **1.50 à 1.99** — rendement observé **+34.1 %** sur 12 paris (9V/3D)
- 🟢 **Plus de 2.5 buts** — cotes **2.00 à 2.99** — rendement observé **+25.1 %** sur 20 paris (12V/8D)

### 🔴 À éviter

- 🔴 **Victoire à domicile** à cotes ≥ 2.00 — en dehors de la zone de valeur
- 🔴 **Victoire à l'extérieur** — résultats négatifs, désactivé dans le moteur
- 🔴 **Plus de 1.5 buts à la mi-temps** — 0V/3D en S3, désactivé

> **En pratique :** Les favoris nets à domicile (< 2.00) et le Over 2.5 en cotes 2.00–2.99 sont les deux seuls marchés à suivre. Le moteur produit environ 10 paris par saison entre les deux.

---

## Eredivisie (ERD) ⚠️

**Profil :** ligue à très fort volume de buts (~3.3 buts/match en moyenne — la plus haute de notre pool). Calibration du modèle excellente (Brier 0.599), mais les bookmakers pricent aussi bien cette ligue. Le signal de paris est rare : **2 picks par saison** attendus. Backtest validé le 25 avril 2026 (ROI +8.8 %, 6 paris sur 3 saisons — échantillon faible).

### 🟢 À jouer

- 🟢 **Plus de buts (Over)** — cotes **2.00 à 2.50** — rendement observé **+35.7 %** sur 3 paris (2V/1D) — signal principal, confirme le profil haute-intensité de la ligue
- 🟡 **Victoire à l'extérieur** — cotes **2.00 à 2.99** — rendement observé **−18 %** sur 3 paris — signal secondaire non confirmé ; ne jouer que si le moteur le propose

### ⚠️ Signal rare, non encore consolidé

- ⚠️ Seulement **2 picks par saison** en moyenne — pas assez pour tirer des conclusions statistiques solides. L'Eredivisie reste **en observation** ; les picks proposés doivent être suivis avec prudence.

### 🔴 À éviter

- 🔴 **Victoire à domicile** — l'Ajax, PSV et Feyenoord créent des favoris extrêmes (cotes 1.10–1.40) où l'espérance de valeur est négative malgré un taux de réussite > 90 %
- 🔴 **Moins de buts (Under)** — impossible dans la ligue la plus offensive d'Europe
- 🔴 **Les 2 équipes ne marquent pas (BTTS Non)** — les deux équipes marquent très souvent en Eredivisie
- 🔴 **Vainqueur à la mi-temps** — désactivé

> **En pratique :** Si le moteur propose un **Over** en Eredivisie, c'est probablement le seul pick viable de la ligue. L'**extérieur** peut apparaître mais n'est pas encore consolidé. Ne jamais forcer un pick 1X2 ici.

---

## 2. Bundesliga (D2) ✅

**Profil :** ligue très équilibrée avec rotation importante en promotion/relégation. Le modèle détecte des matchs nuls sous-cotés (sélection très ciblée) et quelques victoires à l'extérieur sur cotes courtes. Volume faible : **2 à 4 paris par saison** — c'est volontaire, les conditions sont strictes. Backtest validé le 25 avril 2026 (Brier 0.651, ROI +99 %, 9 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Match nul** — cotes **3.50 à 4.00** — rendement observé **+99 %** sur 6 paris (3V/3D) — signal principal de la ligue
- 🟡 **Victoire à l'extérieur** — cotes **2.50 à 3.00** — rendement observé **+31 %** sur 2 paris — signal secondaire, très sélectif

### ⚠️ Signal rare mais réel

- ⚠️ 2 à 4 picks attendus par saison au total — ne pas forcer. Un **Match nul** à ~4.0 ou une **victoire extérieure** à ~2.7 sont les seuls motifs activés.

### 🔴 À éviter

- 🔴 **Victoire à domicile** — tendance à surévaluer la domination à domicile ; désactivée dans le moteur
- 🔴 **Moins de 2.5 / 1.5 buts** — aucun signal exploitable en D2
- 🔴 **Les 2 équipes marquent** — désactivé
- 🔴 **Vainqueur à la mi-temps** — désactivé

> **En pratique :** Attendre que le moteur propose un **Match nul à ~4.0** ou une **victoire à l'extérieur à 2.5–3.0**. Ce sont les deux seuls segments actifs. Ne pas jouer 1X2 domicile même sur une affiche qui paraît logique.

---

## Serie B (I2) ✅

**Profil :** ligue très équilibrée et défensive — 32 % de matchs nuls, seulement 2.4 buts en moyenne par match. Le modèle 1X2 ne trouve pas d'edge dans cette ligue (domicile surévalué, extérieur trop volatile). Le seul canal viable est les **buts**, exclusivement sur le marché **Moins de buts**. Volume attendu : **2 à 3 paris par saison** — c'est normal, ne pas forcer.

### 🟢 À jouer

- 🟢 **Moins de 2.5 buts** — cotes **2.00 à 2.99** — rendement observé **+119.8 %** sur 4 paris — signal le plus solide de la ligue
- 🟢 **Moins de 1.5 but** — cotes **3.00 à 3.99** — rendement observé **+8.0 %** sur 3 paris — signal marginal, jouer uniquement si le moteur le propose

### ⚠️ Signal rare mais réel

- ⚠️ Le moteur ne propose des paris en Serie B que **2 à 3 fois par saison**. C'est voulu — les conditions doivent être précisément alignées (espérance de buts faible + cotes dans la bonne fenêtre). Inutile de chercher d'autres matchs.

### 🔴 À éviter

- 🔴 **Résultat du match (toutes directions)** — le modèle surestime systématiquement la domination à domicile ; les branches 1X2 sont désactivées dans le moteur
- 🔴 **Plus de 2.5 buts** — le signal Over s'est effondré hors contexte combiné ; désactivé
- 🔴 **Les 2 équipes marquent** — pas de signal exploitable dans cette ligue
- 🔴 **Vainqueur à la mi-temps (toutes options)** — trop bruité, désactivé

> **En pratique :** Serie B est un canal **Moins de buts uniquement**. Si le moteur propose un pari dans cette ligue, c'est presque toujours un **Moins de 2.5** ou **Moins de 1.5** — les deux seuls marchés actifs. Ne pas jouer 1X2 ici même si la sélection semble logique sur l'affiche.

---

## Liga MX (MX1) ✅

**Profil :** championnat mexicain à fort profil de buts mais avec des rencontres souvent équilibrées. Le modèle trouve un edge clair sur les **favoris à domicile en cotes courtes/moyennes** (1.80–2.49). Backtest validé le 25 avril 2026 (Brier 0.620, ROI +22.9 %, 19 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **1.80 à 2.49** — rendement observé **+22.9 %** sur 19 paris (11V/8D) — signal unique et principal de la ligue

### ⚠️ À surveiller

- ⚠️ Volume attendu : **5 à 7 paris par saison** — le moteur ne sélectionne que lorsque la probabilité modélisée dépasse franchement le prix du bookmaker.

### 🔴 À éviter

- 🔴 **Victoire à domicile — cotes > 2.49** — les cotes 2.50+ traduisent un favori non-confirmé : 1V/6D sur 3 saisons, -47 % ROI ; désactivé dans le moteur
- 🔴 **Plus de buts** — le marché OVER est bookmaké très précisément en Liga MX ; aucun edge stable détecté
- 🔴 **Victoire à l'extérieur** — signal négatif constant
- 🔴 **Moins de buts, BTTS, Vainqueur mi-temps** — tous désactivés

> **En pratique :** Uniquement les **favoris à domicile entre 1.80 et 2.49**. Un seul signal actif, très ciblé — ne pas chercher à jouer le Over ou l'extérieur en Liga MX même si la sélection paraît logique.

## League Two (EL2) ✅

**Profil :** quatrième division anglaise, profil offensif modéré (42.6 % victoires domicile). Le signal repose sur le **1X2** — domicile et extérieur — avec un avantage marqué sur les outsiders (AWAY +46 % ROI). Le marché BTTS NO est aussi exploitable à cotes moyennes. Premier mi-temps désactivé (HOME 30b 5V/25D -57.8 % structurel). Backtest validé le 25 avril 2026 (Brier 0.651, ROI **+22.8 %**, 149 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à l'extérieur (1X2 AWAY)** — rendement observé **+46.0 %** sur 28 paris (14V/14D) — signal principal
- 🟢 **Victoire à domicile (1X2 HOME)** — rendement observé **+12.5 %** sur 97 paris — signal secondaire, volume élevé
- 🟢 **Les deux équipes ne marquent pas (BTTS NO)** — rendement observé **+38.8 %** sur 16 paris — signal complémentaire

### ⚠️ À surveiller

- ⚠️ Le HOME est solide en volume mais ROI modeste (+12.5 %) — jouer avec discipline
- ⚠️ Le AWAY est le signal le plus profitable mais sur faible volume (28 paris / 3 saisons)

### 🔴 À éviter

- 🔴 **Vainqueur de la première mi-temps — domicile (FHW HOME)** — 30b 5V/25D, -57.8 % ROI sur 3 saisons — désactivé dans le moteur
- 🔴 **Moins de buts (OVER_UNDER UNDER)** — 2b 0V/2D, -100 % ROI — désactivé
- 🔴 **Plus de buts à la mi-temps (OVER_HT 1.5)** — 7b 2V/5D, -14.3 % ROI — désactivé

> **En pratique :** Concentrer sur le **1X2 AWAY** (signal fort) et **HOME** (signal modéré). Le BTTS NO est un bonus exploitable. Ne jamais jouer le premier mi-temps domicile — le modèle sur-prédit systématiquement l'avantage à domicile en première période en League Two.

---

## J.League (J1) ⚠️

**Profil :** championnat japonais difficile à calibrer (plancher Brier théorique ≈ 0.655, supérieur au seuil européen standard). Le seul signal fiable détecté est le marché **Plus de buts à cotes serrées (2.00–2.09)**. Le 1X2 est entièrement désactivé — le modèle sur-prédit les victoires à domicile de manière structurelle. Backtest validé le 25 avril 2026 (Brier 0.666, ROI +30.2 %, 10 paris sur 4 saisons).

### 🟢 À jouer

- 🟢 **Plus de buts (OVER 2.5)** — cotes **2.00 à 2.09** — rendement observé **+12.6 %** sur 9 paris (5V/4D) — signal principal et unique

### ⚠️ À surveiller

- ⚠️ Volume très faible : **2 à 3 paris par saison** — signal sélectif, ne pas forcer
- ⚠️ ROI inter-saisons variable : S1 +35.5 %, S2 0.0 %, S3 -100 % (1 seul bet) — échantillon petit, prudence

### 🔴 À éviter

- 🔴 **Victoire à domicile (1X2 HOME)** — 46 bets 19V/27D (-6.3 % ROI) sur 4 saisons, taux de victoire allant de 18 % à 59 % selon la saison — désactivé dans le moteur
- 🔴 **Match nul et Victoire à l'extérieur** — aucun edge stable détecté, désactivés
- 🔴 **Plus de buts — cotes < 2.00** — 19 bets 8V/11L (-23.4 % ROI) ; le marché est trop efficace à cotes courtes
- 🔴 **Moins de buts, BTTS, Vainqueur mi-temps** — désactivés

> **En pratique :** Uniquement le **OVER 2.5 entre 2.00 et 2.09**. Ne jamais jouer le 1X2 en J.League — le modèle n'a pas de signal stable sur cette direction malgré les cotes apparemment intéressantes.

---

## Super League suisse (SUI1) ✅

**Profil :** première division suisse, championnat équilibré avec une dominance à domicile marquée sur les favoris. Le modèle trouve un signal unique et robuste : les **victoires à domicile** sur une large fenêtre de cotes (1.80–2.99). L'EV calculé est plafonné à 0.30 — au-dessus, le modèle sur-estime systématiquement. Backtest validé le 30 avril 2026 (Brier 0.644, ROI **+42.1 %**, 15 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **1.80 à 2.99** — rendement observé **+42.1 %** sur 15 paris (11V/4D)
  - Favoris courts [1.80–1.99] : 9 paris, 7V/2D, **+45.8 %** ROI — le segment le plus solide
  - Favoris moyens [2.00–2.99] : 6 paris, 4V/2D, **+36.5 %** ROI — signal complémentaire

### ⚠️ À surveiller

- ⚠️ Volume attendu : **4 à 6 paris par saison** — sélection stricte, ne pas forcer
- ⚠️ Le moteur ne joue que les HOME avec EV ≤ 30 % — au-delà, le modèle se trompe structurellement

### 🔴 À éviter

- 🔴 **Victoire à domicile avec EV > 30 %** — sur-confiance systématique : 0V/5D sur 3 saisons ; le moteur l'élimine automatiquement
- 🔴 **Victoire à domicile à cotes ≥ 3.00** — 1 pari perdu (EV gonflé à 88 %) — désactivé
- 🔴 **Match nul** — 0V/1D, aucun signal exploitable ; désactivé
- 🔴 **Victoire à l'extérieur** — résultats fortement négatifs (-40 % ROI simulé)

> **En pratique :** SUI1 est une ligue mono-signal : **domicile favori entre 1.80 et 2.99**. Si l'EV affiché dépasse 30 %, le moteur rejette automatiquement le pick. Ne jamais chercher à jouer les nuls ou l'extérieur dans cette ligue.

---

## Süper Lig (TUR1) ✅

**Profil :** première division turque, championnat équilibré avec un rythme de buts plus faible qu'en apparence (lambda calibré à 1.25 — en dessous du défaut européen). Le modèle trouve deux signaux complémentaires : les **favoris à domicile à cotes moyennes** et les **Moins de 2.5 buts**. Backtest validé le 30 avril 2026 (Brier 0.605, ROI **+42.5 %**, 13 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99** — rendement observé **+30.6 %** sur 8 paris (4V/4D) — signal principal
- 🟢 **Moins de 2.5 buts** — cotes **2.00 à 2.99** — rendement observé **+61.4 %** sur 5 paris (4V/1D) — signal secondaire très solide

### ⚠️ À surveiller

- ⚠️ Volume attendu : **4 à 5 paris par saison** — ligue sélective, ne pas forcer
- ⚠️ Le signal **Moins de buts** est le plus rentable mais repose encore sur un échantillon court (5 paris) — à suivre sur la saison en cours

### 🔴 À éviter

- 🔴 **Victoire à domicile — cotes ≥ 3.00** — 1 pari perdu, signal structurellement négatif ; désactivé dans le moteur
- 🔴 **Plus de 2.5 buts (OVER)** — désactivé (0V/2D sur les 3 saisons)
- 🔴 **Victoire à l'extérieur (AWAY)** — résultats catastrophiques constant (-54 % ROI simulé sur les candidats) ; désactivé
- 🔴 **Match nul** — les nuls TUR1 sont trop bien pricés par Pinnacle, aucun edge détecté

> **En pratique :** TUR1 se joue sur deux axes simples : **domicile 2.0–3.0** et **Moins de 2.5 buts**. Ne pas chercher à jouer les outsiders ni les nuls — la ligue est trop homogène pour que le modèle y trouve un edge. Si le moteur ne propose rien, ne pas forcer.

---

## Major League Soccer (MLS) ✅

**Profil :** championnat nord-américain à domicile fort mais irrégulier. Le modèle identifie deux signaux exploitables sur une fenêtre EV étroite : les **favoris à domicile à cotes moyennes** et **Moins-Moins BTTS NO**. Backtest validé le 30 avril 2026 (Brier 0.430, ROI **+41.3 %**, 12 paris sur 2 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99**, EV **0.20 à 0.30** — rendement observé **+38 %** sur 7 paris (4V/3D) — signal principal
- 🟢 **BTTS Non** — cotes **2.00 à 2.99**, EV **0.30 à 0.40** — rendement observé **+82.5 %** sur 4 paris (3V/1D) — signal secondaire très solide

### ⚠️ À surveiller

- ⚠️ Volume attendu : **4 à 6 paris par saison** — ligue sélective, ne pas forcer
- ⚠️ Le signal **BTTS Non** repose sur un échantillon court (4 paris) — valider sur la saison en cours
- ⚠️ La fenêtre EV est étroite (0.20–0.30 pour HOME, 0.30–0.40 pour BTTS NO) — les picks hors fenêtre sont désactivés dans le moteur

### 🔴 À éviter

- 🔴 **Plus de 2.5 buts (OVER)** — désactivé ; sur-confiance détectée à tout niveau d'EV
- 🔴 **Mi-temps (FHW)** — désactivé toutes directions ; résultats catastrophiques (-44 % HOME, -100 % DRAW/AWAY)
- 🔴 **OVER Mi-temps** — désactivé ; aucun edge détecté
- 🔴 **Victoire à domicile EV > 0.30** — sur-confiance confirmée (0V/4D à EV 0.30–0.40) ; cap dur à 0.30
- 🔴 **Match nul / Victoire extérieure** — aucun edge détecté en MLS

> **En pratique :** MLS se joue exclusivement sur **HOME 2.0–3.0 à EV modéré** et **BTTS NO**. La fenêtre est étroite — si le moteur ne propose rien, ne pas forcer.

---

## Ekstraklasa (POL1) ⚠️

**Profil :** première division polonaise, championnat équilibré. Le modèle identifie un signal HOME rentable sur une fenêtre EV [0.25–0.40), mais la calibration Brier reste légèrement au-dessus du seuil (0.662 vs 0.65) à cause d'une saison 2025-26 courte et bruitée. En observation — à revalider quand la saison sera plus fournie.

### 🟢 À jouer (sous réserve de confirmation)

- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99**, EV **0.25 à 0.40** — rendement observé **+70 %** sur 7 paris (4V/3D) — à confirmer sur plus de données
- 🟢 **Match nul** — cotes **3.00 à 4.99**, EV **0.10 à 0.25** — rendement observé **+127 %** sur 5 paris (3V/2D) — signal secondaire émergent après correction empirique

### ⚠️ À surveiller

- ⚠️ **Brier 0.662** — légèrement au-dessus du seuil (0.65) ; ligue non encore validée formellement
- ⚠️ Volume : **4 à 5 paris par saison** — sélectif, ne pas forcer
- ⚠️ HOME EV < 0.25 : systématiquement négatif (-30 % ROI sur 12 paris) ; plancher strict dans le moteur
- ⚠️ HOME EV > 0.40 : sur-confiance confirmée (1W/5L, -54.7 %) ; cap strict dans le moteur

### 🔴 À éviter

- 🔴 **Victoire à domicile EV < 0.25** — plancher à 0.25, zone négative sans exception
- 🔴 **Victoire à domicile EV > 0.40** — sur-confiance confirmée ; désactivé dans le moteur
- 🔴 **Victoire à l'extérieur** — aucun edge détecté

> **En pratique :** POL1 est en phase d'observation. Le moteur peut proposer des picks HOME dans la fenêtre [0.25–0.40), mais la ligue n'est pas encore formellement validée. Traiter ces picks avec prudence jusqu'à la revalidation fin de saison.

---

## Eliteserien (NOR1) ✅

**Profil :** première division norvégienne, championnat équilibré à faible volume de picks. Le modèle identifie un signal HOME clair et bien calibré sur une fenêtre EV conservatrice. Backtest validé le 30 avril 2026 (Brier 0.609, ROI **+82.8 %**, 5W/0L sur 6 paris, 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile** — cotes **2.00 à 2.99**, EV **≤ 0.40** — rendement observé **+119.4 %** sur 5 paris (**5V/0D**) — signal unique, très sélectif

### ⚠️ À surveiller

- ⚠️ Volume attendu : **1 à 2 paris par saison** — ligue très sélective, ne pas forcer
- ⚠️ Échantillon court (5 paris) — signal prometteur à confirmer sur la saison en cours
- ⚠️ EV > 0.40 désactivé : sur-confiance confirmée (1W/2L sur les 3 derniers picks à haut EV)

### 🔴 À éviter

- 🔴 **Victoire à l'extérieur (AWAY)** — désactivé ; 39 candidats analysés, 4W/35L (-27.8% ROI simulé)
- 🔴 **Plus de 2.5 buts (OVER)** — désactivé ; aucun edge détecté
- 🔴 **Match nul** — bloqué par le cap de cotes ; trop bien pricé par Pinnacle en NOR1
- 🔴 **HOME EV > 0.40** — sur-confiance confirmée ; cap dur dans le moteur

> **En pratique :** NOR1 ne génère que 1 à 2 picks par saison. Le signal HOME est fiable sur la fenêtre calibrée — si le moteur propose un HOME NOR1, c'est un pick solide. Ne pas chercher à jouer autrement.

---

## Ligue des Champions (UCL) ✅

**Profil :** la compétition la mieux calibrée du système (CalibErr 0.040, Brier 0.614). Le modèle identifie deux signaux complémentaires : **la victoire à l'extérieur** (signal principal, +73.7%) et **la victoire à domicile** (signal secondaire, EV ≥ 0.20 uniquement). Backtest validé le 30 avril 2026 (ROI **+64.4 %**, 17 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à l'extérieur (AWAY)** — cotes **2.00 à 4.99** — rendement observé **+73.7 %** sur 7 paris (4V/3D) — signal principal, outsider tenu en haute estime par le modèle
- 🟢 **Victoire à domicile (HOME)** — cotes **2.00 à 2.99**, EV **≥ 0.20** — rendement observé **+38.3 %** sur 9 paris (4V/5D) — signal secondaire

### ⚠️ À surveiller

- ⚠️ AWAY : fenêtre EV 0.29–0.69 ; au-delà de 0.70, le signal se fragilise (1W/2L dans l'échantillon)
- ⚠️ HOME EV < 0.20 : structurellement négatif (1W/4L, -52.8%) — plancher strict dans le moteur

### 🔴 À éviter

- 🔴 **HOME EV < 0.20** — zone toxique confirmée sur 3 saisons ; désactivé dans le moteur
- 🔴 **Match nul** — bloqué ; 74 candidats analysés sur 3 saisons, 9W/65L (-28.3%)
- 🔴 **Moins de 2.5 buts (UNDER)** — désactivé ; aucun edge structurel détecté
- 🔴 **Mi-temps (FHW)** — sauf cas très rare — trop peu de données pour valider

> **En pratique :** UCL se joue sur **AWAY à cotes moyennes** et **HOME > 2.00 à EV modéré**. Le favoris UCL à courte cote (< 2.00) n'est pas dans le périmètre du moteur — Pinnacle price trop bien les mastodontes.

---

## Ligue Europa (UEL) ⚠️

**Profil :** compétition difficile à calibrer — CalibErr structurellement au-dessus du seuil (0.057 vs 0.05). Le modèle identifie un signal DRAW exploitable (+89.8% ROI) mais la ligue n'est pas formellement validée. **Victoire à domicile désactivée** (3W/7L -30% au baseline, aucune fenêtre EV stable). En observation.

### 🟢 À jouer (sous réserve de confirmation)

- 🟢 **Match nul** — cotes **3.00 à 4.99**, EV **0.10 à 0.35** — rendement observé **+89.8 %** sur 6 paris (3V/3D) — signal unique de la ligue

### ⚠️ À surveiller

- ⚠️ **CalibErr 0.057** — ligue non formellement validée (seuil 0.050) ; picks à traiter avec prudence
- ⚠️ Volume : **2 paris par saison** — très sélectif
- ⚠️ Le DRAW en UEL est bien pricé par Pinnacle : les nuls à > 5.00 sont bloqués par cap de cotes

### 🔴 À éviter

- 🔴 **Victoire à domicile (HOME)** — désactivé ; pas de fenêtre EV exploitable (3W/7L -30%)
- 🔴 **Victoire à l'extérieur (AWAY)** — cap EV 0.35 ; au-delà, sur-confiance confirmée
- 🔴 **Totaux (OVER/UNDER)** — désactivé
- 🔴 **Mi-temps (FHW)** — désactivé

> **En pratique :** UEL est une ligue d'opportunité sur le **match nul uniquement**. Si le moteur ne propose pas de nul, ne pas forcer.

---

## Ligue Europa Conférence (UECL) ✅

**Profil :** compétition très bien calibrée (CalibErr 0.036, Brier 0.626). Le modèle identifie un signal HOME fort et robuste sur toutes les plages EV — signe d'une calibration saine. Backtest validé le 30 avril 2026 (ROI **+57.5 %**, 31 paris sur 3 saisons).

### 🟢 À jouer

- 🟢 **Victoire à domicile (HOME)** — cotes **2.00 à 2.99** — rendement observé **+64.8 %** sur 21 paris (13V/8D) — signal principal fort, stable sur toutes les plages EV
- 🟢 **Victoire à l'extérieur (AWAY)** — cotes **2.00 à 3.99** — rendement observé **+28.5 %** sur 4 paris (2V/2D) — signal secondaire
- 🟢 **Match nul** — cotes **3.00 à 4.99** — rendement observé **+18.7 %** sur 3 paris — signal émergent à confirmer

### ⚠️ À surveiller

- ⚠️ AWAY et DRAW : échantillons courts (4 et 3 paris) — ne pas sur-pondérer
- ⚠️ HOME est le seul signal statistiquement solide à ce stade

### 🔴 À éviter

- 🔴 **Mi-temps équipe extérieure (FHW AWAY)** — désactivé ; 3 bets candidats, tous perdants
- 🔴 **AWAY à haute cote (> 4.00)** — cap EV 0.35 ; sur-confiance détectée sur 55 candidats rejetés (10W/45L)
- 🔴 **AWAY à probabilité trop faible** — bloqué par filtre probabilité ; 39 candidats rejetés, 10W/45L (-30%)

> **En pratique :** UECL se joue principalement sur **HOME 2.0–3.0**. C'est la compétition UEFA la plus exploitable du système — un pick HOME UECL est un signal de haute confiance.

---

## Comment lire un pick proposé

Quand le moteur génère un pari, il a déjà vérifié toutes les règles de ce guide. Voici comment valider manuellement :

- **La ligue** — est-elle listée avec ✅ dans ce guide ?
- **Le type de pari et la direction** — est-ce dans la zone 🟢 de la ligue ?
- **La cote** — est-elle dans la fourchette indiquée ?

Si un pari ne correspond à aucun signal 🟢 de sa ligue, il vaut mieux ne pas le jouer — même si le moteur l'a sélectionné. Cela peut indiquer une ligue dont la configuration n'est pas encore finalisée.
