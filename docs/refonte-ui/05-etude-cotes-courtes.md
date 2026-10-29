# Refonte UI — 5. Les cotes courtes accrochent-elles les parieurs ?

_29/10/2026. Question posée à la validation de [04](04-aujourdhui-en-detail.md) : nos produits vitrines sont à 1,22 (Favori) et 1,40 (Combiné). Est-ce que ça attire un parieur d'Abidjan ? Lecture du web, puis de nos propres chiffres, puis ce qu'on en fait._

## 1. Ce que dit le web

**Aucune étude sérieuse ne mesure directement la préférence de cote des parieurs ivoiriens.** Ce qu'on trouve est indirect, mais tout pointe dans le même sens.

| Source | Ce qu'elle établit | Poids |
| --- | --- | --- |
| GeoPoll, _Betting in Africa 2026_ (2 866 répondants, Ghana, Kenya, Nigeria, Afrique du Sud, Tanzanie, Ouganda, juin-juillet 2026) | 58 % des parieurs dépensent **moins de 10 $ par mois** ; 55 % jouent au moins chaque semaine, 28 % chaque jour. Le football fait 67 % du jeu. Rien sur le type de pari ni sur les cotes. | Enquête, solide sur les montants, muette sur les cotes |
| Makinde et al., arXiv 2604.08251 (2026), 5 467 tickets de 3 influenceurs nigérians sur Stake, 4,8 M$ misés | **27 % des tickets à cote < 10, 50 % entre 10 et 100, 23 % au-dessus de 100.** Taux de réussite global 10,4 %. Les influenceurs perdent 25 %, un suiveur à mise fixe 38 %. Les cotes > 100 perdent 74 % de la mise. | Mesure réelle, mais de l'offre des influenceurs, pas de la demande |
| Abdulkadir, _Gamblers Learn from Experience_ (arXiv 2011.00432), 58 215 parieurs kenyans suivis 119 semaines | **30 % des parieurs jouent le jackpot SportPesa** (13 ou 17 matchs, 0,7 à 0,9 % de tickets gagnants). Dépense moyenne 482 KSH par semaine. Les parieurs réagissent à leurs résultats de la semaine passée, dans les deux sens, à parts égales. | Mesure réelle à grande échelle |
| Conditions de bonus 1xBet (Nigeria, Brésil, Bangladesh) | Le bonus de bienvenue se libère sur des **combinés de 3 matchs au moins, chaque cote ≥ 1,40**. Les cotes sous 1,40 ne comptent pas. | L'opérateur lui-même range nos cotes dans « trop sûr pour compter » |
| Chaînes Telegram nigérianes (« 2 odds daily », « banker ») | Il existe une demande pour des tickets « sûrs », mais **le plancher mental d'un ticket sûr est 2,0**, pas 1,25. | Commercial, mais révélateur du vocabulaire |
| Snowberg & Wolfers (2010), biais favori-outsider | Les parieurs **sur-jouent les outsiders et sous-jouent les favoris**, par mauvaise perception des probabilités (théorie des perspectives), pas par goût du risque. Les favoris perdent moins sur la durée. | Académique, courses hippiques US |
| Guides ivoiriens (bettors-ci, mercatolive, pari-gagnant) | Le combiné « occupe une place importante dans les habitudes ivoiriennes », « mise modeste, gain potentiel important ». Le récit du chauffeur de taxi d'Abidjan à 298 M XOF pour 3 000 F sur 15 équipes circule partout. | Commercial, anecdotique |

**Lecture.** Le parieur d'Afrique de l'Ouest joue peu d'argent, souvent, et achète un rêve : un petit billet qui change la journée. Un 1,25 ne vend aucun rêve (1 000 F deviennent 1 250 F). La littérature le confirme : la probabilité d'un favori est perçue comme « déjà acquise », donc sans intérêt, alors qu'elle est en réalité sous-jouée et mieux payée que les outsiders sur la durée. **Ce que nous vendons est vrai, et c'est précisément ce que le parieur ne veut pas acheter spontanément.**

## 2. Ce que disent nos propres chiffres

[03-coupon-heros.md](03-coupon-heros.md), 13 au 29 octobre, hors admins :

| Produit | Cote moyenne | Vues | Joueurs distincts | Suivis |
| --- | ---: | ---: | ---: | ---: |
| Favori du jour | 1,22 | 26 | 6 | 0 |
| Combiné du jour | 1,40 | 29 | 6 | 0 |
| Combiné IA | 1,56 | 21 | 5 | 0 |
| Coupon long | 2,95 | 20 | 6 | **1** |

Six joueurs, un seul suivi, sur le produit le plus cher. Aucune puissance statistique, mais la direction est celle du web.

## 3. Ce qu'on en fait

Trois options, de la plus prudente à la plus risquée.

**A. Garder le Favori en héros et rendre la petite cote sensible** (proposé)

On ne rend pas 1,25 séduisant, on rend sa **répétition** visible. Le 1,25 n'a de sens qu'empilé : 5 jours gagnés sur 7, et « En francs » sur la durée. L'unité à montrer n'est pas le match, c'est **la semaine et le mois**.

