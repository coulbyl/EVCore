# Avis IA : l'écran et le modèle

_Étape 6 du plan produit, branche `feat/produit-ux`, du 27/10/2026. Deux volets : l'écran (revue de design isolée, détecteurs avant/après) et le modèle VANTAGE lui-même, mesuré sur la copie de production restaurée (dump du 24/10). Captures dans `captures/avis-ia-avant` et `captures/avis-ia-apres`, sorties brutes dans `scripts/ia-*.json`._

## 1. Ce que fait vraiment l'IA (VANTAGE v4, du 13 au 24/10)

Mesures par jambe, dédupliquées (`channel_selection_deduped`, avant coup d'envoi). Probabilité du marché sans marge = 1/cote ÷ 1,05 (VANTAGE n'enregistre pas la marge payée).

| Mesure                                        | Valeur                                                               |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Matchs lus / avis proposés                    | 311 / 250 : **80 % de jeu** (le prompt demande « au plus 3 sur 10 ») |
| Avis réglés                                   | 300                                                                  |
| Annoncé / réalisé                             | 63,9 % / 64,7 % : bien calibré                                       |
| Écart au marché (réalisé − marché sans marge) | **+1,0 point ± 2,7** : pas mieux que la cote                         |
| À mise fixe                                   | −2,3 %                                                               |

Par base déclarée :

| Base             | Avis | Annoncé | Réalisé | Écart au marché | À mise fixe | Textes qui nomment une équipe |
| ---------------- | ---: | ------: | ------: | --------------: | ----------: | ----------------------------: |
| `tension`        |  109 |  65,9 % |  63,3 % |      −2,5 ± 4,5 |      −9,1 % |                          40 % |
| `raw_stats`      |  100 |  67,2 % |  68,0 % |      +1,1 ± 4,7 |      −2,8 % |                          91 % |
| `near_threshold` |   69 |  57,1 % |  63,8 % |      +4,2 ± 5,8 |      +2,1 % |                          51 % |

Aucune différence entre bases n'est significative. Le relevé du 17/10 (n ≈ 30 par base) classait d'ailleurs `tension` en tête. Mais 99 % des textes `tension` justifient le pari par « nos données internes sont en désaccord ». Une base `tension`, c'est choisir un camp entre deux de nos propres lectures, exactement ce que Décisions présente désormais comme « deux estimations à part ».

## 2. Ce qui change dans le modèle

| Commit     | Changement                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `98468347` | **Nettoyeur de texte.** Rejoué sur les 513 textes écrits depuis le 13/10, il en corrige 58 : accord du verbe après « nos données internes » (16 fautes, dont une partie créée par notre propre remplacement du mot « canal »), consignes du prompt recopiées (« respectant les contraintes de cote »), « les lectures de nos lectures », majuscule en tête, virgule décimale dans le texte de refus. Le verdict et la probabilité ne sont jamais touchés. |
| `f147558d` | **v5 : la contradiction entre nos lectures n'est plus une base de pari.** Le prompt n'offre plus que `near_threshold` et `raw_stats`. Si le modèle déclare encore `tension`, le refus est enregistré (`VANTAGE_GATED_BASIS`), comme pour le plafond de cote. `CONFIG_VERSION = vantage-v5-no-tension`.                                                                                                                                                    |

Pourquoi v5 malgré des écarts non significatifs :

1. **Le taux de jeu.** Le relevé du 17/10 prévoyait un plafond déterministe si l'IA jouait encore 8 matchs sur 10 au bout de deux semaines, et c'est le cas. Sans les avis `tension`, le taux attendu est d'environ 48 %.
2. **Le joueur ne peut rien vérifier dans ces textes.** « Nos données internes sont en désaccord » ne cite aucun fait sur le match.
3. **La cohérence du produit.** Décisions explique maintenant ces paires comme des estimations séparées, pas comme une raison de parier.
4. **Rien ne plaide pour les garder.** Sur la même période, les autres bases font 65,4 % réalisés pour 62,7 % annoncés et +1,6 % à mise fixe. Les avis `tension` font −9,1 %.

Ce que v5 ne promet pas : un gain. L'IA reste derrière ou au niveau de la cote, comme le reste du moteur.

**À relire dans deux semaines, sur la seule cohorte `vantage-v5-no-tension`** : taux de jeu, part de refus `VANTAGE_GATED_BASIS` (si elle dépasse 20 %, le modèle ignore la consigne), réalisé ÷ annoncé et écart au marché par jambe. Si le taux de jeu reste au-dessus de 40 %, il faudra le plafond par journée classé sur le coût du marché. La marge payée n'est enregistrée aujourd'hui que pour 60 % des avis (via les lectures sœurs) : il faut l'enregistrer sur la sélection VANTAGE elle-même avant de pouvoir classer dessus.

## 3. L'écran

Revue isolée : **19/40**. Elle relevait que l'écran promettait la rareté, n'avait aucun bilan, écrivait encore les paris à l'ancienne et ne répondait pas à la question du joueur : est-ce que l'avis vaut mieux que Notre sélection ?

| Commit     | Correction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cdad706e` | Phrase d'introduction honnête (« une deuxième lecture… elle propose souvent un pari ») et compte du jour. **Bilan daté en tête** : 30 jours, effectif, réalisé contre annoncé, résultat à mise fixe, et la phrase « l'IA ne bat pas la cote du bookmaker ». Avis écrit comme un pari de Décisions : équipes, fréquence, cote jouable d'abord, note par cote. **Sous chaque avis, ce que dit Notre sélection sur le même match**, avec « même pari » ou « pari différent ». Refus déterministes affichés comme « Écarté » avec leur raison. Matchs à venir d'abord, matchs terminés repliés. Textes à 12 px minimum, rose au contraste AA, filtres à 44 px, « Réessayer » sur erreur, titre d'onglet « Avis IA ». |
| `a3afb0a5` | Le badge de fiabilité par championnat n'est plus affiché nulle part : supprimé avec son texte.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

| Mesure (`/dashboard/arbitrage?filter=all`) | 375 sombre | 375 clair | 1280 sombre | 1280 clair |
| ------------------------------------------ | ---------: | --------: | ----------: | ---------: |
| impeccable, éléments signalés              |     15 → 5 |    14 → 4 |      14 → 5 |     15 → 6 |
| Textes sous 12 px (détecteur maison)       |     10 → 0 |    10 → 0 |      13 → 3 |     13 → 3 |
| Contrastes insuffisants                    |      0 → 0 |     6 → 0 |       0 → 0 |      6 → 0 |

Restes : la barre latérale sur grand écran (liens de 36 px à la souris), l'icône « ? » (zone de toucher élargie, que le détecteur ne voit pas).

Score re-noté, en auto-évaluation : **19 → 29/40**.

## 4. Questions ouvertes

1. **Rôle de l'écran.** Deuxième lecture pour comprendre, ou pari à suivre ? Aujourd'hui, pas de bouton d'ajout au coupon, et Décisions exclut l'IA. L'écran est cohérent avec « deuxième lecture ».
2. **Afficher la base déclarée de chaque avis ?** Non pour l'instant : les écarts entre bases ne sont pas significatifs, et l'afficher se lirait comme un signal de qualité.
