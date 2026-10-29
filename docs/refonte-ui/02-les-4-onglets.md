# Refonte UI — 2. Les 4 onglets du joueur

_29/10/2026. Suite de [01-ce-qu-on-montre.md](01-ce-qu-on-montre.md). Décisions prises le 29/10 :_

- 4 onglets : **Aujourd'hui · Matchs · Résultats · Moi** ;
- pas de preuve sociale (« N joueurs suivent ») ;
- le coupon héros sera choisi **par la mesure** sur la sauvegarde de prod du 29/10 (§ 6) ;
- les filtres sont simplifiés (§ 5) ;
- le bouton Eva est retiré ;
- le **suivi de mise** (solde, dépôts, retraits, mise par unité) est retiré : les joueurs n'en ont pas besoin ;
- **un seul geste sur un coupon : « Suivre »**. La déclaration avec mise (« Je l'ai joué », le ticket composé à la main) est retirée ;
- à la place du solde : **« Vérifie ton ticket »** (§ 2 bis) et **« En francs »** dans Résultats (§ 3).

_Toujours en blocs, sans style._

## 0. Ce qui disparaît partout

**En-tête** : il ne reste que le logo et la cloche.
- Le solde déclaratif disparaît avec le suivi de mise.
- La recherche et les notes sont retirées.
- L'avatar devient l'onglet Moi.

**Retirés**
- La bulle **Eva**.
- Le **guide** pas à pas : avec 4 onglets clairs, il n'a plus lieu d'être. À rediscuter s'il manque à la mesure.
- Les étiquettes de source (« Choisi sur les cotes », « Analyse IA »).
- Les capitales espacées et les cartes dans les cartes.

**Ce qui reste fixe** : une ligne discrète en pied d'écran, « 18+ · Parier comporte des risques de perte ».

## 1. Aujourd'hui — « Qu'est-ce que je joue ? »

**Premier niveau, de haut en bas**

1. **Hier**, une ligne : `Favori ✓ · Combiné ✓ · Cote 2 ✗`. Un toucher ouvre les résultats d'hier. Le lundi, la ligne devient « Ta semaine ».
2. **Le coupon héros** : logos, équipes, heure, le pari, la cote 1xBet, « 8 sur 10 » avec ses 10 points, la forme du produit (10 pastilles), et un bouton, « Suivre ».
3. **Les autres produits**, en lignes : nom, nombre de matchs, cote, « 6 sur 10 ».
4. **Les produits absents**, en gris : « Pas de Chasseur Score aujourd'hui ». La raison s'affiche au toucher.
5. **Mes coupons en cours**, s'il y en a : « 2 en cours · prochain match à 19:00 », qui mène à Moi.

**Au toucher sur un coupon**
- Les jambes avec logos, le pari et la cote.
- Un fait par jambe (le pourquoi).
- La forme sur 30 jours, la pire série, la marge 1xBet.
- « Suivre ».

**Sort de l'écran**
- Les annonces : elles passent par la cloche. Une annonce importante peut s'afficher une fois, refermable.
- « Notre sélection » : elle va dans Matchs.
- Le point de la semaine : il devient la ligne Hier du lundi.

**Budget** : aucun titre, aucun paragraphe, 3 chiffres au plus par carte.

## 2. Matchs — « Et les autres matchs ? »

Il remplace **Décisions, Avis IA et la fiche de match**.

**Premier niveau**

- Trois puces de jour : **Hier · Aujourd'hui · Demain**.
- Une liste de matchs regroupés par heure. Chaque ligne montre :
  - les logos et les équipes ;
  - l'heure, ou le score une fois joué ;
  - **une seule pastille de lecture** : « Victoire Arsenal · 7 sur 10 », ou « Écarté » en gris ;
  - un petit signe quand l'avis IA n'est pas d'accord.

**Au toucher : la fiche du match**
- **Notre lecture** : un pari, sa cote, sa fréquence, un fait.
- **L'avis IA** : d'accord ou pas, et son pari s'il en propose un autre.
- Les autres lectures, repliées.
- La forme des deux équipes (5 pastilles chacune).
- Si le match est écarté : la raison, en une ligne.

**Sort de l'écran**
- Le menu « canal », les badges de calibration, « Voir les 5 autres lectures » au premier niveau.
- « Pourquoi ? Voir la fiche du match » : toute la ligne s'ouvre au toucher.

## 2 bis. « Vérifie ton ticket » — « Mon combiné, il a ses chances ? »

Il remplace le solde et le ticket déclaré. Il répond à la vraie douleur du joueur : il joue des combinés de 6 à 10 matchs et les perd presque tous sans savoir pourquoi.

**Où** : dans Matchs. Toucher un pari dans la fiche d'un match l'ajoute à « Mon ticket ». Une barre basse apparaît alors : `4 matchs · environ 1 fois sur 9 ›`.

**Ce qu'il montre, en une image**
- Les jambes : logos, pari, cote 1xBet.
- La cote totale.
- **Ses chances, en points** : « environ **1 fois sur 9** », avec 9 points dont un seul plein.
- **Ce que 1xBet garde** : « Sur la durée, 1xBet garde environ 23 % de ta mise sur ce ticket ».
- En une ligne, pour comparer : « Notre coupon du jour : 8 sur 10 ».
- Un bouton **Partager mes chances** (image pour WhatsApp) et un bouton Vider.

**Règles**
- Les chances sont le produit des fréquences du marché sans marge (l'hypothèse d'indépendance des coupons).
- Le gardé par 1xBet vaut 1 moins le produit, sur toutes les jambes, de la fréquence du marché multipliée par la cote 1xBet.
- Deux paris d'un même match ne vont pas ensemble : ils sont corrélés, et on le dit.
- Seuls les paris cotés chez 1xBet entrent.
- Jamais « Joue » ni « Place » : le seul verbe est « Vérifie ». Aucun lien vers un bookmaker, aucune mise saisie.

## 3. Résultats — « Est-ce que je peux vous croire ? »

Il remplace **Mesures historiques**.

**Premier niveau** : une ligne par produit, l'Avis IA compris. Chaque ligne montre :
- le nom ;
- **la forme sur 10 jours** en pastilles ;
- « 19 jours gagnés sur 24 », avec la période en petit.

**Au toucher sur un produit**
- La grille de forme sur 30 ou 90 jours.
- Réalisé contre annoncé, en une ligne datée et comptée.
- La pire série.
- Le résultat à mise fixe.

- **En francs** : « À 1 000 F par jour, du 13/10 au 29/10, sur 14 jours réglés : misé 14 000 F, rendu 13 600 F ». La perte s'affiche avec le même poids qu'un gain, toujours datée et comptée.

**Filtre** : la période seule, 30 j · 90 j · Tout.

## 4. Moi — « Et moi, où j'en suis ? »

Il regroupe **Mes coupons, Messages, Notifications, Compte, Formation et Glossaire**. Le suivi de mise disparaît (solde, dépôts, retraits, onglet « Devise et mise »).

**Premier niveau**

1. **Mon bilan** : « 7 gagnés · 4 perdus » sur mes coupons, et la période en petit. S'il n'y a rien : « Suis ton premier coupon ».
2. **Mes coupons suivis** : En cours · Réglés (une bascule).
3. Une liste de lignes simples : Messages · Aide · Jeu responsable (pause) · Compte.

**Aide** : Formation et Glossaire y deviennent un index de fiches courtes. Le « ? » posé à côté d'un mot, ailleurs dans l'app, ouvre directement la bonne fiche.

## 5. Les filtres : une seule règle

**Aujourd'hui, c'est trop** : un panneau « Filtres » à listes déroulantes (championnat, vue, canal), des filtres différents d'un écran à l'autre, et des choix qui changent le sens de l'écran sans qu'on le voie.

**La règle de la refonte**
- **Le jour** se choisit par trois puces visibles, Hier · Aujourd'hui · Demain, dans Matchs seulement. Aujourd'hui n'a pas de jour à choisir : c'est aujourd'hui. Le passé est dans Résultats.
- **Au plus une bascule par écran**, visible, jamais cachée dans un panneau :
  - Mes coupons : En cours · Réglés ;
  - Résultats : 30 j · 90 j · Tout ;
  - Matchs : « Voir les écartés », désactivé par défaut.
- **Aucune liste déroulante de filtre** côté joueur.
- **Le championnat** : pas de filtre. Une recherche d'équipe en haut de Matchs suffit. Un « mes championnats » viendra plus tard, avec le filtre de ligues réservé dans le compte.
- **Côté admin**, mêmes principes : une barre de recherche et au plus deux bascules visibles. Les filtres avancés passent dans une URL partageable, pas dans un panneau.

## 6. Le coupon héros : comment on le choisit

On le mesure sur la sauvegarde de prod du 29/10, sur quatre critères, dans cet ordre :

1. **Présence** : le héros doit exister presque tous les jours. On mesure le taux d'abstention par produit.
2. **Fiabilité** : jours gagnés sur jours joués, et pire série.
3. **Honnêteté** : réalisé contre annoncé ; un produit sur-promis ne peut pas être en vitrine.
4. **Intérêt des joueurs** : vues, suivis, coupons déclarés par produit.

Résultat dans [03-coupon-heros.md](03-coupon-heros.md).
