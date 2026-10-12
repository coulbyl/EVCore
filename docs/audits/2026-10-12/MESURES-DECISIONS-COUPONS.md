# Décisions et Coupons : ce qu'on montre, ce que ça vaut, ce qu'on rate

Mesures du 2026-10-12 sur le dump de production du 2026-10-10 (base locale),
vue `channel_selection_deduped` (une ligne par pari réel, analyses d'avant
coup d'envoi seulement) et vue `evaluated_pick` (tout ce que le moteur a
envisagé, réglé sur le score). Les erreurs types sont données quand elles
comptent ; aucune conclusion n'est tirée d'un ROI de coupon (CLAUDE.md).

## 1. Ce que l'écran Décisions montre

Volume quotidien, 2026-09-10 → 2026-10-10, canaux affichés (hors VALUE, SAFE,
VANTAGE et méta-canaux) :

| Mesure                            | Valeur |
| --------------------------------- | ------ |
| Matchs par jour                   | 54,7   |
| Sélections par jour               | 592    |
| Sélections par match (médiane)    | 11     |
| Part des sélections à cote > 1,80 | 61 %   |
| Part à cote < 1,50                | 25 %   |

Calibration par tranche de cote, 90 jours, tous canaux affichés :

| Cote      |      n | Annoncé | Réalisé | Ratio | Retour par jambe |
| --------- | -----: | ------: | ------: | ----: | ---------------: |
| < 1,20    |  2 038 |   0,831 |   0,883 |  1,06 |           −1,8 % |
| 1,20–1,35 |  3 581 |   0,760 |   0,761 |  1,00 |           −3,5 % |
| 1,35–1,50 |  3 195 |   0,707 |   0,683 |  0,97 |           −3,4 % |
| 1,50–1,80 |  5 813 |   0,649 |   0,582 |  0,90 |           −5,6 % |
| 1,80–2,20 |  4 564 |   0,573 |   0,484 |  0,84 |           −5,8 % |
| > 2,20    | 20 302 |   0,277 |   0,217 |  0,78 |          −13,1 % |

Lecture : sous 1,50 le moteur annonce juste et paie à peu près la marge.
Au-delà, il surestime de plus en plus, et la moitié de ce que l'écran affiche
(cote > 2,20) perd 13 % par jambe. Aucun canal ne fait exception à l'intérieur
d'une tranche (table par canal × tranche dans le journal de session) : on
coupe sur la cote, jamais sur le canal.

Ce que ça impose à l'écran, du point de vue d'un utilisateur lambda :

- **Une sélection par match**, choisie d'abord sous 1,50 sur un canal fiable
  pour la compétition ; les autres marchés restent repliés sous « Autres
  marchés analysés ». Avant : quatre sélections visibles plus « Voir 6 autres
  marchés », sans dire laquelle jouer. _Livré (match-card, `primaryPick`)._
- **« 85 % de chances » et « @1.27 »** à la place d'un pourcentage et d'un
  nombre nus. _Livré._
- Les sélections du jour de l'accueil gardent la bande 1,20–1,80 ; la tranche
  1,50–1,80 coûte 5,6 % contre 3,5 % en dessous. À resserrer à 1,50 si la
  mesure tient encore dans un mois (volume : 25 % des sélections).

## 2. Ce que l'écran Coupons montre

Depuis le 2026-09-25, un seul coupon par jour est publié : celui du
compositeur par le prix, cible 5–15, deux jambes (le générateur LLM est en
panne de clé depuis le 10-09). Sur 14 journées réglées : 3 gagnées, 11
perdues. L'utilisateur voit « ✗ Perdu » onze jours sur quatorze.

Ce n'est pas un défaut du compositeur, c'est l'arithmétique : la probabilité
de gagner une journée vaut au mieux 1 / cote combinée. À cote 6, un jour sur
six au mieux, quel que soit le modèle. Jambes du coupon long réglées depuis
septembre : 33 jambes à cote > 2,20, réalisé 0,455 contre 0,355 annoncé
(± 0,087) — rien d'anormal, et rien à en tirer à cette taille.

## 3. Ce qu'on rate : le profil de coupon qui gagne presque tous les jours

Simulation sur le vivier réel des canaux affichés (une sélection par match,
classées par cote croissante, du 2026-07-01 au 2026-10-10, ~100 jours), par
bande de cote des jambes et nombre de jambes :

| Jambes | Bande     | Jours |   Jours gagnants | Cote moy. | Retour / unité | Pire série |
| -----: | --------- | ----: | ---------------: | --------: | -------------: | ---------: |
|      1 | 1,15–1,35 |    98 | **85,7 %** ± 3,5 |      1,19 |          1,017 |        2 j |
|      1 | 1,20–1,50 |   100 | **90,0 %** ± 3,0 |      1,22 |          1,098 |        2 j |
|      2 | 1,20–1,50 |    98 |     73,5 % ± 4,5 |      1,51 |          1,116 |        3 j |
|      3 | 1,20–1,50 |    95 |     63,2 % ± 4,9 |      1,89 |          1,208 |        4 j |
|      2 | 1,35–1,60 |    97 |           55,7 % |      1,88 |          1,055 |          — |
|      2 | 1,50–1,80 |    98 |           40,8 % |      2,29 |          0,921 |          — |
|      2 | 1,80–2,30 |    98 |           29,6 % |      3,17 |          0,915 |          — |
|      3 | 1,80–2,30 |    95 |           17,9 % |      5,72 |          0,980 |          — |