- La ligne Hier devient le premier écran du matin ; « Ta semaine » le lundi.
- « En francs » dans Résultats, dès le premier niveau de la page détail : « 1 000 F par jour sur le Favori depuis le 13/10 : misé 14 000 F, rendu 15 300 F ». Perte comme gain, toujours daté.
- **« Vérifie ton ticket » devient la porte d'entrée**, pas un bonus. Le joueur arrive avec son combiné à 8 matchs ; on lui montre « environ 1 fois sur 40 » et « 1xBet garde 28 % ». À côté, le Favori à « 8 sur 10 ». C'est là, et seulement là, que la petite cote a une chance d'être désirée : par comparaison avec ce qu'il allait jouer.
- Le Coupon cote 2 reste visible juste sous le héros : c'est notre produit le plus proche du plancher mental « 2 odds », et il est honnête (34 → 40 % sur le long, le cote 2 lui-même n'a qu'un jour).

**B. Mettre le Coupon cote 2 en héros**

Il parle la langue du parieur (une cote qui double la mise). Mais il gagne un jour sur deux, et la fiche [01](01-ce-qu-on-montre.md) a fait du héros le porteur de la preuve : une forme à 50 % de rouge ne prouve rien. Et il n'a qu'un jour de recul. À remesurer le 10/12 avec les suivis.

**C. Monter une échelle visible**

Un seul bloc, quatre lignes, du plus sûr au plus rêveur : « Favori 8 sur 10 · Combiné 7 sur 10 · Cote 2 1 sur 2 · Long 1 sur 3 ». Le joueur choisit son appétit, on ne choisit pas pour lui. C'est honnête, mais ça contredit la loi de Hick posée en [01](01-ce-qu-on-montre.md) § 3 (un héros, les autres plus petits). À garder comme repli si A ne prend pas.

**Ce qu'on ne fera pas** : vendre le Favori avec le vocabulaire du gros gain, le présenter comme « sûr », ou inventer un produit à grosse cote pour plaire. Les quatre produits existants couvrent déjà 1,22 à 2,95.

## 4. Comment on saura

Le web ne tranche pas et nos six joueurs non plus. Deux mesures, sans attendre :

1. **Dans l'app**, par produit et par semaine : vues, suivis, et surtout **tickets vérifiés** (nombre, jambes moyennes, cote moyenne). Si les joueurs vérifient des tickets à 8 matchs et ne suivent jamais le Favori, A n'a pas marché. Relecture le 10/12, déjà prévue dans [03](03-coupon-heros.md).
2. **Hors app**, cinq questions à une trentaine de parieurs d'Abidjan (WhatsApp, pas un formulaire) : combien de matchs sur ton dernier ticket, sa cote, ta mise, le dernier gain qui t'a marqué, et « ce coupon à 1,25 qui gagne 8 jours sur 10, tu le joues ? ». Une demi-journée, et ça vaut plus que tout le web ci-dessus.

## Sources

- [GeoPoll — Betting in Africa 2026](https://www.geopoll.com/blog/betting-africa-2026/)
- [Makinde, Onasanya, Adelakun — The Statistical Profitability of Social Media Sports Betting Influencers: Evidence from the Nigerian Market (arXiv 2604.08251)](https://arxiv.org/abs/2604.08251)
- [Abdulkadir — Gamblers Learn from Experience (arXiv 2011.00432)](https://arxiv.org/html/2011.00432v2)
- [Snowberg & Wolfers — Explaining the Favorite-Longshot Bias: Is it Risk-Love or Misperceptions? (NBER w15923)](https://www.nber.org/papers/w15923)
- [Wikipedia — Favourite-longshot bias](https://en.wikipedia.org/wiki/Favourite-longshot_bias)
- [Newall — Gambling advertising is inherently misleading (2026)](https://www.tandfonline.com/doi/full/10.1080/16066359.2025.2555471)
- [Conditions de bonus 1xBet (page affiliée, Nigeria)](https://www.afrik-foot.com/en-ng/1xbet-promo-code-ng)
- [Pulse Sports — Best Telegram betting channels in Nigeria (2026)](https://www.pulsesports.ng/story/best-telegram-betting-channels-in-nigeria-2026022514211453802)
- [Playlogiq — Sportsbook revenue in Africa](https://playlogiq.com/sportsbook-revenue-roi-break-even-africa/)
- [bettors-ci — Qu'est-ce qu'un pari multiple ?](https://bettors-ci.com/quest-ce-quun-pari-multiple/)
- [pari-gagnant — Les plus gros gains de paris sportifs en Côte d'Ivoire](https://pari-gagnant.com/les-plus-gros-gains-de-paris-sportifs-en-cote-divoire-5-histoires-incroyables-de-gains-enormes/)
- [SCCG — 2025 Research Report on Africa's Online Gambling Market](https://sccgmanagement.com/wp-content/uploads/2025/06/Primer-on-Africa-Gambling.pdf)
