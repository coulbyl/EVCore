# Formation : cinq fiches d'une minute

_Étape 7 du plan produit, branche `feat/produit-ux`, du 27/10/2026. Consigne de l'utilisateur : « les gens n'aiment pas lire, simplifie au maximum, retire tout ce qui ne sert plus ». Captures dans `captures/formation-avant` et `captures/formation-apres`, sorties des détecteurs dans `scripts/fo-*.json`._

## Avant

- **15 articles** de 490 à 1 360 mots, environ 10 000 mots en tout, plus 17 scripts de tournage et une vidéo « en cours de production » depuis juillet, cachée de la liste. Au total, 19 800 mots.
- Une page de **4 800 px de haut** sur téléphone : une carte mise en avant, des filtres par catégorie, 15 cartes avec niveau et durée.
- Des articles écrits pour des initiés, qui racontent l'histoire du moteur (« Le canal TEAM_TOTAL : ce qu'a coûté une promotion sur neuf jours »). Plusieurs décrivaient des canaux que le joueur ne voit plus (VALUE, SAFE), ou un « edge » que le produit a abandonné.
- Le badge « Diplômé » exigeait dix articles et la vidéo jamais tournée : **personne ne pouvait l'obtenir**.

## Après

| Fiche | Question                                                    | Mots |
| ----- | ----------------------------------------------------------- | ---: |
| 1     | Comment lire un pronostic ?                                 |  201 |
| 2     | Une cote, c'est combien de chances ?                        |  153 |
| 3     | Favori, combiné, coupon long, avis IA : quelle différence ? |  173 |
| 4     | Pourquoi je perds plusieurs jours de suite ?                |  128 |
| 5     | Les 5 erreurs qui coûtent le plus                           |  137 |

966 mots au total, front matter compris. Chaque fiche est une question, au tutoiement, avec un « À retenir ». Elles décrivent l'app telle qu'elle est aujourd'hui : types de pari, fréquence, cote 1xBet d'abord, note par cote, pire série, Données suspectes.

Les chiffres cités sont calculés et non tirés d'un backtest :

- « 1 divisé par la cote » ;
- « six sélections à 8 sur 10 passent ensemble environ 1 fois sur 4 » (0,8⁶ = 0,26) ;
- « sur un mois de paris à 8 sur 10, 2 jours perdus d'affilée arrivent environ 2 mois sur 3, 3 d'affilée environ 1 mois sur 6 » (simulation, 200 000 tirages : 0,64 et 0,17).

Aucun taux de réussite de produit n'est cité sans sa période : la fiche 3 renvoie au relevé de chaque coupon.

| Commit     | Changement                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aea9bfc7` | Cinq fiches à la place des 15 articles, de la vidéo et des scripts.                                                                                                                                                                                                                                                                              |
| `4736a4e6` | Liste numérotée, et c'est tout. La fiche : « Fiche 1 sur 5 · 1 min », le texte, « J'ai lu cette fiche », « Fiche suivante ». Les 15 anciennes adresses redirigent vers la fiche qui reprend leur sujet. Liens d'aide de Décisions, Coupons et Mesures historiques rebranchés. Tests e2e réécrits (les anciens échouaient déjà avant la branche). |
| `49f0dcb5` | Badge « Diplômé » : les cinq fiches lues.                                                                                                                                                                                                                                                                                                        |
| `1c93115d` | Page « Aide » orpheline retirée : un guide « à jouer / à éviter par ligue » tiré de simulations sur 3 saisons, contraire aux règles du produit, lié de nulle part.                                                                                                                                                                               |
| `dcdc2068` | Chargeur de contenu débarrassé des champs vidéo, chapitres, niveaux et contenus liés.                                                                                                                                                                                                                                                            |

| Mesure (`/dashboard/formation`) | 375 sombre | 375 clair | 1280 sombre | 1280 clair |
| ------------------------------- | ---------: | --------: | ----------: | ---------: |
| impeccable, éléments signalés   |      9 → 3 |     8 → 2 |       8 → 2 |      9 → 3 |
| Éléments de texte à l'écran     |    82 → 25 |   82 → 25 |     95 → 38 |    95 → 38 |
| Textes sous 12 px               |      1 → 0 |     1 → 0 |       4 → 3 |      4 → 3 |
| Contrastes insuffisants         |      1 → 0 |     1 → 0 |       1 → 0 |      1 → 0 |
| Cibles sous 44 px               |      5 → 0 |     5 → 0 |     18 → 13 |    18 → 13 |

Sur téléphone, la liste tient en un écran. Ce qui reste sur grand écran vient de la barre latérale.

## Restes

- Le glossaire (`/dashboard/glossaire`, 3 900 mots) n'est visible que des admins : non touché.
- Les badges « Calibré » et « Patience », que rien n'attribuait, sont retirés (`d3a31853`). L'avatar « Oracle » se débloque désormais avec « Diplômé ».