Les retours au-dessus de 1 sur 100 jours sont dans le bruit (erreur type
0,07 à 0,09) : on retient « ne coûte pas plus que la marge », pas « gagne ».
Ce qui est robuste, c'est la colonne des jours gagnants : de 9 jours sur 10
à cote 1,2 à 1 jour sur 6 à cote 6.

Stabilité mois par mois du profil « 2 jambes 1,20–1,50 » : 75,9 / 73,3 / 69,0
/ 80,0 % de jours gagnants (juillet → octobre).

### Vérification prospective de la règle déjà validée

La règle « generator-v2 » (un pari par jour, le plus gros favori à domicile à
cote 1,10–1,35, `docs/audits/2026-09-15/GENERATOR.md`) avait été validée sur
731 jours (84,8 % de jours gagnants, ROI positif chaque année) avec la réserve
« une fenêtre prospective reste nécessaire ». Rejouée ici sur les cotes
d'analyse de `evaluated_pick` (celles que la production verrait) :

| Fenêtre                       |            Jours |      Jours gagnants | Cote moy. |    ROI | Pire série |
| ----------------------------- | ---------------: | ------------------: | --------: | -----: | ---------: |
| 2026-07-01 → 10-10            |               80 |          **80,0 %** |      1,19 | −5,3 % |        2 j |
| Prospectif, ≥ 2026-09-16      |               16 |          **81,3 %** |      1,18 | −4,3 % |          — |
| Juillet / août / sept. / oct. | 25 / 27 / 22 / 6 | 84 / 74 / 82 / 83 % |           |        |            |

Le ROI aux cotes d'analyse vaut la marge (−5 %) ; au meilleur prix il était
positif (+2 % sur 400 jours hors échantillon). La fréquence de gain, elle,
est la même partout. La réserve est levée.

Le compositeur par le prix rejoué sur les mêmes 82 jours avec des cibles
courtes (`backtest:composer`, cibles 1,3–1,6 et 1,5–2 ajoutées) refuse la
plupart des journées (cellules trop peu mesurées sous 1,30) et ne tient que
46 % de jours gagnants à cote 1,95 : il n'est pas l'outil du profil court. La
règle du favori l'est, et elle n'a besoin d'aucune calibration.

### Décision

Livré dans la même PR :

- **« Pari sûr du jour »** (classe `FAVOURITE`, source PRICE_COMPOSER, bande
  1,10–1,35, une jambe) généré chaque soir dans la même passe que le coupon
  long, affiché en premier sur l'accueil et sur Coupons avec sa fréquence
  mesurée en clair : « Gagne environ 4 jours sur 5 ».
- Le coupon 5–15 devient **« Coupon long »**, avec « Gagne environ 1 jour sur
  7 » écrit dessus ; « Proba » devient « Chances », sans couleur d'alerte.
- Sources renommées pour un lecteur non technicien : « Choisi sur les cotes »
  et « Analyse IA ».

Non livré, à mesurer d'abord : un coupon à deux jambes 1,20–1,50 (73 % de
jours gagnants, cote 1,5). Il n'a que 100 jours d'historique et une seule
fenêtre ; le favori en a 731 plus 80 prospectifs.

## 5. Un combiné sur « Notre sélection » (ajout du 2026-10-12, soir)

Question posée après la mise en ligne de la sélection mise en avant : peut-on
en faire des combinés qui rentrent le plus souvent possible ? Rejeu de la
règle de l'écran (une sélection par match, canal calibré sur la compétition
avec une calibration **glissante sur les 90 jours précédents**, cote sous
1,50), puis combinaison des jambes, une par championnat, sur 101 jours
(2026-07-01 → 10-10).

Les jambes mises en avant sont calibrées : paliers « fiable et court » et
« non peu fiable et court » réalisent 0,775 et 0,759 pour 0,78 annoncé
(ratio 0,99 / 0,97, n = 3 572). Les paliers suivants (cote ≥ 1,50) retombent
à 0,82–0,89 — la coupe à 1,50 est la bonne.

