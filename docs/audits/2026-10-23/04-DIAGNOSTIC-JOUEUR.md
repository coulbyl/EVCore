# EVCore — Diagnostic du point de vue d'un joueur

_Diagnostic du 23/10/2026, à partir des données de production lues avec votre session Opérateur (API `coupons` et `channel-decisions/by-match`, lecture seule). Période : 46 jours, du 08/09 au 22/10/2026 pour les résultats réglés. Complète `02-AUDIT-SITE.md` (conformité) par la question « qu'est-ce qu'un parieur gagne ou perd à suivre EVCore ? »._

## Méthode, en bref

- **Ce que j'ai mesuré** :
  - **Coupons** : 91 coupons publiés, tous produits confondus.
  - **« Notre sélection »** : 2 706 sélections, une par match, recalculées avec l'algorithme de la page Décisions (`primaryPick`).
  - **Toutes les sélections émises** : 25 853, une par canal et par match, hors méta-canaux, VALUE, SAFE et Avis IA.
  - **Avis IA** : 980 sélections.
- **Comment je compte** : résultat réel réglé, mise fixe d'une unité. Le ROI est calculé deux fois, à la cote affichée et à la cote « jouable » (1xBet quand elle est connue). Les remboursements (« Remboursé si nul ») sont exclus du taux de réussite.
- **Limites à garder en tête** :
  - Le statut de fiabilité utilisé pour recalculer « Notre sélection » est celui d'aujourd'hui (fenêtre de 90 jours) : c'est une légère vision a posteriori.
  - Sur 2 500 sélections, un ROI est connu à environ ± 2,5 points (intervalle à 95 %). Sur 200 sélections, à environ ± 7 points. Sur 10 coupons, il ne veut rien dire. Les écarts plus petits que ces marges sont du bruit.

---

## 1. Ce que vit un joueur qui suit les coupons

**Solde cumulé à mise 1 unité, à la cote jouable, depuis le lancement des formats actuels (13/10) :**

