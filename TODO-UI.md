# TODO-UI — EVCore Web

---

## COUPON-COMBO — Coupon combiné (style Betclic)

### Contexte

Un coupon est **soit** un multi-simple (plusieurs paris indépendants, comportement actuel),
**soit** un combiné (accumulateur : toutes les sélections forment un seul pari dont le gain
= mise × produit de toutes les cotes, et qui est gagné uniquement si toutes les sélections
sont gagnantes). Il n'y a pas de mixte.

### Ce que ça implique

#### 1. Schéma Prisma

Ajouter un champ `type` sur `BetSlip` :

```prisma
enum BetSlipType {
  SIMPLE   // multi-simple — comportement actuel
  COMBO    // combiné — tous les items forment un seul accumulateur
}

model BetSlip {
  ...
  type  BetSlipType @default(SIMPLE)
  ...
}
```

- Suppression de `@@unique([userId, betId])` sur `BetSlipItem` — un même pari peut figurer dans plusieurs coupons distincts (comportement standard des plateformes)
- Migrations : `add_bet_slip_type` + `remove_bet_slip_item_user_bet_unique`

#### 2. Frontend — BetSlipDrawer

- Toggle au niveau du coupon entier : **Simples** / **Combiné**
- Mode Simples (actuel) : liste de paris indépendants, mise par sélection, gain potentiel par sélection
- Mode Combiné :
  - Cote totale affichée = produit des cotes de toutes les sélections
  - Un seul champ de mise pour le coupon entier
  - Gain potentiel = mise × cote totale
  - Si < 2 sélections, basculer automatiquement en mode Simples
- Statut affiché : **Gagné** / **Perdu** / **En attente**

#### 3. Backend — BetSlipService.create()

- Mode Simples : inchangé — 1 `Bet USER` par sélection
- Mode Combiné :
  - Créer 1 `Bet USER` par sélection (leg)
  - Le `betSlipId` suffit à identifier que toutes les sélections d'un coupon combiné sont liées
  - La cote totale n'est pas stockée — recalculée à partir des sélections au moment du règlement

#### 4. Règlement — BettingEngineService

- Coupon Simples : inchangé — chaque pari se règle indépendamment
- Coupon Combiné :
  - Toutes les sélections gagnantes → coupon **gagné**, retour = `mise × produit(cotes)`
  - Dès qu'une sélection est perdante → coupon **perdu**, retour = 0
  - La transaction bankroll `BET_WON` est déclenchée une seule fois pour le coupon entier
  - Les sélections individuelles sont marquées gagnées/perdues mais ne génèrent pas de transaction bankroll

#### 5. Bankroll

- Coupon Simples : débit par sélection à la pose, crédit par sélection gagnée (inchangé)
- Coupon Combiné : un seul débit à la pose, un seul crédit si toutes les sélections sont gagnantes

---

## LEADERBOARD-COUPON — Classement sur les coupons réglés

### Contexte

Le classement actuel agrège les paris USER individuels. Il doit passer sur les **coupons réglés**
pour refléter les vraies décisions de jeu.

### Définition d'un coupon réglé

Un coupon est réglé quand toutes ses sélections ont un résultat définitif (gagné ou perdu —
aucune en attente). C'est la logique à implémenter côté service — le schéma n'a pas de champ statut.

### Calcul du ROI par coupon

```
Pour chaque coupon réglé d'un utilisateur :
  Coupon Simples :
    misé   = Σ (mise_i) par sélection
    retour = Σ (mise_i × cote_i) pour les sélections gagnantes

  Coupon Combiné :
    misé   = mise unitaire du coupon
    retour = mise × produit(cotes) si toutes les sélections gagnantes, sinon 0

ROI utilisateur = (Σ retour - Σ misé) / Σ misé × 100
```

### Seuil d'éligibilité

- Minimum **1 coupon réglé** pour apparaître au classement

### Changements backend

- `dashboard.repository.ts` : remplacer `getLeaderboardData()` (requête sur `Bet`) par une
  requête sur `BetSlip` avec ses sélections et leurs paris
- `dashboard.service.ts` : remplacer la boucle sur paris par une boucle sur coupons réglés ;
  supprimer `MIN_SETTLED_USER`
- Pas de changement sur `LeaderboardEntry` (même structure renvoyée au frontend)
- `settled` dans la réponse = nombre de coupons réglés

### Affichage frontend

- La mention `≥ 5 paris joués` devient `≥ 1 coupon joué`
- Pas d'autre changement UI

---

## Ordre d'implémentation

- [ ] `COUPON-COMBO-1` — migrations Prisma (`type` sur `BetSlip` + suppression `@@unique([userId, betId])` sur `BetSlipItem`)
- [ ] `COUPON-COMBO-2` — BetSlipDrawer : toggle Simples/Combiné + affichage cote totale
- [ ] `COUPON-COMBO-3` — BetSlipService.create() : gestion du type Combiné côté backend
- [ ] `COUPON-COMBO-4` — Règlement : logique coupon Combiné + bankroll
- [ ] `LEADERBOARD-1` — Classement sur coupons réglés (repo + service + label UI)
