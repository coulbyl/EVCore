# Chasseur d'accumulateur (cote 8 à 30) — ce que la mesure permet de promettre

_29/10/2026. Question posée à la validation de [08-resultats.md](../../refonte-ui/08-resultats.md) : le « Coupon long · cote 2,5–5 » n'est pas long (il gagne un jour sur trois à cote 3). On veut le renommer et en faire un chasseur d'accumulateur, cote combinée entre 8 et 30. Avant de le dessiner, mesurer ce qu'un tel produit donne._

## 0. En une phrase

À cote 8 à 15, un accumulateur de jambes courtes gagne **environ un jour sur 10 à 12** avec des séries perdantes de **3 à 6 semaines** ; à cote 15 à 30, **un jour sur 15 à 40** avec des séries de **4 à 8 semaines**. Aucune façon d'empiler les jambes ne change l'arithmétique : la fréquence est celle de la cote, moins la marge de chaque jambe. On peut le vendre honnêtement comme un billet de loterie à 1 chance sur 10, jamais comme un produit qui « gagne ».

## 1. Protocole

- **Données** : l'espace d'opportunités réglé du compositeur (`packages/backtest-core/reports/market-cells/settled-picks.csv`), 2026-07-01 → 2026-10-10, 102 journées, dernière analyse d'avant coup d'envoi, réglé sur le score. Marchés principaux seulement (1X2, double chance, plus/moins, les deux marquent, totaux d'équipe, nul remboursé) : ce sont les moins chers chez 1xBet (7 à 10 %) ; les marchés exotiques coûtent 14 à 21 % et multiplieraient la perte à chaque jambe.
- **Composition** : aucune probabilité du moteur, aucun coût appris. Par jour, une jambe par match (la plus courte de la bande), **les plus courtes d'abord**, au plus 2 par championnat, jusqu'à ce que la cote combinée atteigne la cible ; refus si elle dépasse le plafond ou le nombre maximal de jambes.
- **Mesure** : jours composés, jours gagnés avec intervalle à 95 %, « 1 fois sur N » réalisé contre « 1 fois sur N » dit par la cote (moyenne de 1/cote, marge comprise), pire série de jours perdus, cote et nombre de jambes moyens. Le rendu à mise fixe est donné mais ne conclut rien : à 100 jours et 2 à 11 gagnants, son erreur type dépasse 30 points.
- Script et sortie brute : [scripts/accumulateur/](scripts/accumulateur/).

## 2. Résultats

| Jambes | Cible | Jours | Gagnés | 1 fois sur… | …la cote disait | Pire série | Cote | Jambes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,20–1,50 | 8–15 | 64 | 6 (9 % ± 7) | 11 | 9 | 26 j | 9,0 | 11,6 |
| 1,30–1,60 | 8–15 | 82 | 7 (9 % ± 6) | 12 | 9 | 27 j | 8,6 | 8,0 |
| **1,40–1,80** | **8–15** | **92** | **8 (9 % ± 6)** | **12** | **10** | **22 j** | **10,3** | **6,8** |
| 1,50–2,00 | 8–15 | 96 | 11 (11 % ± 6) | 9 | 11 | 43 j | 10,9 | 5,8 |
| 1,80–3,00 (2 à 4 jambes) | 8–15 | 97 | 10 (10 % ± 6) | 10 | 11 | 18 j | 10,7 | 4,0 |
| 1,20–1,50 | 15–30 | 11 | 0 | — | 17 | 11 j | 16,8 | 13,8 |
| 1,30–1,60 | 15–30 | 67 | 2 (3 % ± 4) | 34 | 18 | 25 j | 18,0 | 10,7 |
| 1,40–1,80 | 15–30 | 84 | 2 (2 % ± 3) | 42 | 19 | 54 j | 19,0 | 8,5 |
| 1,50–2,00 | 15–30 | 90 | 6 (7 % ± 5) | 15 | 18 | 49 j | 18,1 | 6,9 |
| 1,80–3,00 | 15–30 | 0 | — | — | — | — | — | — |

Avec une jambe par championnat au lieu de deux : 1,30–1,60 → 6 gagnés sur 61 (1 sur 10, pire série 16 j) ; 1,40–1,80 → 2 sur 73 (1 sur 37, pire série 27 j). Les deux sont dans l'intervalle des lignes ci-dessus : la règle par championnat ne change rien de mesurable.

Rappel, même protocole, même période : jambes 1,20–1,50 à cible 1,3–1,6 → 57 jours gagnés sur 100 (pire série 5 j) ; à cible 2–3 → 42 sur 96 (pire série 9 j).

## 3. Lecture

1. **La fréquence suit la cote, pas la composition.** À cible 8–15 toutes les variantes gagnent 9 à 11 % des jours, et la cote « disait » 9 à 11 %. À 15–30, 2 à 7 % pour 5 à 6 % annoncés. Les écarts entre lignes sont dans le bruit (± 6 points). On ne trouvera pas une manière d'empiler qui gagne plus souvent que `(1 − marge)^jambes / cote`.
2. **Le plafond 30 n'existe pas en pratique.** Une cible 15–30 avec des jambes courtes demande 9 à 14 jambes, et le produit gagne un jour sur 15 à 40 avec des séries de 25 à 54 jours. C'est un produit qui perd 7 semaines de suite au moins une fois par saison.
3. **Les jambes à 1,40–1,80 sont le bon compromis** : 7 jambes, présent 92 jours sur 102, pire série 22 jours, et c'est la bande que 1xBet admet dans ses bonus de combiné (chaque cote ≥ 1,40, 3 matchs au moins, [05](../../refonte-ui/05-etude-cotes-courtes.md) § 1). Les jambes à 1,20–1,35 font 12 à 14 jambes pour la même cote : plus de marge payée, et un combiné de 12 matchs ne tient pas sur un écran.
4. **La pire série est le chiffre à montrer.** Un joueur qui suit ce produit tous les jours verra 3 à 6 semaines sans un gain. Le jackpot SportPesa (13 à 17 matchs, 0,7 à 0,9 % de tickets gagnants) est joué par 30 % des parieurs kenyans : la demande pour ce format existe, à condition de ne pas le confondre avec un produit qui gagne.
5. **Le coupon prix 5–15 actuel confirme** : 37 jours publiés, 5 gagnés (1 sur 7), 2 jambes à 2,4 ; sa série en cours est de 3 jours, sa pire de 11. C'est la ligne « 1,80–3,00 » du tableau, un cran plus court.

## 4. Ce que ça change pour le produit

- **Le « Coupon long · cote 2,5–5 » disparaît** (classe `LONG`, source `ENGINE`) : il ne tient ni la promesse « long » ni une place dans l'échelle (le Coupon cote 2 et le Combiné couvrent 1,4 à 3).
- **Le coupon prix 5–15** (classe `UNIQUE`, source `PRICE_COMPOSER`, plus affiché depuis le 18/10) **disparaît aussi** : le chasseur d'accumulateur le remplace sur la même bande, avec des jambes que le joueur reconnaît.
- **Le chasseur d'accumulateur** : jambes de 1,40 à 1,80 chez 1xBet, marchés principaux, une par match, au plus 2 par championnat, les plus courtes d'abord, **cible 8, plafond 15**, 10 jambes au plus. Pas de probabilité du moteur dans le choix : le prix et le coût mesuré du marché, comme le compositeur. Sa fréquence affichée : « Gagne environ 1 jour sur 10 », et sous le nom : « jusqu'à 4 semaines sans gain ». Sa feuille et son image sont celles de [07](../../refonte-ui/07-verifie-ton-ticket.md) § 5 : c'est le produit fait pour WhatsApp.
- **Le nom** : « Chasseur Accumulateur » est le nom de famille ; le nom montré reste à choisir (« Gros combiné », « Accu du jour »…). Il ne doit contenir ni « sûr », ni « gagnant », ni le montant.
- **La bande 15–30 n'est pas retenue** : un jour sur 30 et des séries de deux mois ne se vendent pas comme un produit quotidien. Si le joueur la veut, « Vérifie ton ticket » lui dit ses chances.

## 5. Limites

- Cotes d'analyse (référence Bet365/Pinnacle), pas 1xBet : 1xBet est 2 à 5 % dessous par jambe ([COTES-JOUABLES](../2026-10-18/COTES-JOUABLES.md)), soit 15 à 30 % de cote combinée en moins sur 7 jambes. **Composer sur le prix 1xBet**, comme les autres produits, et viser la cible sur ce prix.
- 102 journées, 8 gagnants : l'intervalle est de ± 6 points sur la fréquence. L'ordre de grandeur (1 sur 10 à 1 sur 12) est sûr, le chiffre exact ne l'est pas. Le produit se mesure en direct dès son premier jour, comme les autres chasseurs.
- Le choix « les plus courtes d'abord » est le plus simple, pas le meilleur : avec ML v2 (grille de marché) on pourra classer par coût réel plutôt que par cote. Ça ne changera pas la fréquence, seulement la marge payée.

## 6. Un accumulateur « intelligent » ? Ce que vaut chaque source de jambes (ajout du 29/10, soir)

Proposition de l'utilisateur : bâtir l'accumulateur sur ce que l'IA propose, les chasseurs, les grosses cotes qu'on ignore (les BTTS en particulier), et quelques-unes de nos sélections avec précaution. Mesuré source par source, même espace réglé, plus les sélections du moteur (`channel_selection_deduped` depuis le 01/07) et le bilan de l'IA (lot 5). Script : [scripts/accumulateur/leg_sources.py](scripts/accumulateur/leg_sources.py).

**Ce que coûte chaque jambe au prix du marché** (réalisé contre ce que la cote dit, jambes réglées ≥ 2 000 par case) :

| Source | Bande | n | La cote dit | Réalisé | Rendu |
| --- | --- | ---: | ---: | ---: | ---: |
| 1X2 outsider ou nul | 3–4 | 4 836 | 28,8 % | 27,5 % | −4,4 % |
| 1X2 outsider | 4–6 | 2 670 | 21,6 % | 20,8 % | −3,8 % |
| Plus/moins | 1,8–2,2 | 4 204 | 50,5 % | 48,5 % | −3,8 % |
| Plus/moins | 2,2–3 | 4 917 | 39,4 % | 36,8 % | −6,8 % |
| **BTTS** | 1,5–1,8 | 3 110 | 61,3 % | 56,0 % | **−8,7 %** |
| **BTTS** | 1,8–2,2 | 3 792 | 51,9 % | 48,5 % | **−6,3 %** |
| Total d'équipe | 3–4 | 2 850 | 29,1 % | 26,1 % | −10,4 % |
| Mi-temps/fin de match | 4–6 | 8 361 | 20,8 % | 18,3 % | −12,1 % |
| Résultat + buts | 6–12 | 25 063 | 12,3 % | 9,5 % | −24,0 % |

**Ce que valent nos propres choix** (sélections du moteur, canaux affichés, 01/07 → 29/10) :

| Bande | n | Annoncé par le moteur | La cote dit | Réalisé | Rendu |
| --- | ---: | ---: | ---: | ---: | ---: |
| < 1,45 | 13 415 | 75,9 % | 79,3 % | 76,8 % | −3,1 % |
| 1,45–1,80 | 8 269 | 65,2 % | 62,4 % | 59,5 % | −4,8 % |
| 1,80–2,50 | 7 872 | 53,5 % | 48,8 % | 46,0 % | −5,5 % |
| 2,50–4 | 9 735 | 34,0 % | 32,1 % | 29,4 % | −8,5 % |
| 4 et plus | 15 146 | 18,3 % | 15,3 % | 12,6 % | **−18,8 %** |

L'IA (v4, 207 avis réglés, lot 5) : 65,7 % réalisés pour 63,7 % annoncés, toutes cotes ≤ 1,80, pas mieux que le prix.

**Lecture**

1. **Les BTTS ne sont pas « intéressants »** : c'est le marché principal le plus cher (6 à 9 % par jambe), deux fois le prix d'un nul ou d'un outsider 1X2 (4 %) ou d'un plus/moins (4 %). Une cote de 1,90 paraît généreuse ; elle réalise 48,5 % pour 51,9 % affichés.
2. **Les grosses cotes qu'on ignore valent le prix du marché, pas le nôtre.** Un outsider 1X2 à 4–6 réalise 20,8 % pour 21,6 % dit par la cote (−3,8 %). Les mêmes cotes **choisies par le moteur** réalisent 12,6 % pour 15,3 % (−18,8 %) : au-dessus de 1,80, notre choix fait pire que prendre le marché au hasard, et de plus en plus avec la cote. « Avec précaution » veut donc dire : nos sélections ≤ 1,80 seulement, où elles valent le marché, et là elles n'apportent rien qu'une jambe prise au prix n'apporte déjà.
3. **L'IA fournit des jambes courtes calibrées** : utilisables, équivalentes à une jambe 1,40–1,80 prise au prix. Pas de gain de fréquence.
4. **Ce que l'intelligence achète, c'est moins de jambes et moins de marge, pas plus de jours gagnés.** Rejeu avec 3 jambes de 2,0 à 4,0 prises dans les marchés des chasseurs (nul, outsider, BTTS, plus/moins), les moins chères d'abord, au plus 2 par championnat, cible 8–15 :

| Composition | Jours | Gagnés | 1 fois sur… | …la cote disait | Pire série | Jambes | Rendu |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 7 jambes 1,40–1,80 (§ 2) | 92 | 8 | 12 | 10 | 22 j | 6,8 | −19 % |
| 4 jambes 1,8–3,0, marchés des chasseurs | 97 | 13 | 7,5 | 11 | 20 j | 4,0 | +43 % |
| **3 jambes 2,0–4,0, marchés des chasseurs** | **100** | **12** | **8** | **8** | **16 j** | **3,0** | **−4 %** |
| 4 jambes 2,0–4,0, cible 15–30 | 97 | 5 | 19 | 16 | 29 j | 4,0 | −16 % |

Même fréquence (1 jour sur 8 à 12, les intervalles se recouvrent), mais la pire série passe de 22 à 16 jours, et la marge payée de 7 jambes à 3. Le rendu de +43 % est du bruit (13 gagnants) ; le −4 % de la ligne à 3 jambes est ce que l'arithmétique prévoit (3 × 4 % de marge, moins le biais favori).

## 7. Décision proposée (remplace § 4)

**Accumulateur de chasseurs** : 3 jambes (4 au plus) de cote 2,0 à 4,0 prises dans les viviers des chasseurs et des marchés les moins chers (nul, outsider 1X2, plus/moins, corners quand le championnat est fiable ; BTTS admis mais classé après, il coûte le double), **classées par le coût mesuré du marché**, jamais par la probabilité du moteur ni par « ce qu'on croit », au plus 2 par championnat, cible 8, plafond 15. Les avis de l'IA et nos sélections ≤ 1,80 peuvent entrer comme jambe d'appoint pour atteindre la cible, jamais au-dessus de 1,80. Rien au-dessus de 1,80 venant du moteur.

Promesse affichée : « Gagne environ 1 jour sur 10 », « jusqu'à 3 semaines sans gain ». Le coupon ressemble à ce que le joueur joue (un nul, un outsider, un BTTS), avec trois jambes au lieu de huit. À rejouer avec les vraies règles des chasseurs (corners compris) avant de coder, sur le prix 1xBet.

## 8. « Plus de jours heureux que de pertes » : à quelle cote c'est possible (ajout du 29/10, nuit)

Question de l'utilisateur : ce chasseur fera-t-il plus de jours gagnés que de jours perdus ? Pourquoi tant de pertes, et y a-t-il mieux ? Mesuré sur les 102 journées, jambes les moins chères d'abord, mise fixe d'une unité par jour. Script : [scripts/accumulateur/happy_frontier.py](scripts/accumulateur/happy_frontier.py).

| Produit | Cote | Jours gagnés | Semaines dans le vert | Mois dans le vert |
| --- | ---: | ---: | ---: | ---: |
| Favori (1 jambe) | 1,2 | **84 sur 102 (82 %)** | 9 sur 15 | 2 sur 4 |
| Combiné court | 1,4 | **56 sur 100 (56 %)** | 6 sur 15 | 1 sur 4 |
| Cote 2 | 2,1 | 41 sur 97 (42 %) | 7 sur 15 | 2 sur 4 |
| Cote 3–5 | 3,3 | 28 sur 101 (28 %) | 7 sur 15 | 0 sur 4 |
| Cote 5–8 | 5,9 | 17 sur 100 (17 %) | 6 sur 15 | 3 sur 4 |
| **Accumulateur 8–15** (3 jambes) | 8,1 | 14 sur 100 (14 %) | **11 sur 15** | 2 sur 4 |
| Accumulateur 15–30 | 16,3 | 6 sur 97 (6 %) | 6 sur 15 | 3 sur 4 |

**Pourquoi il y a tant de pertes.** Il n'y a pas de défaut à corriger : chaque jambe gagne un peu moins souvent que sa cote ne le dit (la marge, § 6), et c'est tout. Trois jambes à cote 2 gagnent chacune un jour sur deux ; les trois ensemble, un jour sur huit. La ligne « jours gagnés » du tableau suit `1 / cote` à la marge près, quelle que soit la composition, et nos choix ne font pas mieux que le prix (mesuré encore aujourd'hui : au-dessus de 1,80, ils font pire). Un coupon à cote 8 qui gagnerait plus d'un jour sur huit ferait perdre de l'argent au bookmaker ; aucun bookmaker ne le cote.

**Ce que ça impose.**

1. **Plus de jours gagnés que perdus n'existe qu'en dessous de cote 1,8.** C'est le Favori (4 jours sur 5) et le Combiné (plus d'un jour sur deux). Ces produits existent déjà et répondent exactement à l'attente ; aucun accumulateur ne peut y répondre, pour personne.
2. **À cote 8–15, l'unité heureuse est la semaine.** Un gain à cote 8 couvre sept jours de mise : il suffit d'un gain par semaine, et avec un jour sur huit, la semaine en compte au moins un **6 fois sur 10** (61 % par le calcul, 11 sur 15 mesurées). C'est la seule bande où la semaine finit dans le vert plus souvent que dans le rouge : en dessous, les gains ne couvrent pas la semaine ; au-dessus (15–30), un gain sur 16 jours ne vient qu'une semaine sur trois.
3. **Le mois reste perdant en moyenne** : 3 jambes à 4 % de marge, environ −10 % sur un mois de mise fixe. Les « mois positifs » du tableau (2 sur 4) sont du bruit à 14 gagnants.

**Décision proposée (complète § 7).** L'accumulateur de chasseurs reste à 8–15 et se vend **à la semaine** : « Une semaine sur deux au moins finit dans le vert · un gain couvre la semaine », avec la grille de Résultats lue par semaine (7 pastilles par ligne, la semaine colorée en vert dès un gain). Il ne promet jamais des jours : à l'échelle du jour, le produit heureux est le Favori, et c'est lui le héros. Si l'attente est bien « plus de jours gagnés que perdus », il faut renoncer à l'accumulateur, pas le réparer.

## 9. Et si l'accumulateur ne jouait que le week-end ? (ajout du 29/10, nuit)

Proposition de l'utilisateur : samedi et dimanche seulement, il y a assez de matchs. Deux rejeux : les 102 journées de 2026 (15 week-ends, trop peu), puis **2023 → 2026 sur le dernier prix Pinnacle 1X2 d'avant coup d'envoi** (38 695 matchs, 194 week-ends ; [pinnacle_1x2.sql](scripts/accumulateur/pinnacle_1x2.sql), [weekend_long.py](scripts/accumulateur/weekend_long.py)). Vivier médian : 71 matchs le samedi, 58 le dimanche, 9 à 10 en semaine.

| Accumulateur 8–15, 3 jambes 2–4 | Coupons | Gagnés | La cote disait | Pire série | Semaines avec un gain |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tous les jours | 1 070 | 10,6 % ± 1,8 | 10,5 % | 43 | 44 % |
| **Samedi + dimanche** | 381 | 12,6 % ± 3,3 | 11,4 % | 27 (≈ 3 mois) | **22 %** |
| Lundi à vendredi | 689 | 9,4 % ± 2,2 | 10,0 % | 42 | 32 % |

Même chose pour les 7 jambes courtes (8,7 % le week-end, 8,1 % en semaine) et pour 15–30 (3,8 % partout, pire série 47 week-ends).

**Lecture.** Le week-end ne change pas la fréquence : un coupon à cote 9 gagne un sur huit le samedi comme le mardi, parce que la fréquence est celle de la cote. Ce qu'il change, c'est le nombre de tirs par semaine : deux au lieu de sept. Donc **moins de pertes comptées, mais autant de pertes pour chaque gain**, et la semaine heureuse devient rare : **une sur cinq** au lieu d'une sur deux, avec des séries de trois mois sans gain. Le gros vivier du week-end aide un peu les produits courts (Cote 2 : 47 % le week-end contre 39 % en semaine ; Favori 82 % contre 79 %), parce qu'on choisit mieux parmi 70 matchs que parmi 10 ; il n'aide pas un produit dont la cote fixe la fréquence.

(Le 27,6 % mesuré sur les 29 coupons de week-end de 2026 était du bruit : sur 381 coupons c'est 12,6 %.)

**Conclusion.** Réduire les jours ne rapproche pas de « plus de jours heureux que de pertes » ; ça éloigne la semaine heureuse. La seule chose que le week-end apporte vraiment est un meilleur choix pour les produits courts. Si l'on veut un produit du week-end, c'est un **Cote 2 du week-end** (un jour sur deux, pire série 6) ou le Favori, pas l'accumulateur.

## 10. Ce qui en découle (tranché le 29/10, nuit)

1. **L'accumulateur se vend à la semaine.** Cote 8–15, 3 jambes de 2,0 à 4,0 des viviers chasseurs et marchés les moins chers, classées par le coût du marché, au plus 2 par championnat, rien du moteur au-dessus de 1,80. Carte : « Une semaine sur deux finit dans le vert · un gain couvre la semaine » ; grille Résultats par semaine. Le Coupon long 2,5–5 et le coupon prix 5–15 disparaissent. Nom montré à choisir.
2. **Au-dessus de 1,80, la chance affichée est celle du marché sans marge**, pas celle du moteur (annoncé 34 % / réalisé 29 % à 2,5–4 ; 18 % / 13 % à 4 et plus). Aucun produit ne prend une jambe du moteur au-dessus de 1,80. À reporter dans [06-matchs.md](../../refonte-ui/06-matchs.md) § 2.
3. **Le Chasseur BTTS reste.** Il gagne aussi souvent qu'un plus/moins à la même cote (48 jours sur 100 à 1,90) ; il coûte seulement 3 points de plus en argent sur la durée (6 à 9 % contre 4 %). Il dit son coût, « 1xBet prend 9 % sur ce pari ». Pas de remplacement.
4. **Pas de produit du week-end.** Le gros vivier aide un peu les produits courts (Cote 2 : 47 % contre 39 %, à la limite du bruit) : relecture au 10/12 sur les vrais coupons.