| Produit                                                   | Jours réglés | Gagnés | Cote jouable moyenne | Solde au 22/10 |
| --------------------------------------------------------- | -----------: | -----: | -------------------: | -------------: |
| « Pari sûr du jour » (1 sélection)                        |            7 |  **6** |                 1,16 |    **−0,15 u** |
| Combiné du jour (moteur)                                  |            9 |  **7** |                 1,23 |    **−0,34 u** |
| Combiné du jour (IA)                                      |            8 |      5 |                 1,47 |        −0,59 u |
| Coupon long 2,5–5                                         |            4 |      1 |                 3,01 |        −1,01 u |
| Coupon prix 5–15 (retiré de l'affichage), depuis le 17/09 |           29 |      4 |                 6,96 |        +0,66 u |
| Coupon 5–15 IA (arrêté le 12/10)                          |            5 |      0 |                 5,34 |        −5,00 u |

**Le constat central** : un joueur gagne presque tous les jours et finit pourtant en léger négatif. Avec le « Pari sûr », 6 jours gagnés ont rapporté +0,85 u, et la seule perte (21/10) a tout repris. C'est la réalité de l'arithmétique des cotes courtes, pas un défaut du moteur. Mais c'est exactement ce qu'un nouveau joueur ne comprend pas, et il faut le lui montrer en premier (voir §6).

**Ce qui gêne un joueur, au quotidien :**

1. **Des sélections injouables** : le « Pari sûr » des 16 et 18/10 valait 1,06 chez 1xBet, et une jambe du combiné du 15/10 valait 1,09 au total. Ces cotes sont sous le minimum de 1,10 du bookmaker : le joueur ne peut pas les miser.
2. **Des jours sans produit** : pas de « Pari sûr » les 19 et 20/10, pas de « Combiné IA » les 13, 17 et 23/10. Rien n'explique l'absence à l'utilisateur. Pour le combiné IA, c'est la panne de clé LLM documentée dans PREMIERE-LECTURE.md.
3. **Deux « Combiné du jour » différents**, l'un IA, l'autre moteur, avec des résultats opposés le même jour (voir audit P2-11).
4. **Personne ne joue les coupons** : 1 seul « joué » enregistré sur les 91 coupons, et 1 à 4 vues par coupon. Le bouton « Jouer ce coupon » n'est pas utilisé.

---

## 2. « Notre sélection » (page Décisions), jour par jour

**Sur 46 jours** : 2 587 sélections réglées, **72,9 % réussies pour 75,3 % annoncées**. ROI −2,0 % à la cote affichée, **−4,1 % à la cote jouable** (marge ± 2,5 pts).

| Période       | Réglées | Réussite réelle | Annoncée | ROI (cote affichée) |
| ------------- | ------: | --------------: | -------: | ------------------: |
| 08/09 → 08/10 |   1 454 |          69,9 % |   72,7 % |              −1,9 % |
| 09/10 → 22/10 |   1 133 |      **76,9 %** |   78,6 % |              −1,9 % |

**Lecture joueur** : la page annonce des probabilités à peu près justes, avec un écart moyen de 2 points en trop. La réussite a progressé depuis le 9/10, mais les cotes ont baissé d'autant : le ROI ne bouge pas. Suivre toutes les sélections revient à perdre lentement la marge du bookmaker, ce qui est cohérent avec vos propres audits.

**Volume** : en moyenne 25 à 27 sélections par jour du lundi au jeudi, **156 le samedi et 126 le dimanche**. Le week-end, aucun joueur ne peut lire 150 cartes : le bloc « Les sélections du jour » de l'accueil (5 sélections) est la bonne réponse et doit devenir l'entrée principale.

### Par tranche de cote

| Cote      | Réglées | Réussite |   Annoncée | ROI affiché | ROI jouable |
| --------- | ------: | -------: | ---------: | ----------: | ----------: |
| 1,20–1,35 |   1 588 |   78,1 % |     78,5 % |      −2,0 % |      −4,1 % |
| 1,35–1,50 |     569 |   69,6 % |     72,6 % |      −1,8 % |      −3,7 % |
| 1,50–1,80 |     202 |   64,4 % |     68,5 % |      +4,1 % |      +2,2 % |
| 1,80–2,50 |      99 |   48,5 % | **65,6 %** |      −2,0 % |      −3,9 % |
| > 2,50    |      62 |   22,6 % |     37,8 % | **−23,7 %** |     −25,4 % |
| Sans cote |      68 |   86,8 % |     91,8 % |           — |           — |

Sous 1,50, l'annonce est juste. Au-dessus de 1,80, le moteur surestime fortement ses chances : 17 points d'écart en 1,80–2,50. C'est cohérent avec la règle « couper sur la cote » de CLAUDE.md. **68 « Notre sélection » n'ont aucune cote** : on montre au joueur un pari qu'il ne peut pas évaluer.

### Par marché : où l'annonce trompe le joueur

| Marché                                     | Réglées | Réussite | Annoncée |        Écart | ROI affiché |
| ------------------------------------------ | ------: | -------: | -------: | -----------: | ----------: |
| **Double chance**                          |     561 |   71,8 % |   79,6 % | **−7,8 pts** |  **−6,2 %** |
| **Buts par équipe (extérieur)**            |     318 |   70,8 % |   79,3 % | **−8,5 pts** |      −4,0 % |
| Buts par équipe (domicile)                 |     462 |   76,0 % |   80,1 % |     −4,1 pts |      +0,4 % |
| Plus/moins de buts                         |     628 |   75,3 % |   76,9 % |      −1,6 pt |      +0,8 % |
| Les deux équipes marquent                  |     108 |   64,8 % |   63,1 % |      +1,7 pt |      −4,6 % |
| **Gagne une mi-temps**                     |     170 |   75,9 % |   66,6 % | **+9,3 pts** |      −2,5 % |
| **Remboursé si nul** (hors remboursements) |     164 |   77,4 % |   68,3 % | **+9,1 pts** |      +2,8 % |
| Buts 1re mi-temps                          |      84 |   76,2 % |   73,0 % |     +3,2 pts |      +4,3 % |
| Victoire (1X2)                             |      67 |   49,3 % |   46,4 % |     +2,9 pts |      −7,4 % |
| Nul                                        |      37 |   24,3 % |   28,3 % |     −4,0 pts |     −15,2 % |

**Deux problèmes opposés** :

- **La Double chance est la sélection la plus fréquente et la plus surestimée** (8 points), avec le ROI le plus mauvais des gros volumes. Un joueur qui voit « 80 % » et perd une fois sur trois perd confiance.
- **« Gagne une mi-temps » et « Remboursé si nul » sont sous-annoncés de 9 points.** Comme « Notre sélection » est choisie par probabilité, ces marchés sont défavorisés à tort face à la Double chance, alors qu'ils réussissent mieux que ce qu'on affiche.

Aucun de ces marchés ne bat la cote de façon démontrée : les ROI restent dans la marge d'erreur. C'est un problème d'**affichage et de classement**, pas une mine d'or.

---

## 3. Ce que les coupons ignorent

- Les coupons n'utilisent qu'une petite partie des sélections : **21 des 2 587 « Notre sélection » réglées sont entrées dans un coupon** (113 sélections sur 25 853 au total). C'est voulu (1 à 3 jambes par coupon), mais cela veut dire que le coupon n'est pas « le meilleur de la page ».
- **Ce qui est hors coupon ne fait pas mieux** : 72,9 % de réussite pour 75,3 % annoncés et −1,9 % de ROI, contre 71,4 % pour 76,1 % et +4,2 % dans les coupons (21 sélections seulement, donc rien de concluant). Il n'y a pas de pépite négligée de façon systématique.
- **Les marchés de mi-temps sont presque toujours bloqués** : sur la période, **7 077 décisions des canaux 1re mi-temps, Buts 1re MT et Mi-temps/Fin de match ont été rejetées pour « marché suspendu »**, soit la majorité des matchs chaque jour. Pourtant, quand ils passent, « Buts 1re MT » réussit à 76,2 % pour 73,0 % annoncés (+4,3 % de ROI, 84 sélections). La suspension suit la règle du dépôt (ROI < −15 % établi sur 90 jours, mesuré sur toutes les sélections réglées du marché via `channel_selection_deduped`) : elle est donc fondée, car le marché pris dans son ensemble perd. Mais la sélection principale à cote courte s'en sort mieux. **Piste** : évaluer la suspension par tranche de cote (sous 1,50 / au-dessus) plutôt que par marché entier, à tester en ombre avant toute réactivation, qui reste une décision humaine.
- **Sous 1,20, toutes sélections confondues**, la réussite est de 89,2 % pour 80,9 % annoncés et le ROI de −0,7 % : c'est la tranche la moins coûteuse. Mais elle est injouable chez le bookmaker local (minimum 1,10), et c'est pour cette raison que l'interface l'écarte. C'est le bon choix pour le joueur.
- **Les sélections qui battent la cote de clôture** existent mais sont rares (118 sur 13 918 qui en ont une) et ne sont connues qu'après coup. C'est un indicateur à suivre, pas un filtre utilisable avant le match.

**Opportunités réelles d'amélioration** (sans promettre de gain) :

1. **Recalibrer la probabilité affichée par marché** : baisser la Double chance et les buts par équipe à l'extérieur, monter « Gagne une mi-temps » et « Remboursé si nul ». Le joueur lirait des chances justes, et « Notre sélection » changerait de marché sur une partie des matchs.
2. **Étudier une suspension des marchés de mi-temps par tranche de cote** plutôt que par marché entier (ci-dessus).
3. **Ne jamais mettre en avant une sélection sans cote**, et masquer la cote du meilleur bookmaker derrière la cote jouable.

---

## 4. « Données suspectes » : le badge est mal présenté

**Ce que dit l'interface** : « le moteur exclut automatiquement toutes les sélections de ce match des paris réels ».

**Ce que montrent le code et les données :**

- L'exclusion ne s'applique qu'à l'ancien pool de mises (table `bet`, plus alimentée depuis le 04/09) et au pool de jambes du générateur IA (`leg-pool.builder.ts`). **Les coupons moteur et prix ne filtrent pas ce signal** : depuis le 13/10, **17 des 88 jambes de coupons portaient sur un match « Données suspectes »**, dont 5 des 9 « Pari sûr ». Ces jambes ont donné 14 gagnées, 2 perdues et 1 en attente.
- **Sur « Notre sélection », le signal seul n'annonce pas de mauvais résultat** : 421 sélections signalées réussissent à **74,1 % pour 73,9 % annoncés** (ROI +4,6 %), contre 73,2 % pour 75,6 % sur les matchs sans signal (ROI −3,3 %).
- **Il devient pertinent dans deux cas** :
  - **combiné au signal AVOID** : 58,1 % réussis pour 74,7 % annoncés, ROI −7,1 % (86 sélections) ;
  - **sur les cotes longues** : toutes sélections confondues, les matchs signalés réussissent à 41,1 % pour 47,1 % annoncés, contre 44,9 % pour 47,4 % sans signal.

**Recommandation :**

1. Renommer le bandeau « Données suspectes » en « Désaccord modèle / marché », qui décrit ce qui est mesuré.
2. Corriger l'info-bulle : supprimer la promesse d'exclusion, ou l'appliquer réellement.
3. Réserver l'alerte forte (et l'exclusion des coupons) aux matchs où AVOID se déclenche aussi, ou aux sélections au-dessus de 1,80.
4. Ne pas afficher « Fiable » et « Données suspectes » sur la même carte sans expliquer lequel prime.

