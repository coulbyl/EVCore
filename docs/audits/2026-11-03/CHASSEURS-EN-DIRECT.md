# Les chasseurs qui « ne fonctionnent pas »

_Étude du 03/11, demandée par l'utilisateur : « regarde si tu peux booster les chasseurs qui ne fonctionnent pas ». Copie de prod du 03/11 04:01, suite de `docs/audits/2026-10-28/HUNTERS.md` et `docs/audits/2026-10-29/CORNERS.md`._

## Réponse courte

1. **Aucun chasseur n'est cassé.** Après 5 à 6 jours en ligne :
   - BTTS : 1 jambe gagnée sur 5 ;
   - Nul : 1 sur 6 ;
   - Score exact : 1 sur 6 ;
   - Corners : 3 sur 3.

   Au prix du marché, faire aussi mal que le BTTS arrive une fois sur dix, que le Nul quatre fois sur dix. Le Score exact fait mieux que prévu.

2. **On ne peut pas « booster » un chasseur en changeant sa règle sur 5 jours** : ce serait choisir sur du bruit. Les variantes du 28/10 restaient toutes dans un intervalle de ± 8 à ± 10 points sur 112 jambes.
3. **Le marché tombe juste dans toutes les bandes de cote** (clôtures Pinnacle en base : 6 644 matchs pour le BTTS, 3 273 pour le nul). La seule manette honnête est la bande : une bande plus basse gagne plus souvent, à une cote plus faible, pour le même coût. C'est un choix de produit, pas un gain.
4. **Proposition** : ne rien changer aux règles. Relire au 10/12 comme prévu (≈ 40 jambes par chasseur). Ne baisser une bande que si l'on veut un produit qui gagne plus souvent, en le disant comme tel.

## En direct (`coupon_proposal`, rang 1, 28/10 – 03/11)

| Chasseur                      | Jambes réglées | Gagnées | Cote moyenne | Fréquence du marché |            Chance de faire aussi mal ou pire |
| ----------------------------- | -------------: | ------: | -----------: | ------------------: | -------------------------------------------: |
| Les deux marquent (1,45–1,90) |              5 |       1 |         1,63 |              58,3 % |                                         10 % |
| Nul (2,90–3,60)               |              6 |       1 |         3,42 |              29,1 % |                                         44 % |
| Score exact (5–12)            |              6 |       1 |           ~8 |               ~11 % | au-dessus de l'attendu (0,7 gagnée attendue) |
| Corners (1,70–2,10)           |              3 |       3 |         1,81 |              54,4 % |                                            — |

Les intervalles se lisent sur 40 jambes au moins ; à 5 jambes, la mesure ne tranche rien.

## La fréquence du marché par bande de cote

Clôture Pinnacle (moins de 24 h avant le coup d'envoi, paire ou grille dé-margée), matchs finis.

**Les deux marquent « oui »** (6 644 matchs) :

| Cote        | Matchs | Marché sans marge | Réalisé |
| ----------- | -----: | ----------------: | ------: |
| sous 1,45   |    213 |            69,0 % |  71,8 % |
| 1,45 – 1,65 |  1 154 |            62,1 % |  62,0 % |
| 1,65 – 1,90 |  3 132 |            54,5 % |  53,9 % |
| 1,90 – 2,20 |  1 675 |            47,9 % |  49,1 % |

**Nul** (3 273 matchs, 150 derniers jours, clôture à moins de 6 h) :

| Cote        | Matchs | Marché sans marge | Réalisé |
| ----------- | -----: | ----------------: | ------: |
| 2,90 – 3,20 |    270 |            31,2 % |  32,2 % |
| 3,20 – 3,60 |    858 |            28,1 % |  28,8 % |
| 3,60 et +   |  2 082 |            22,3 % |  21,5 % |

Le marché tombe juste partout, à 1 point près. Un chasseur BTTS limité à 1,45–1,65 gagnerait environ 6 fois sur 10 au lieu de 5,5, à une cote de 1,55 au lieu de 1,63, pour le même coût. Il serait aussi composé moins souvent, puisqu'il trouve moins de matchs dans la bande.

## Ce qui pourrait vraiment aider (hors règle)

- **Le dire au joueur.** Chaque chasseur affiche déjà sa fréquence et sa pire série. Un début à 1 sur 5 pour le BTTS est dans sa pire série attendue (4 jours, mesurée le 28/10).
- **Le coût, seul levier qui persiste.** Les chasseurs prennent déjà la marge 1xBet la plus basse (lot 3). La marge 1xBet sur le BTTS reste élevée face au 1X2 des grands championnats : c'est le marché lui-même qui coûte.
- **Pas d'accélérateur caché** : ni modèle maison (derrière le marché), ni filtre par championnat (aucune persistance, r = 0,06), ni phase d'ombre.

## À relire

Le 10/12, comme prévu dans HUNTERS.md et CORNERS.md : par chasseur, réalisé contre marché jambe par jambe avec son intervalle, pire série, marge 1xBet payée.
