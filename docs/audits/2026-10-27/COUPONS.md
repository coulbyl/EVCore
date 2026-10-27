# Coupons : jouer un coupon en sachant ce qu'on risque

_Étape 4 du plan produit, branche `feat/produit-ux`, du 27/10/2026. Même méthode que pour Mesures historiques : un sous-agent isolé a fait la revue de design. Il n'a vu que les captures « avant » et le code, sans connaître les corrections prévues. Les deux détecteurs mesurent avant et après. Captures dans `captures/coupons-avant` et `captures/coupons-apres`, sorties brutes dans `scripts/cp-*.json`. Faux backend (`E2E_ROLE=OPERATOR`) : tous les matchs s'appellent « Alpha FC – Beta United » et toutes les jambes sont à 62 %._

La question du joueur sur cet écran : **« est-ce que je joue ce coupon, et qu'est-ce que je risque ? »**

## Ce que la revue a trouvé

Score Nielsen de la revue : **19/40**. Verdict : l'écran est plutôt propre au produit (relevé daté avec son effectif, « Pas encore de relevé », quatre issues distinctes, source affichée). Mais la carte restait un ticket de bookmaker : grosse cote, « Chances » en pourcentage, bouton panier, sans fréquence de perte ni pire série.

| Constat                                                                                                                                                                    | Gravité |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| « Jouer ce coupon » ajoutait les jambes au ticket existant : Favori + Combiné + Long donnaient sans prévenir un combiné de 6 jambes, et le premier coupon perdait sa trace | P1      |
| Pas de titre, pas de phrase pour dire à quoi sert l'écran ; la fréquence et la pire série de chaque produit n'apparaissaient nulle part                                    | P1      |
| La cote mise en avant était la nôtre (books les plus généreux), pas celle que le ticket paiera                                                                             | P1      |
| « Chances 21 % » et « 62 % de chances » en pourcentage, y compris sur des jambes au-dessus de 1,80                                                                         | P1      |
| « Pourquoi ce coupon ? » et les explications de source n'existaient qu'au survol : rien au doigt                                                                           | P1      |
| « Annulé » sur les jambes sous un coupon « Remboursé », « Intraday », titre d'onglet « Propositions »                                                                      | P2      |
| Confettis quand la majorité des coupons du jour gagne (même si le sien a perdu), compteurs « N ont joué »                                                                  | P2      |
| État vide sans explication, erreur sans « Réessayer », flèches de date de 28 px sans nom                                                                                   | P2      |

## Ce qui est fait

