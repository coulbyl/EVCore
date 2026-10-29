# Refonte UI — 8. Résultats

_29/10/2026. Suite de [02-les-4-onglets.md](02-les-4-onglets.md) § 3. Proposition à corriger. L'onglet Résultats remplace Mesures historiques côté joueur ; la page actuelle (canaux, bandes de cote, verdict Conforme / Optimiste) reste **côté admin**, elle juge le moteur, pas les produits._

## 0. La question à laquelle il répond

« Est-ce que je peux vous croire ? » Un seul moyen d'y répondre : montrer ce que chaque produit a donné, **daté et compté**, pertes comprises, et le comparer à ce qu'on avait annoncé. Rien ici n'est rejoué, recalculé ni rafraîchi après coup : un résultat est celui d'un coupon **publié avant le coup d'envoi**, réglé sur le score. Un produit né le 28/10 a deux jours de recul, et l'écran le dit.

## 1. L'onglet

```
 EVCore                                🔔  (K)
────────────────────────────────────────────────
 Hier  mardi 28
 Favori ✓ 1,24   Combiné ✓ 1,41   Cote 2 ✗        ›
────────────────────────────────────────────────
 30 j   ● 90 j   Tout
────────────────────────────────────────────────
 Favori          ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✓ ✓ ✓   11 jours gagnés sur 14   ›
 Combiné         ✓ ✗ ✓ ✓ ✓ ✓ ✗ ✓ ✓ ✓   11 jours gagnés sur 15   ›
 Cote 2          ✗                     Trop tôt · 1 jour        ›
 Chasseur Nul    ✓                     Trop tôt · 1 jour        ›
 Chasseur Buts                         Trop tôt · 0 jour        ›
 Chasseur Score                        Trop tôt · 0 jour        ›
 Chasseur Corners ✓                    Trop tôt · 1 jour        ›
 Combiné IA      ✓ ✓ ✗ ✓ ✓ ✗ ✓ ✓ ✓ ✓   8 jours gagnés sur 11    ›
 Accumulateur    ✗ ✗ ✗ ✓ ✗ ✗ ✗ ✗ ✗ ✗   1 jour gagné sur 12      ›
────────────────────────────────────────────────
 Avis IA         ✓ ✓ ✓ ✗ ✓ ✓ ✗ ✓ ✓ ✓   136 avis gagnés sur 207  ›
────────────────────────────────────────────────
 depuis le 13/10 · chaque ligne à sa date de mise en ligne
────────────────────────────────────────────────
  Aujourd'hui    Matchs    Résultats    Moi
```

**Premier niveau, de haut en bas**

1. **Hier**, la même ligne qu'en haut d'Aujourd'hui, avec la date : chaque coupon d'hier, sa pastille, la cote réellement payée après un ✓. Un toucher ouvre les coupons d'hier (§ 3). Le lundi, la ligne devient « Ta semaine : 5 jours gagnés sur 6 ».
2. **La période**, trois puces : 30 j · 90 j · Tout. 90 j par défaut. C'est la seule bascule de l'écran ([02](02-les-4-onglets.md) § 5).
3. **Une ligne par produit**, dans l'ordre d'Aujourd'hui : le nom court, **la forme sur les 10 derniers jours joués** en pastilles, « 11 jours gagnés sur 14 ». Le compte est celui de la période choisie ; les pastilles sont toujours les 10 derniers jours joués, quelle que soit la période.
4. **Avis IA**, séparé par un trait, parce que son unité n'est pas le jour mais l'avis : « 136 avis gagnés sur 207 ». Un avis est un pari sur un match, réglé au prix 1xBet.
5. **La ligne de date**, en pied : « depuis le 13/10 · chaque ligne à sa date de mise en ligne ». Sur « Tout », chaque produit compte depuis son premier jour en ligne, jamais avant.

**Les unités**

- **Un jour** = un coupon de rang 1 publié ce jour-là. Un produit qui s'abstient n'a pas de jour : il n'apparaît ni dans les pastilles ni dans le compte. Un coupon remboursé n'est ni gagné ni perdu : il ne compte pas dans « sur 14 ».
- **Un gain partiel** (une jambe remboursée, le reste gagné) est un jour gagné, à la cote réellement payée ([04](04-aujourdhui-en-detail.md) § 2).
- **« Trop tôt »** : moins de 10 jours réglés. On montre les pastilles qu'on a et le compte, jamais un pourcentage ni une forme sur 10 à moitié vide.

