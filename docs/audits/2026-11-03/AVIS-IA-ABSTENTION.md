# Les avis de l'IA : un refus est un avis aussi

_Étude du 03/11, demandée par l'utilisateur : « on n'affiche pas d'avis très souvent, pourtant l'IA laisse un commentaire sur chaque match analysé, c'est un avis aussi non ? ». Copie de prod du 03/11 04:01._

## Réponse courte

1. **L'IA voit maintenant tous les matchs.** Les trous datent de la panne de la clé Together (10/10 – 28/10). Depuis le 30/10, elle donne un avis sur 100 % des matchs analysés.
2. **Elle joue 80 % d'entre eux, et la fiche montre ces avis.** Il reste **20 % de refus** (« no_play »), tous avec un texte. Sur la fiche, ils apparaissent comme « Pas d'avis ».
3. **Un refus est bien un avis.** Mais **95 % des textes de refus v5 décrivent les règles internes de l'IA**, pas le match : « aucun signal proche du seuil », « fourchette autorisée », « base raw_stats », « déjà couvert par nos lectures ». En l'état, on ne peut pas les montrer.
4. **Les avis joués ont le même défaut, à moindre dose** : 24 % de leurs textes citent « seuil », « fourchette » ou une base interne. Ils sont déjà affichés aujourd'hui.

## Mesures

Matchs analysés par le moteur, dernier avis de l'IA avant le coup d'envoi, rejoué avec la requête de la fiche (`MatchesRepository.findAiOpinion`), sur les matchs du 30/10 au 06/11 :

| Ce que montre la fiche                                                 | Matchs | Avec un texte |
| ---------------------------------------------------------------------- | -----: | ------------: |
| Le pari de l'IA                                                        |    394 |           394 |
| « Pas d'avis » alors que l'IA a refusé (texte caché)                   |     96 |            96 |
| Pas de décision de l'IA (matchs au-delà de 48 h au moment de la copie) |     46 |             — |

Couverture par jour (matchs analysés et vus par l'IA) : de 25 à 50 % entre le 15/10 et le 29/10, pendant la panne, puis 100 % depuis le 30/10.

Textes de la v5 (28/10 – 03/11, toutes analyses) :

| Verdict   | Textes | Règles internes citées (« seuil », « fourchette », « raw_stats »…) | « nos données internes » / « nos lectures » |
| --------- | -----: | -----------------------------------------------------------------: | ------------------------------------------: |
| Refus     |    767 |                                                             95,4 % |                                      66,4 % |
| Avis joué |  3 483 |                                                             24,0 % |                                      22,7 % |

Exemple de refus v5 : _« Aucun marché ne satisfait simultanément notre fourchette de cote (1.20‑1.80) et l'exigence d'être non couvert par notre lecture sélectionné… »_ C'est la procédure, pas un avis sur le match.

## Ce que livre la PR

- **VANTAGE v6 (`vantage-v6-match-voice`)** :
  - Le texte d'un refus devient un avis sur le match : qui a l'avantage, le visage probable de la rencontre, avec les équipes et leurs chiffres, puis pourquoi ne pas parier, en mots de parieur.
  - Les règles internes sont interdites dans **tous** les textes, avis joués compris.
  - Le refus est marqué `voice: "match"` dans `reasonDetails`, sauf si son texte cite encore une règle (`speaksOfRules`) : il reste alors caché, jamais coupé ni rejeté.
  - La version change, donc la cohorte v6 se lit à part : le prompt a changé, même si la règle de jeu est la même.
- **Fiche de match** : un refus v6 s'affiche « L'IA ne parie pas sur ce match », avec « Pourquoi ? » (le texte) et l'heure de la décision.
  - Un refus antérieur à la v6 reste « Pas d'avis » : son texte décrit les règles.
  - Pas de chance affichée, pas de cote : il n'y a pas de pari.
- Aucun changement de calibration ni de bilan : un refus n'a pas de pari à régler.

## À relire

Vers le 10/11, sur les premiers jours de v6 :

- part des refus dont le texte nomme encore une règle (cible : 0) ;
- part des avis joués qui en nomment une (24 % en v5) ;
- part de jeu : la v5 joue 82 % des matchs pour un budget de 3 sur 10. La v6 ne change pas la règle de jeu ; un écart dirait que le nouveau texte la déplace.
