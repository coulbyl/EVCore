---
title: "Bankroll : unités, discipline et drawdown"
category: bankroll
difficulty: beginner
order: 1
readTime: 7
slug: bankroll-unites-discipline
summary: "Pourquoi miser en unités, comment survivre aux périodes négatives et les règles qui protègent le capital."
updatedAt: "2026-05-03"
related: ["ev-probabilites-cotes", "erreurs-frequentes", "guide-bankroll"]
---

## Le concept d'unité

EVCore ne t'impose pas de montant de mise. Le modèle propose un signal ; toi tu appliques une règle de mise cohérente.

Cette règle, c'est l'**unité** : le montant de référence que l'app pré-remplit dans le coupon.

Dans EVCore, tu peux maintenant configurer cette unité dans **Parametres > Compte > Mise par unite** avec deux modes :

| Mode                 | Fonctionnement                                              | Exemple                      |
| -------------------- | ----------------------------------------------------------- | ---------------------------- |
| **Montant fixe**     | Tu choisis une somme stable                                 | `2 000 FCFA` par coupon      |
| **% de la bankroll** | L'unite suit le solde de la bankroll enregistree dans l'app | `1% de 200 000 = 2 000 FCFA` |

Si tu choisis `1%` et que ta bankroll passe de `200 000` a `240 000 FCFA`, l'unite suggeree passe automatiquement de `2 000` a `2 400 FCFA`.

Si tu preferes garder toujours la meme mise, le mode **Montant fixe** est plus adapte.

Pourquoi des unités et pas des montants fixes ?

- Quand tu gagnes, l'unité augmente — tu capitalises naturellement sur la progression.
- Quand tu perds, l'unité diminue — tu te protèges automatiquement sans décision à prendre.
- Et si tu veux plus de stabilité, un montant fixe t'évite de recalculer manuellement à chaque session.

> Les unités absorbent les hauts et les bas sans que tu aies à recalibrer ta mise à chaque pari.

> Important : le pre-remplissage du coupon reste une suggestion. Tu peux toujours modifier la mise manuellement avant validation.

## Quelle taille d'unité ?

| Profil                  | Unité recommandée |
| ----------------------- | ----------------- |
| Conservateur            | 1%                |
| Standard                | 1–2%              |
| Agressif (volume élevé) | 2–3%              |

Au-delà de 3%, une série de 10 pertes consécutives (fréquente en EV) peut effacer 26% du capital.

## Le drawdown est inévitable

Même avec une EV positive, tu auras des séries négatives. Ce n'est pas un bug — c'est la variance.

Exemple réel : un système avec EV = +15% peut avoir un drawdown de -25% sur 30 paris avant de rebondir. C'est statistiquement normal.

**La mauvaise réaction :** augmenter les mises "pour se refaire".  
**La bonne réaction :** continuer avec le même plan.

## Les 3 règles de discipline

### 1. Ne jamais sortir du cadre de mise

Une unité = une unité. Pas "2 unités ce soir parce que c'est sur".

Le plus important n'est pas de choisir **FIXE** ou **%**. Le plus important est de garder la meme logique dans le temps.

### 2. Ne pas changer de stratégie pendant un drawdown

Un drawdown de -15% sur 30 paris ne prouve pas que le système est cassé. Il faut 50+ paris pour commencer à tirer des conclusions statistiques.

### 3. Respecter les critères de sélection

Quand EVCore affiche `Passer`, le modèle n'a pas détecté de valeur suffisante — mais tu gardes toujours la liberté de placer un marché si tu as ta propre conviction. Si tu choisis de parier hors signal, fais-le en pleine conscience : ce pari ne sera pas suivi dans les stats du modèle comme un signal validé.

## Drawdown normal vs signal d'alerte

Le moteur suspend automatiquement un marché si le ROI dépasse **-15% sur 50+ paris**. C'est le seuil au-delà duquel la dégradation n'est plus attribuable à la variance.

Dans l'app, les marchés suspendus apparaissent avec un badge rouge. Aucune action de ta part n'est nécessaire.

## Suivre sa bankroll dans l'app

La page **Bankroll** (`/bankroll`) te permet de :

- Suivre le solde jour après jour (courbe)
- Voir le ROI sur une période sélectionnée
- Identifier les transactions par canal (EV / SV)
- Visualiser une projection 30 jours basée sur la tendance récente

## À retenir

- EVCore permet 2 modes : **montant fixe** ou **% de la bankroll**
- Le mode `%` ajuste automatiquement l'unite quand ta bankroll evolue
- Le mode fixe est utile si tu veux une mise stable d'un coupon a l'autre
- Le drawdown est prévu dans le modèle
- La discipline est le seul avantage que tu contrôles
- 50 paris minimum avant toute évaluation sérieuse

## À lire ensuite

- Les erreurs à éviter : `erreurs-frequentes`
- Lire ta bankroll dans l'app : `guide-bankroll`