**Ce qui sort de l'écran** : les canaux (DOMINANT, DOUBLE_CHANCE…), la fréquence du marché, les bandes de cote, le verdict Conforme / Optimiste, le ROI en pourcentage, le classement par compétition, le CLV. Tout cela vit dans la page admin, inchangée.

**Budget** : aucun titre, aucun paragraphe, un chiffre par ligne.

## 2. Le détail d'un produit

Toucher une ligne ouvre une feuille.

```
 ‹                                   Favori du jour
 un match, favori à domicile, cote 1,20 à 1,35
────────────────────────────────────────────────
 Les 90 derniers jours
 ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ·  ·  · 
 11 jours gagnés sur 14 · 2 jours sans Favori
 pire série  1 jour perdu de suite
────────────────────────────────────────────────
 Annoncé   8 sur 10
 Réalisé   8 sur 10        du 13/10 au 28/10 · 14 jours
────────────────────────────────────────────────
 En francs, à 1 000 F par jour
 misé 14 000 F · rendu 13 600 F        du 13/10 au 28/10
────────────────────────────────────────────────
 Jour par jour
 28/10  ✓  PSG – Lens · Victoire du PSG · 1,24          ›
 27/10  ✓  Bayern – Köln · Victoire du Bayern · 1,20     ›
 26/10  ✗  Inter – Napoli · Victoire de l'Inter · 1,33   ›
 25/10  ·  pas de Favori · aucun favori entre 1,20 et 1,35
 …
```

**De haut en bas**

1. **L'en-tête** : le nom du produit, et sa définition en une ligne. C'est la seule phrase de la feuille.
2. **La grille** de la période : un signe par jour calendaire, ✓, ✗, « · » pour un jour sans coupon, « R » pour remboursé. On voit la présence autant que les gains. Dessous, le compte, les jours d'abstention, et la pire série en jours **perdus de suite**.
3. **Annoncé contre réalisé**, dans la même unité que partout : « x sur 10 ». L'annoncé est la moyenne des chances affichées sur la période, le réalisé ce qui s'est passé. Datés et comptés sur la même ligne. Pas de verdict : le joueur compare deux chiffres identiques ou pas.
4. **En francs** : la ligne de mise fixe de [02](02-les-4-onglets.md) § 3. « À 1 000 F par jour », misé et rendu, datés. Une perte s'écrit avec le même poids qu'un gain. **Jamais de pourcentage, jamais « rentable »** : à nos volumes un taux de retour sur des coupons n'a aucune puissance statistique, un compte en francs daté dit ce qui s'est passé et rien de plus. Le rendu est calculé sur la cote réellement payée.
5. **Jour par jour** : la liste des coupons du produit sur la période, les plus récents d'abord. Une ligne par jour : la date, la pastille, le match (ou « 3 matchs » pour un combiné), le pari, la cote payée. Un toucher ouvre le coupon réglé, la feuille de [04](04-aujourdhui-en-detail.md) § 2, avec ses jambes et leurs scores. Les jours sans coupon sont là aussi, avec la raison.

**Sur Avis IA**, mêmes blocs avec l'avis pour unité : la grille montre les derniers avis (pas les jours), « 136 avis gagnés sur 207 », annoncé 64 sur 100 contre réalisé 66 sur 100, « En francs, à 1 000 F par avis », et la liste des avis avec le match, le pari, la cote 1xBet. Le jour où le réglage de l'IA a changé est marqué dans la liste (« réglage changé le 27/10 ») ; on ne cache pas les avis d'avant.

**Budget** : un titre, une phrase (la définition), quatre chiffres au premier niveau (gagnés sur joués, pire série, annoncé/réalisé, francs).

## 3. Hier et la semaine

Toucher la ligne Hier ouvre les coupons d'hier, tous, réglés : une feuille avec les mêmes cartes qu'Aujourd'hui, dans le même ordre, chacune avec ✓ ou ✗ en grand et la cote payée. Un toucher sur une carte ouvre le coupon réglé. Les produits absents hier y figurent en gris avec leur raison.