---

## 5. Avis IA, jour par jour

| Période                     | Réglées |   Réussite |   Annoncée | Cote moy. | ROI affiché | ROI jouable |
| --------------------------- | ------: | ---------: | ---------: | --------: | ----------: | ----------: |
| Avant la v4 (08/09 → 12/10) |     741 |     52,9 % |     58,5 % |      2,01 |     −10,1 % |     −12,8 % |
| **v4 (13/10 → 22/10)**      |     201 | **63,7 %** | **63,1 %** |      1,52 |  **−2,5 %** |      −3,7 % |

**Jour par jour depuis la v4 (réglées, gagnées, réussite, annoncée)** :

| Jour     | 13   | 14   | 15   | 16   | 17   | 18       | 19   | 20       | 21   | 22   |
| -------- | ---- | ---- | ---- | ---- | ---- | -------- | ---- | -------- | ---- | ---- |
| Réglées  | 18   | 21   | 15   | 17   | 34   | 25       | 18   | 21       | 15   | 17   |
| Gagnées  | 11   | 13   | 8    | 9    | 22   | **10**   | 11   | **20**   | 12   | 12   |
| Réussite | 61 % | 62 % | 53 % | 53 % | 65 % | **40 %** | 61 % | **95 %** | 80 % | 71 % |
| Annoncée | 64 % | 62 % | 61 % | 62 % | 63 % | 65 %     | 64 % | 64 %     | 61 % | 64 % |

