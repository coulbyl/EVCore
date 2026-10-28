# Sous-estime-t-on des sélections qu'on laisse ? Étude avant le coupon cote 2–3

_Étude du 28/10/2026, demandée avant de brancher le coupon cote 2–3 en live. Données : copie de production du 24/10 restaurée localement. 116 jours (01/07 → 24/10). Tout ce que le moteur a envisagé, retenu ou rejeté : **458 611 sélections**, une seule analyse par match (la dernière avant le coup d'envoi), réglées sur le score réel (`settled-picks.sql`). Scripts et sorties complètes dans `scripts/`._

## Réponse courte

1. **Oui, le moteur sous-estime beaucoup de ce qu'il rejette**, mais seulement par rapport à ses propres chiffres :
   - les sélections rejetées pour « probabilité trop faible » sont annoncées à 37 % et passent 58 % du temps ;
   - à l'inverse, quand le moteur se dit sûr à 89 %, il réalise 76 %.
2. **Par rapport au prix du marché, rien n'est sous-estimé de façon exploitable.** Tous les groupes passent à ±1 point de la probabilité du marché sans marge. Tous perdent à mise fixe, de −3 à −9 %. Les cellules qui semblent bonnes sur une période ne le restent pas sur la suivante (corrélation −0,04).
3. **À même marché et même tranche de cote, nos sélections retenues et celles qu'on laisse passent autant** : 66,9 % contre 66,5 %. Le choix du moteur n'ajoute rien à prix égal.
4. **Conséquence pour le coupon : le composer à partir de tous les paris cotés, classés par le prix du marché**, et non à partir de nos seules sélections. Sur 115 jours :
   - un coupon presque tous les jours (114, au lieu de 89) ;
   - le coût attendu le plus bas (−7,9 % au lieu de −9,4 %) ;
   - une annonce honnête (44 % annoncés, 48 % ± 9 réalisés), stable les quatre mois.
5. **Le piège à éviter : élargir le vivier en gardant le classement par « taux passé de la cellule ».** Le compositeur va alors chercher des marchés exotiques chers dont le passé flatteur ne se répète pas. Il annonce 53 % et réalise 35 à 46 %.

## 1. Qui se trompe : le moteur, pas le marché

Tranche de cote 1,20–1,80 (celle des jambes d'un coupon à 2–3) :

| Probabilité annoncée | Marché sans marge : réalisé − annoncé | Moteur : réalisé − annoncé |
| -------------------- | ------------------------------------: | -------------------------: |
| ≤ 50 %               |                                  +6,1 |                  **+17,6** |
| 50–60 %              |                           +0,7 / −0,6 |                +7,8 / +4,3 |
| 60–70 %              |                           +0,5 / +0,6 |                +2,5 / +0,6 |
| 70–80 %              |                           +1,1 / +0,9 |                −2,5 / −5,2 |
| 80–100 %             |                                  +3,8 |           −8,2 / **−13,6** |

Le marché sans marge est juste à un point près. Le moteur écrase ses probabilités vers les extrêmes : trop sûr en haut, trop prudent en bas. C'est ce que mesurait déjà l'écart de Brier (0,639 contre 0,599 pour le marché).

## 2. Ce qu'on garde et ce qu'on laisse

Cotes 1,20–1,80, hors matchs « Données suspectes » ; « écart » = réalisé moins référence, en points, intervalle à 95 % groupé par match.

| Groupe                            | Jambes | Annonce moteur | Marché sans marge | Réalisé | Écart au moteur | Écart au marché | À mise fixe |
| --------------------------------- | -----: | -------------: | ----------------: | ------: | --------------: | --------------: | ----------: |
| Vivier actuel du coupon           | 14 707 |         69,4 % |            66,3 % |  66,8 % |      −2,6 ± 1,0 |      +0,9 ± 1,0 |  −4,3 ± 1,4 |
| Laissé : EV insuffisante          | 40 299 |         64,7 % |            67,1 % |  67,3 % |      +2,6 ± 0,6 |      +0,3 ± 0,6 |  −5,4 ± 0,8 |
| Laissé : probabilité trop faible  |  1 153 |         36,5 % |            57,3 % |  58,5 % | **+21,9 ± 3,4** |      +1,1 ± 3,5 |  −4,2 ± 5,5 |
| Laissé : buts attendus trop hauts |  2 563 |         69,3 % |            67,3 % |  67,1 % |      −2,2 ± 2,0 |      −0,2 ± 2,0 |  −5,1 ± 2,9 |
| Laissé : cote sous le plancher    |  1 841 |         77,3 % |            62,0 % |  63,7 % |     −13,7 ± 2,5 |      +1,3 ± 2,6 |  −3,4 ± 3,9 |
| Laissé : score de qualité bas     |  1 326 |         76,1 % |            65,0 % |  66,2 % |      −9,9 ± 2,7 |      +1,0 ± 2,8 |  −4,0 ± 4,1 |
| Laissé : type de pari suspendu    |  5 768 |         66,7 % |            66,3 % |  67,0 % |      +0,3 ± 1,0 |      +0,8 ± 1,0 |  −4,9 ± 1,4 |
| Matchs « Données suspectes »      | 17 651 |         62,4 % |            66,0 % |  66,8 % |      +4,4 ± 0,9 |      +1,1 ± 0,8 |  −4,8 ± 1,2 |

La colonne « écart au moteur » répond à la question posée : oui, on laisse des sélections que le moteur sous-estime, parfois de 22 points. La colonne « écart au marché » dit pourquoi ça ne change rien à l'argent : le marché les avait bien évaluées, et elles perdent à mise fixe comme le reste.

**À prix égal, le vivier ne fait pas mieux.** Sur 33 cellules comparables (marché × tranche de cote), pondérées par le vivier : 66,9 % pour le vivier, 66,5 % pour ce qu'on laisse. L'écart au marché est de +0,7 contre +0,4 point.

**Le désaccord du moteur avec le marché ne porte aucune information.** Par quintile de désaccord, de « moteur 53 points plus bas » à « moteur 40 points plus haut », l'écart au marché reste entre −0,2 et +1,1 point, sans pente.

**Nos garde-fous n'écartent pas de mauvais paris à prix égal.** Les types de pari suspendus (+0,8) et les matchs « Données suspectes » (+1,1) réalisent comme le reste (+0,5). Ces garde-fous protègent des erreurs du moteur. Un compositeur qui lit le prix du marché ne les commet pas.

## 3. Le seul effet stable : les cotes courtes sont un peu sous-évaluées

Tous marchés, hors suspendus et hors Données suspectes :

| Cote      | Jambes | Marché sans marge |       Réalisé | Écart au marché | À mise fixe |
| --------- | -----: | ----------------: | ------------: | --------------: | ----------: |
| 1,00–1,20 | 31 093 |            86,4 % |        88,6 % |  **+2,1 ± 0,5** |  −3,1 ± 0,5 |
| 1,20–1,35 | 21 464 |            73,8 % |        74,7 % |      +0,8 ± 0,6 |  −4,9 ± 0,8 |
| 1,35–1,50 | 14 757 |            66,3 % |        67,3 % |      +1,0 ± 0,8 |  −4,4 ± 1,1 |
| 1,50–1,80 | 19 053 |     59,9 / 54,5 % | 59,6 / 54,0 % |     −0,2 / −0,4 | −6,1 / −6,6 |
| 2,60–3,50 | 33 644 |            30,2 % |        29,8 % |      −0,3 ± 0,5 |  −9,5 ± 1,5 |
| > 6       | 59 859 |             8,8 % |         7,4 % |      −1,3 ± 0,3 | −27,6 ± 3,2 |

C'est le biais favori–outsider connu : les favoris passent un peu plus souvent que leur prix ne le dit, les outsiders moins. L'effet ne bat jamais la marge, mais il dit **où parier coûte le moins cher : sur les cotes courtes**. Chaque jambe de plus repaie la marge.

## 4. Le compositeur rejoué

Fenêtre de cote combinée 2,10–3,15 en cote de référence, soit environ 2,00–3,00 chez 1xBet. Une jambe par match, deux jambes, et trois seulement si aucune paire n'existe. Les taux de cellule sont calculés uniquement sur les jours précédents.

| Variante                                                  |       Jours | Cote moy. |    Annoncé |    Réalisé | Coût attendu | Marge payée |
| --------------------------------------------------------- | ----------: | --------: | ---------: | ---------: | -----------: | ----------: |
| A. Vivier actuel, taux de cellule, 2 ou 3 (proposé le 27) |      89/115 |      2,19 |     50,4 % |    48 ± 10 |       −9,5 % |      10,4 % |
| B. Vivier actuel, taux de cellule, 2 puis 3               |      89/115 |      2,19 |     50,3 % |    49 ± 10 |       −9,4 % |      10,2 % |
| C. Vivier élargi, taux de cellule                         |     105/115 |      2,16 |     53,2 % |    46 ± 10 |      −13,2 % |      14,5 % |
| D. Élargi + Données suspectes, taux de cellule            |     106/115 |      2,15 |     53,0 % |     35 ± 9 |      −13,5 % |      14,8 % |
| **E. Vivier élargi, prix du marché**                      | **114/115** |  **2,11** | **43,6 %** | **48 ± 9** |   **−7,9 %** |   **8,4 %** |
| F. Élargi + Données suspectes, prix du marché             |     114/115 |      2,11 |     43,8 % |     48 ± 9 |       −7,7 % |       8,2 % |

Le « coût attendu » est le retour à mise fixe calculé avec la probabilité du marché sans marge. Contrairement au réalisé (±9 à 10 points), il est précis : c'est lui qui départage les variantes.

**E, mois par mois** : 46,7 %, 45,2 %, 51,7 %, 50,0 % réalisés pour 43 à 44 % annoncés, coût de −9,0 à −6,7 %.

**Par jambe** (228 jambes) : 66,7 % annoncés, 71,9 % réalisés, cote moyenne 1,47, marge 4,2 %.

**Marchés choisis par E** : buts plus ou moins (133 jambes sur 228), 1X2, double chance, total d'une équipe. Ce sont les moins taxés. 171 jambes sur 228 n'étaient **pas** dans le vivier actuel : le moteur les avait rejetées, surtout pour EV insuffisante.

Pourquoi E gagne :

- **Classer par la probabilité du marché sans marge, c'est classer par le prix.** À cote combinée égale, la combinaison la plus probable selon le marché est celle qui paie le moins de marge.
- **Le marché est juste**, donc l'annonce l'est aussi. Elle est même un peu prudente sur les cotes courtes.
- **Il n'y a pas de malédiction du vainqueur** : il ne choisit pas « ce qui a le mieux marché avant ».
- **Le moteur ne sert à rien ici**, et c'est cohérent avec tout ce qui a été mesuré depuis septembre : à prix égal, son choix n'ajoute rien.

Pourquoi C et D échouent : avec beaucoup plus de candidats, le classement par taux passé de la cellule va chercher les cellules au passé le plus flatteur, comme les exotiques à 15 % de marge. Ce passé ne se répète pas (corrélation −0,04). C'est la règle déjà écrite dans CLAUDE.md : classer sur le prix, jamais sur « le plus susceptible de rentrer ».

## 5. Ce que ça change à la proposition

| Point          | Proposé le 27/10                              | Après l'étude                                                                  |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| Vivier         | Nos sélections retenues (2,5 % de l'envisagé) | **Tout ce qui est coté**, hors types suspendus et matchs « Données suspectes » |
| Classement     | Taux réalisé passé de la cellule              | **Probabilité du marché sans marge**, à égalité la marge la plus basse         |
| Jambes         | 2 ou 3, la meilleure                          | **2**, 3 seulement si aucune paire (jamais arrivé avec le vivier élargi)       |
| Annonce        | Taux de cellule (~50 %)                       | **Probabilité du marché** (~44 %, « environ 1 fois sur 2 »)                    |
| Fenêtre        | 2,00–3,00 chez 1xBet                          | Inchangée                                                                      |
| Jours couverts | 89 sur 115                                    | 114 sur 115                                                                    |

Garde-fous gardés par cohérence avec l'écran : un type de pari suspendu ne doit pas apparaître dans un coupon quand Décisions le dit suspendu. Les garder ne coûte rien de mesurable (E ≈ F).

## Livré le 28/10

Sur confirmation de l'utilisateur, les étapes 1 et 2 de l'ordre recommandé sont livrées.

| Commit                 | Changement                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `4ee6cef3`, `6c53602f` | **Coupon cote 2** (classe `DOUBLE`) : tout ce qui est coté, classé par la probabilité du marché sans marge, deux jambes de cote combinée 2 à 3 chez 1xBet, une par match. Affiché sur l'accueil après le Combiné et dans Coupons : « Gagne environ 1 jour sur 2 ». Essai à blanc sur les 24, 25 et 26/10 de la copie de prod : deux jambes à 2,00–2,02 chez 1xBet, 48 à 51 % annoncés. |
| `4ee6cef3`             | **Plus de « remboursé si match nul » dans aucun coupon** (décision de l'utilisateur) : `POOL_EXCLUDED_MARKETS` pour le coupon cote 2, le coupon prix, le combiné de Notre sélection et le combiné IA. Il reste visible dans Décisions et la fiche de match.                                                                                                                            |
| `b204dfa4`, `e42571e9` | **La fréquence affichée est celle du marché**, marge retirée, dans Décisions, les avis IA, la fiche de match, l'accueil et les coupons. Victoire Arsenal à 1,28 passe de « 8 fois sur 10 » (moteur) à « 7 fois sur 10 » (marché). La note « Cote de 1,80 et plus », qui qualifiait les chiffres du moteur, est retirée avec eux.                                                       |

Aucune migration. Restent, dans l'ordre :

- rejouer le combiné du jour de Notre sélection avec cette méthode ;
- étudier le choix de Notre sélection sur chaque match ;
- revoir ce que lit l'IA après la relecture de la version v5 (vers le 10/11).

## Limites

- **Cotes de référence (celles de l'analyse), pas celles de 1xBet.** En production, la fenêtre et la marge doivent se lire sur la cote 1xBet. Son classement peut différer, la méthode reste la même.
- **116 jours, une seule copie de prod.** Le réalisé d'un coupon est à ±9–10 points. Les décisions reposent sur le coût attendu, la couverture et la calibration par jambe, qui sont précis. Les +5 points par jambe de E ne sont pas significatifs (n = 228) et ne doivent pas être annoncés.
- **La marge est retirée proportionnellement.** Cette méthode sous-estime un peu les favoris (cf. section 3), ce qui rend l'annonce prudente.
- **Même conclusion probable pour le combiné du jour de Notre sélection** (source ENGINE), qui pioche aussi dans nos seules sélections : à vérifier séparément.