Combinés de k jambes, une par championnat, les moins chères d'abord
(colonne « floor » : cote minimale d'une jambe) :

| Jambes | Plancher | Jours |   Jours gagnants | Cote | Retour / unité | Pire série |
| -----: | -------: | ----: | ---------------: | ---: | -------------: | ---------: |
|      2 |        — |    98 | **84,7 %** ± 3,6 | 1,23 |          1,032 |        2 j |
|      3 |        — |    87 | **78,2 %** ± 4,4 | 1,39 |          1,048 |        3 j |
|      4 |        — |    78 |           62,8 % | 1,65 |          0,900 |        6 j |
|      2 |     1,15 |    98 |           77,6 % | 1,49 |          1,155 |        2 j |
|      3 |     1,15 |    84 |           57,1 % | 1,81 |          1,011 |        6 j |
|      3 |     1,20 |    82 |           50,0 % | 1,94 |          0,965 |        4 j |
|      4 |     1,20 |    73 |           32,9 % | 2,46 |          0,779 |        9 j |

Classées par probabilité du moteur plutôt que par cote, les mêmes trois
jambes gagnent 66,7 % des jours avec une série de 8 : le prix classe mieux
que le moteur, ici comme partout. Viser une cote combinée (2,0 / 2,5 / 3,0)
avec les mêmes jambes donne 33 / 24 / 13 % de jours gagnants : chaque +0,2
de cote coûte environ 15 points de jours gagnants, c'est l'arithmétique.

Stabilité mois par mois de la règle retenue (3 jambes, sans plancher) :
62 / 73 / 96 / 80 % de juillet à octobre, jambes réalisées 0,85 pour 0,83
annoncé.

### Pourquoi le coupon long gagne un jour sur sept, et ce qu'on en fait

Ses 35 jambes réglées sont des nuls à la mi-temps à cote 2,4 (réalisé 0,56
pour 0,39 annoncé — rien d'anormal) : deux jambes à une chance sur deux
font une chance sur quatre au mieux, et la cible 5–15 en demande davantage.
Aucun réglage ne le fait gagner souvent sans baisser sa cible, et à cible
basse le compositeur par le prix fait moins bien que les sélections du
moteur (16 % à cible 2–3 contre 78 % ici). Décision : il reste généré et
visible sur la page Coupons avec « gagne environ 1 jour sur 7 » écrit
dessus, mais il quitte la tête de l'accueil, où le pari sûr et le combiné
prennent la place.

### Décision

Livré : **« Combiné du jour · 3 sélections »** (source `ENGINE`, classe
`COMBO`), généré chaque soir dans la même passe que les deux autres, sur le
vivier et la calibration de l'écran Décisions, affiché avec « Gagne environ
3 jours sur 4 ». Il s'abstient quand moins de trois sélections calibrées et
courtes existent (14 jours sur 101 dans le rejeu).

## 4. Critique UX, du point de vue d'un utilisateur lambda

Ce qu'un nouvel utilisateur ne pouvait pas comprendre avant cette PR :

1. **Coupons** : « Coupon du jour · cote 5–15 », « Performance en cours de
   mesure », étiquettes « Prix » / « Analyse », « PROBA 15 % » en rouge et
   une barre rouge. Il lit : un produit cassé. Corrigé : « Pari sûr du jour »
   en premier, « Coupon long · gagne environ 1 jour sur 7 », « Chances »
   neutre, sources en français courant.
2. **Décisions** : onze sélections par match, quatre visibles, un pourcentage
   et un nombre sans libellé, des sélections « peu fiables » présentées comme
   les autres. Corrigé : une sélection mise en avant (« Notre sélection »),
   le reste replié, « 85 % de chances », « @1.27 », pastille de confiance.
3. **Mes coupons** : « Aucun coupon ne correspond… élargir le filtre » pour
   quelqu'un qui n'a jamais joué, trois tuiles à zéro. Corrigé : état vide
   guidé vers le coupon du jour, tuiles seulement à partir du premier coupon,
   bouton « Afficher les 90 derniers jours » quand la période est vide.
4. **En-tête** : « 0 F » en permanence. Corrigé : l'icône seule tant que le
   portefeuille est à zéro.

Reste à faire, hors de cette PR : la liste des ligues à l'onboarding (ordre
par volume, pas alphabétique), les finitions P2 de la revue du 2026-10-11, et
la bande 1,50–1,80 des sélections du jour à réexaminer dans un mois.

## 6. Historique vivant par produit, et bande des sélections du jour (ajout du 2026-10-12, nuit)

- Chaque carte de coupon porte désormais ce que le produit a **réellement**
  fait sur les 30 derniers jours (« 5 jours gagnés sur 6 ») à la place de la
  fréquence annoncée, dès cinq jours réglés ; en dessous, l'annonce reste.
  Endpoint `GET /coupons/track-record?days=30`, une ligne par produit
  (classe + source — le coupon long existe sous les deux générateurs).
  Jours gagnés et jours réglés seulement : à ces volumes un ROI n'a aucune
  puissance, une fréquence se lit.
- Les sélections du jour de l'accueil passent de 1,20–1,80 à 1,20–1,65 :
  sur 90 jours, les canaux fiables réalisent 1,02 / 0,93 / 0,95 de l'annoncé
  sous 1,35 / 1,50 / 1,65, puis 0,83 entre 1,65 et 1,80 (n = 107).