**Lecture :**

- La v4 a nettement progressé : l'IA ne propose plus rien au-dessus de 1,80 depuis le 15/10, et sa probabilité annoncée est juste en moyenne.
- Elle reste **très variable d'un jour à l'autre**, de 40 % le 18/10 à 95 % le 20/10. Pour un joueur qui juge sur une journée, c'est déroutant.
- Elle **joue presque tout** : 81 % des matchs en moyenne depuis le 13/10, de 65 % à 92 % selon les jours (24 avis sur 26 le 23/10). Un « avis » qui dit oui neuf fois sur dix ne guide pas.
- **La moitié de ses avis portent sur « Les deux équipes marquent »** (117 sur 231 depuis la v4), pour 59,6 % de réussite.
- **Ses « Double chance » sont nettement surestimées** : 61,1 % réussis pour 78,6 % annoncés (18 sélections), le même défaut que le moteur.
- **Aucun avis IA du 23/09 au 05/10** : treize jours de trou, sans message pour l'utilisateur.
- La qualité des textes reste à reprendre : jargon interne et ton incitatif (audit P2-10).

**Recommandations IA** : imposer un plafond déterministe (par exemple les 5 avis les mieux fondés par jour, comme l'envisage PREMIERE-LECTURE.md), exclure la Double chance de l'IA tant qu'elle reste surestimée, et afficher l'historique de l'IA par jour dans sa page.

---

## 6. Ce qui attire et retient un joueur : recommandations produit

| Priorité | Amélioration                                                                                                                           | Pourquoi, côté joueur                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1        | **Afficher le solde cumulé à côté du taux de réussite** sur chaque carte coupon (« 6 jours gagnés sur 7 · solde −0,15 u à mise fixe ») | C'est l'information qui distingue EVCore d'un tipster ; c'est aussi la plus honnête et la plus pédagogique. |
| 2        | **Ne publier que des jambes à 1,10 ou plus chez le bookmaker du joueur**, et afficher cette cote en premier                            | Un pari injouable est une promesse non tenue.                                                               |
| 3        | **Annoncer les jours sans coupon et leur raison** (« aucune sélection ne passait nos règles aujourd'hui »)                             | Une abstention expliquée renforce la confiance ; un trou silencieux la détruit.                             |
| 4        | **Recalibrer les probabilités affichées par marché** (§2)                                                                              | Le joueur doit pouvoir croire le pourcentage.                                                               |
| 5        | **Faire de « Les sélections du jour » l'écran principal**, limité à 5–10, et garder Décisions pour les curieux                         | 156 cartes le samedi, c'est illisible.                                                                      |
| 6        | **Distinguer clairement les deux combinés** (nom et couleur), et afficher pour chacun son historique                                   | Le joueur doit pouvoir choisir son produit et le suivre.                                                    |
| 7        | **Revoir le badge « Données suspectes »** (§4)                                                                                         | Aujourd'hui il inquiète sans protéger.                                                                      |
| 8        | **Remplacer « Jouer ce coupon » par « Suivre ce coupon »** (suivi sans mise, notification du résultat)                                 | Personne ne « joue » dans l'app ; suivre est l'usage réel et ne pousse pas à miser.                         |

---

## 7. Messages défendables pour le plan marketing

Ces chiffres sont utilisables, à condition de toujours donner la période, l'effectif et la mention « ne garantit pas les résultats futurs » :

- « Du 9 au 22 octobre 2026, nos sélections principales ont réussi à 76,9 % pour 78,6 % annoncés (1 133 sélections réglées). »
- « Depuis le 13/10, l'avis IA annonce 63 % et réussit à 64 % (201 sélections). »
- Et, pour la pédagogie : « 6 jours gagnés sur 7, et pourtant −0,15 unité : voici pourquoi une cote de 1,16 ne pardonne pas une seule perte. »

À ne jamais utiliser : « 95 % le 20/10 », « 6 jours sur 7 » sans le solde, et tout ROI isolé.