| Commit                 | Correction                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `b0365737`             | Jouer un coupon **remplace** le ticket (mise unitaire conservée), avec confirmation s'il contient d'autres sélections. Le ticket s'ouvre à chaque fois.                                                                                                                                                                                                                                                           |
| `701edffa`             | Backend : le relevé de chaque produit renvoie sa **pire série** de coupons perdus d'affilée (remboursements ignorés).                                                                                                                                                                                                                                                                                             |
| `862f3ea1`             | Carte coupon (partagée avec l'accueil) : chances en fréquence (« 1 sur 5 », « environ 6 fois sur 10 ») ; une jambe à 1,80 ou plus dit que son pourcentage est trop optimiste ; la cote 1xBet d'abord, la nôtre en « Réf. » ; relevé sur deux lignes avec la pire série ; explications ouvrables au doigt ; plus de compteurs ni de confettis ; « Remboursé » pour toute jambe rendue ; « Mis à jour en journée ». |
| `6fc81c6a`             | Défaut global : une règle `button { font: inherit }` hors couche annulait toute taille de police posée sur un bouton, dans toute l'app. Passée dans `@layer base`, comme la règle des liens le matin.                                                                                                                                                                                                             |
| `3f1e220d`             | Page : titre « Coupons du jour » et une phrase de mode d'emploi ; état vide qui explique l'abstention ; « Réessayer » sur erreur ; flèches de date à 44 px avec un nom (composant partagé) ; cartes non étirées ; place laissée au bouton flottant. Lien « Comprendre les canaux » de Mesures historiques réparé (route inexistante).                                                                             |
| `1289e2eb`             | Zone de toucher des puces étendue à 44 px sans changer leur dessin ; libellés de groupe de la barre latérale et badge de rôle au contraste AA.                                                                                                                                                                                                                                                                    |
| `cccb1560`, `4e7b9b4c` | Même étape, constat de l'audit du 23/10 (P1-8) : le Favori, le coupon long et le combiné moteur **retirent les matchs « Données suspectes »**, comme le faisait déjà le combiné IA. L'accueil aussi. L'info-bulle dit maintenant ce qui est réellement exclu.                                                                                                                                                     |

### « Données suspectes » : mesuré avant d'appliquer

Sur la copie de production, du 24/09 au 24/10 : 22 des 72 jambes PRICE et 9 des 41 jambes ENGINE tombaient sur un match signalé, alors que l'info-bulle promettait l'exclusion. Sélections réglées depuis le 01/07, hors VALUE, SAFE et avis IA :

| Tranche        | Matchs signalés, réalisé ÷ annoncé (alerte 1X2 ; alerte Plus/Moins) | Autres matchs |
| -------------- | ------------------------------------------------------------------: | ------------: |
| Sous 1,45      |                                                                1,04 |          1,01 |
| De 1,45 à 1,80 |                                                                0,85 |          0,92 |
| 1,80 et plus   |                                                           0,63–0,73 |          0,86 |

Sous 1,45, là où vivent le Favori et le Combiné, les matchs signalés passent comme les autres : l'exclusion ne leur coûte rien. Au-dessus, ce sont les estimations les plus fausses du moteur qui partent. Sur un jour type (20/10), 34 matchs sur 40 restent candidats.

## Mesures avant → après

| Mesure (`/dashboard/coupons`)        | 375 sombre | 375 clair | 1280 sombre | 1280 clair |
| ------------------------------------ | ---------: | --------: | ----------: | ---------: |
| impeccable, éléments signalés        |      9 → 8 |     8 → 7 |      10 → 7 |     11 → 8 |
| Textes sous 12 px (détecteur maison) |     19 → 0 |    19 → 0 |      18 → 3 |     18 → 3 |
| Contrastes insuffisants              |      1 → 0 |     1 → 0 |       2 → 0 |      2 → 0 |
| Titre de page (`h1`)                 |      0 → 1 |     0 → 1 |       0 → 1 |      0 → 1 |
| Commandes sans nom                   |      2 → 0 |     2 → 0 |       2 → 0 |      2 → 0 |

Les « cibles sous 44 px » restantes sont les puces ouvrables : leur zone de toucher est étendue par un pseudo-élément que le détecteur ne mesure pas. Sur grand écran s'ajoutent les liens de la barre latérale (36 px, à la souris). Les « cartes imbriquées » d'impeccable sont les cartes coupon dans le panneau de page, le motif de toute l'app.

## Score re-noté

Auto-évaluation après corrections, pas une revue indépendante : **19 → 29/40**.

| Heuristique            | Avant | Après | Ce qui manque encore                                                         |
| ---------------------- | ----: | ----: | ---------------------------------------------------------------------------- |
| État du système        |     2 |     3 | Pas d'heure limite au niveau du coupon                                       |
| Langage du joueur      |     2 |     3 | « à mise fixe », « Clôture » restent techniques                              |
| Contrôle               |     3 |     4 |                                                                              |
| Cohérence              |     2 |     3 | L'accueil (Hier, sélections du jour) garde « @1.22 » et des pourcentages     |
| Prévention des erreurs |     1 |     3 |                                                                              |
| Reconnaître            |     2 |     3 |                                                                              |
| Efficacité             |     2 |     2 | Toujours une longue liste sans regroupement par produit                      |
| Esthétique             |     3 |     3 |                                                                              |
| Récupération           |     1 |     3 |                                                                              |
| Aide                   |     1 |     2 | Pas d'article « Lire un coupon » ; le lien mène à « Comment lire une fiche » |

## Restes, dans l'ordre

1. **Risque en F CFA** sur chaque carte (« mise 1 000 F → 1 420 F si ça passe ; environ 1 jour sur 5 tu perds 1 000 F ») : il faut une mise de référence. Elle dépend de la décision ouverte sur l'unité de mise et le nom du bookmaker (PRODUCT.md).
2. **Combien de coupons par jour** : un par produit, le reste replié ? Quand deux générateurs proposent la même classe, les montrer comme une comparaison explicite plutôt que comme deux chances (question ouverte de la revue).
3. Harmoniser l'accueil : « Hier » et « Les sélections du jour » affichent encore « @1.22 » et « 71 % ».
4. « Jouer ce coupon » → « Suivre ce coupon » (suivi sans mise et notification) : c'est une fonctionnalité, pas un libellé (plan du 24/10).
5. Article de formation « Lire un coupon ».
