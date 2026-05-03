---
title: "Guide par ligue — introduction"
category: leagues
difficulty: beginner
slug: leagues-intro
summary: "Abréviations, règles communes, et lecture des principaux canaux selon les ligues."
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

## Canaux de prediction

Le dashboard affiche aussi des canaux de prediction distincts des canaux de pari.

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

- Une **prediction n'est pas un conseil de mise**
- Elle sert surtout à lire la conviction brute du modèle sur le **1X2**
- Une prédiction à **55-60 %** est déjà un signal exploitable dans les ligues calibrées
- Si la ligue est désactivée pour le canal prédiction, aucun badge n'apparaît même si un `BET` existe

Le meme principe s'applique aussi aux canaux **NUL** et **BB** : ce sont des lectures specialisees du modele, pas automatiquement des picks de valeur comparables a `EV` ou `SV`.

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