Le lundi, la ligne Hier devient **Ta semaine** : « 5 jours gagnés sur 6 » pour le héros, et la feuille montre les 7 jours en lignes, un jour par ligne, avec la pastille de chaque produit. C'est le relevé du lundi ([lot 4](../../ROADMAP.md)), au même endroit que la notification qui y mène.

## 4. Les états

| État | Ce qu'on montre |
| --- | --- |
| **Produit trop jeune** (moins de 10 jours réglés) | « Trop tôt · 3 jours », les pastilles qu'on a. Dans le détail : la grille et la liste, mais ni annoncé/réalisé ni En francs ; à leur place, « Trop tôt pour comparer · 3 jours réglés ». |
| **Période vide** (30 j sur un produit sans coupon depuis 30 jours) | « Rien sur 30 jours », la ligne reste, les puces 90 j et Tout restent. |
| **Coupon d'hier pas encore réglé** (match de nuit) | La pastille est remplacée par l'heure du dernier match, « 02:30 », jusqu'au règlement. Jamais « en attente ». |
| **Aucun coupon hier** | « Hier · rien à jouer », la ligne reste, pas de toucher. |
| **Premier jour du joueur** | Rien de spécial : les résultats sont ceux des produits, pas les siens. Les siens sont dans Moi. |
| **Chargement, hors ligne, erreur** | Mêmes règles que [04](04-aujourdhui-en-detail.md) § 5. Hors ligne, la dernière page vue reste, datée « vu à 18:42 ». |
| **Pause active** | L'onglet reste ouvert : il ne propose rien à jouer. La ligne Hier et les produits se lisent ; les coupons réglés s'ouvrent, sans bouton. |

## 5. Ce qu'on ne montre pas, et pourquoi

- **Les produits retirés de l'offre** (le coupon prix 5–15, arrêté le 18/10) n'ont pas de ligne. Résultats parle de ce qu'on propose. Les joueurs qui l'ont suivi le gardent dans Moi › Mes coupons suivis, réglé.
- **Les résultats rejoués** (731 jours de Favori, 87 jours de Combiné dans les audits) ne sont pas affichés : ce ne sont pas des coupons publiés. Ils vivent dans les audits et dans Aide, sous la fiche du produit, avec le mot « rejoué ».
- **Le pourcentage**. Jamais. « 11 jours gagnés sur 14 », pas « 79 % » : la fraction porte sa taille, le pourcentage la cache.
- **Mes résultats**. Ils sont dans Moi : ici, c'est nous qu'on juge.

## 6. Ce qu'il faut construire

- **Un point d'entrée par produit** : jours joués, gagnés, perdus, remboursés, jours sans coupon avec raison, pire série, annoncé moyen, rendu à mise fixe, sur une période. Aujourd'hui l'API ne connaît que les canaux (`channel-stats`) et les tranches de probabilité (`coupons/indices`) ; un produit se lit sur `coupon_proposal` par source et bande de cote, rang 1, publié avant le premier coup d'envoi.
- **La date de mise en ligne de chaque produit**, en code, pour borner « Tout » et dater la ligne de pied.
- **La cote payée** par jour, depuis `realizedOdds`, pour Hier, la liste et En francs.
- **La raison d'abstention par jour**, déjà calculée pour Aujourd'hui (`couponAbstentions`), à conserver par date.
- **Avis IA** : lire la cohorte figée de `vantage_decision_history` (lot 5, `ai-track-record`), jamais la ligne vivante ; exposer la liste des avis réglés au prix 1xBet.
- **Ta semaine** : regrouper par jour sur 7 jours, le même calcul que le relevé du lundi.

## 7. Tranché le 29/10

1. **Le coupon long** — tranché le 29/10 : il disparaît, avec le coupon prix 5–15. Un **accumulateur de chasseurs** (3 jambes 2,0–4,0 des viviers chasseurs, classées par le coût du marché, cote 8 à 15, « environ 1 jour sur 10 », « jusqu'à 3 semaines sans gain ») le remplace, mesuré dans [ACCUMULATEUR.md](../audits/2026-10-29/ACCUMULATEUR.md). Sa ligne Résultats est la plus rouge de l'écran et c'est voulu : c'est la preuve qu'on ne cache rien. Nom montré à choisir.
2. **« Trop tôt »** — tranché le 29/10 : 10 jours réglés, le même seuil pour la comparaison et pour En francs.
3. **Pause active** — tranché le 29/10 : Résultats reste ouvert.
