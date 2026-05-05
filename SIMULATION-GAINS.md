# Simulation de gains — page Summary

## Objectif

Permettre à l'utilisateur de simuler ce qu'il aurait gagné ou perdu s'il avait misé un montant fixe sur chaque pick résolu dans la période filtrée.

Ce n'est pas un outil de prédiction. C'est un outil de **lecture rétrospective** : donner une valeur concrète à un taux de réussite sur une période donnée.

---

## UX

### Déclencheur

Un bouton **"Simulateur"** apparaît dans le header de la section "Picks résolus", uniquement quand des picks sont chargés.

### Drawer

- **Mobile** : slide du bas, `max-h-[92dvh]`, `rounded-t-[1.5rem]`
- **Desktop** : slide de droite, `w-[380px]`, `inset-y-4 right-4`
- Pattern identique à `BetSlipDrawer` et `BetSlipListPageClient`

### Contenu du drawer

1. Texte intro rappelant le nombre de picks concernés par le filtre actif
2. Input numérique **"Mise par pick"** — pas de devise, pas de valeur par défaut
3. Bouton **"Simuler"** — déclenche le calcul (désactivé si champ vide ou ≤ 0)
4. Grille de résultats 2×2 (voir ci-dessous)
5. Fermer le drawer remet l'état à zéro (input + résultats)

---

## Calcul

### Périmètre

- **Paris simples uniquement** — pas de combinés
- Tous les canaux sont concernés : EV, SV, CONF, DRAW, BTTS
- Chaque pick a obligatoirement une cote (`odds`)
  - EV / SV → cote du marché principal (ou combo)
  - CONF → cote V1 ou V2 selon le pick
  - DRAW → cote du nul
  - BTTS → cote BB (oui/non)

### Formule par pick

```
WON  → gain   = stake × odds − stake   (= stake × (odds − 1))
LOST → gain   = −stake
```

### Agrégats affichés

| Label      | Calcul                               |
| ---------- | ------------------------------------ |
| Picks      | nombre total de picks simulés        |
| Total misé | `count × stake`                      |
| Retourné   | `Σ (stake × odds)` sur les picks WON |
| Gain net   | `retourné − misé`                    |
| ROI        | `gain net / misé × 100`              |

Le **gain net** et le **ROI** sont colorés en vert si positifs, rouge si négatifs.

---

## Implémentation

Fichier : `apps/web/app/dashboard/summary/components/summary-page-client.tsx`

- `runSimulation(picks, stake)` — fonction pure, calcul en une seule passe `reduce`
- `SimulationDrawer` — composant local, état interne (`stakeInput`, `result`)
- Le drawer reçoit les picks déjà filtrés par canal + période via le hook `useSummary`
- Aucun appel réseau supplémentaire — tout est calculé côté client sur les données déjà chargées

---

## Ce que cette simulation n'est pas

- Elle ne tient pas compte de la gestion de bankroll (pas de Kelly, pas d'unités)
- Elle ne simule pas les combinés
- Elle ne projette pas sur le futur — uniquement sur les picks résolus de la période
- Les picks sans cote disponible sont ignorés du calcul (cas théorique, ne devrait pas arriver)
