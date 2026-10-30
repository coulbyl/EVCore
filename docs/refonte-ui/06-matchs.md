# Refonte UI — 6. Matchs et la fiche de match

_29/10/2026. Suite de [02-les-4-onglets.md](02-les-4-onglets.md) § 2. Proposition à corriger. L'onglet Matchs remplace Décisions, Avis IA et la fiche de match actuelle. La fiche actuelle reste telle quelle **côté admin** (c'est un diagnostic, elle ne trie rien) ; ce qui suit est la fiche du joueur._

## 1. L'onglet Matchs

```
 EVCore                                🔔  (K)
────────────────────────────────────────────────
 Hier     ● Aujourd'hui     Demain          🔍
────────────────────────────────────────────────
 19:00
 [ARS] Arsenal – Chelsea        Victoire Arsenal · 7 sur 10   ›
 [LYO] Lyon – Lens              Plus de 1,5 but · 8 sur 10    ›
 [BRE] Brest – Nice             Écarté                        ›
 20:45
 [PSG] PSG – Marseille          Victoire du PSG · 6 sur 10    ›
 [LAZ] Lazio – Torino           Match nul · 3 sur 10          ›
 ─ 14 matchs sans lecture ·  Voir ─
────────────────────────────────────────────────
  Aujourd'hui    Matchs    Résultats    Moi
```

**Premier niveau, de haut en bas**

1. **Trois puces de jour** : Hier · Aujourd'hui · Demain. Aujourd'hui par défaut. Pas de calendrier, pas d'autre jour : le passé est dans Résultats.
2. **Une loupe** : la recherche d'équipe, qui filtre la liste en tapant. Pas de filtre de championnat ni de liste déroulante.
3. **Les matchs, regroupés par heure** (heure d'Abidjan), en-tête d'heure collant. Dans une heure, les championnats dans l'ordre d'intérêt du joueur (les grands d'abord), puis l'alphabet.
4. **Chaque ligne** : les deux logos, les deux équipes, et **une seule lecture** à droite : le pari nommé avec l'équipe et sa chance, « Victoire Arsenal · 7 sur 10 ». Trois chiffres au plus ; ici un seul.
5. ~~**Un signe ≠** après la lecture quand l'avis IA n'est pas d'accord.~~ **Retiré le 30/10** (§ 7) : la liste ne montre rien de l'IA.
6. **Les matchs sans lecture** (écartés, pas cotés, pas analysés) sont repliés en bas de chaque jour : « 14 matchs sans lecture · Voir ». C'est la bascule « Voir les écartés » de [02](02-les-4-onglets.md) § 5, désactivée par défaut. Dépliés, ils montrent « Écarté », « Pas coté chez 1xBet » ou « Pas de lecture » en gris.

**Ce qui sort de l'écran** : le menu canal, les badges de calibration, « Notre sélection », les étiquettes AVOID/CONSENSUS, « Voir les 5 autres lectures », la bannière de contradiction, les cartes dans les cartes.

**Budget** : aucun titre, aucun paragraphe, une lecture par ligne.

### Hier

Même liste, le score à la place de l'heure, et la lecture porte sa pastille : « Victoire Arsenal · ✓ », « Match nul · ✗ ». Les matchs sans lecture restent repliés. Le toucher ouvre la fiche réglée (§ 3).

### Demain

Les lectures de demain existent **dès 17 h UTC** (passe d'aperçu J+1, voir [04](04-aujourdhui-en-detail.md) § 5). Avant 17 h, Demain montre les matchs avec leur heure et « Lecture ce soir » en gris à la place de la lecture. Après, la liste est complète. Les coupons de demain, eux, restent sur Aujourd'hui… de demain : on ne montre jamais deux jours de coupons.

## 2. La fiche du match

Toucher une ligne ouvre une feuille, comme le coupon dans [04](04-aujourdhui-en-detail.md) § 1.

```
 ‹                                       Ligue 1
 [ARS]  Arsenal                          19:00
 [CHE]  Chelsea
────────────────────────────────────────────────
 Notre lecture
 Victoire Arsenal                  1,65   7 sur 10   [+]
 Arsenal a gagné ses 9 derniers matchs à domicile
────────────────────────────────────────────────
 Avis IA
 Match nul                         3,40   3 sur 10   [+]
 « Chelsea n'a perdu qu'une fois en 8 déplacements »
────────────────────────────────────────────────
 Forme
 Arsenal   ✓ ✓ ✗ ✓ ✓      repos 3 j      2 absents
 Chelsea   ✓ ✓ ✓ ✗ ✓      repos 6 j
 Face à face  4 victoires d'Arsenal sur les 6 derniers
────────────────────────────────────────────────
 Autres paris                                     ›
 Plus de 2,5 buts  1,80 · 1 sur 2     Les deux marquent  1,70 · 5 sur 10
 Victoire Chelsea  5,20 · 2 sur 10    Match nul  3,40 · 3 sur 10
────────────────────────────────────────────────
 1xBet prend 7 % sur ce match
```

**De haut en bas**

1. **L'en-tête** : le championnat, les deux équipes l'une sous l'autre, l'heure (ou le score, ou « En cours »).
2. **Notre lecture** : le pari nommé avec l'équipe, la cote 1xBet, la chance en « x sur 10 », **un fait** (le même mécanisme que la jambe de coupon, [04](04-aujourdhui-en-detail.md) § 1), et un **[+]** qui ajoute ce pari à Mon ticket ([02](02-les-4-onglets.md) § 2 bis). S'il y a plusieurs lectures du moteur, la première est celle qui a la meilleure chance, les autres descendent dans « Autres paris ».
3. **Avis IA** : **un pari parmi d'autres** (tranché le 30/10, § 7) : son pari, sa cote et sa chance, avec un [+], sans étiquette « D'accord » ni « Pas d'accord ». S'il joue le même pari que notre lecture, une ligne « Même pari que notre lecture » à la place. Sans avis (l'IA ne couvre pas tous les championnats), le bloc n'apparaît pas. **Une phrase** de son raisonnement, entre guillemets, 90 caractères au plus ; le reste au toucher. Jamais de jargon : si la phrase n'est pas propre, on ne l'affiche pas (le nettoyeur de VANTAGE v5 décide).
4. **Forme** : cinq pastilles par équipe (derniers matchs, toutes compétitions), les jours de repos, les absents s'ils sont connus. Une ligne de face-à-face, qui est un fait.
5. **Autres paris** : les lignes principales cotées chez 1xBet (1X2, plus/moins 2,5, les deux marquent), chacune avec sa cote et sa chance, chacune avec [+]. C'est le catalogue de « Vérifie ton ticket » : le joueur compose son ticket ici, sans jamais voir un écran de cotes.
6. **La marge** : « 1xBet prend 7 % sur ce match », une ligne, la seule mention d'argent.

**Ce qui n'y est pas** : les λ, la trace de calcul, les tables de calibration, la couverture des données, le vivier, les cotes des autres books, le mouvement de ligne, la probabilité du marché contre la nôtre. Tout cela vit dans la fiche admin, inchangée.

### Les chances affichées

Toutes les chances de la fiche viennent de la **même source** que les coupons. Avec ML v2 ([ML-V2-PROPOSITION](../audits/2026-10-29/ML-V2-PROPOSITION.md)), c'est la grille de marché : « 7 sur 10 » veut dire 7 sur 10, sur tous les paris, y compris « Autres paris ». En attendant, c'est la probabilité calibrée du moteur pour nos lectures **jusqu'à la cote 1,80**, et la fréquence du marché sans marge au-dessus (tranché le 29/10 : au-dessus de 1,80 le moteur annonce 34 % là où il réalise 29 %, [ACCUMULATEUR.md](../audits/2026-10-29/ACCUMULATEUR.md) § 6) ; pour « Autres paris », la fréquence du marché. La fiche ne mélange pas les deux sur une même ligne.

## 3. La fiche dans le temps

| Moment               | En-tête                                      | Lectures                                                                                        |
| -------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **À venir**          | L'heure                                      | Comme ci-dessus, [+] actifs                                                                     |
| **En cours**         | « En cours »                                 | Les [+] disparaissent. Pas de score en direct, on ne l'a pas.                                   |
| **Terminé**          | Le score, et le score à la mi-temps en petit | Notre lecture et l'avis IA portent ✓ ou ✗. « Autres paris » montre ce qui est passé, sans cote. |
| **Reporté / annulé** | « Reporté »                                  | Les lectures restent visibles, en gris, sans [+].                                               |

## 4. Les états

- **Écarté** : la fiche s'ouvre quand même. À la place de « Notre lecture » : « Pas de lecture · aucune chance assez sûre » (ou la vraie raison en une ligne, § 5). L'avis IA, la forme et « Autres paris » restent : le joueur peut composer son ticket.
- **Pas coté chez 1xBet** : « Pas coté chez 1xBet », pas de [+] nulle part, pas de marge. La lecture s'affiche sans cote.
- **Pas d'analyse** (championnat hors moteur, données manquantes) : « Pas de lecture », la forme seule si on l'a.
- **Pas d'avis IA** : la section dit « Pas d'avis » en gris, sans explication.
- **Recherche sans résultat** : « Aucun match pour "Asec" aujourd'hui » et les puces Hier/Demain restent actives.
- **Jour sans match** : « Aucun match aujourd'hui », rare, mais ça arrive hors saison.
- **Pause active** : l'onglet est fermé comme Aujourd'hui ([04](04-aujourdhui-en-detail.md) § 5), le serveur refuse déjà Décisions et la fiche.
- **Chargement, hors ligne, erreur** : mêmes règles que [04](04-aujourdhui-en-detail.md) § 5. Hors ligne, la liste du jour vue en dernier reste affichée, les [+] grisés.

## 5. Ce qu'il faut construire

- **La phrase de raison** pour un match écarté, en français du joueur, depuis les codes du moteur (`probability_too_low`, `odds_below_floor`, `no_odds`, `calibration_alert`, marché suspendu…). Une table de 10 lignes, et « aucune chance assez sûre » quand le code n'y est pas.
- ~~**Le signe ≠**~~ : retiré le 30/10 (§ 7).
- **La phrase de l'IA** : une ligne extraite de `reasonDetails`, avec le nettoyeur v5 ; sinon rien.
- **La recherche d'équipe** sur la liste du jour, côté client (la liste est déjà chargée).
- **« Lecture ce soir »** sur Demain avant 17 h UTC.
- **Les [+] et Mon ticket** : la barre basse et la feuille de « Vérifie ton ticket », écrites dans la fiche suivante.
- **Les absents** : `shadow_injuries` existe sur un tiers des matchs ; on l'affiche quand on l'a, rien sinon.

## 6. Tranché le 29/10

1. **L'ordre dans une heure** : grands championnats d'abord, puis l'alphabet.
2. **Les matchs sans lecture** : repliés par défaut, « N matchs sans lecture · Voir ».
3. **La phrase de l'IA** : une ligne toujours visible, 90 caractères, nettoyée ou absente.

## 7. Tranché le 30/10 : pas de signe ≠

1. **Le ≠ quitte la liste.** Un autre pari de l'IA est un choix, pas une contradiction : « l'équipe marque » et « victoire de l'équipe » passent ensemble. Et même un vrai désaccord (les deux paris ne peuvent pas gagner ensemble) n'a jamais été mesuré comme prédictif : VANTAGE v4 est calibrée mais ne bat pas la cote, le moteur non plus. Deux avis qui ne battent pas le marché ne deviennent pas utiles en se contredisant ; le signe ajoutait du doute sans information (29 lectures sur 47 le 30/10, le plus souvent pour un simple autre marché).
2. **L'avis IA vit dans la fiche**, comme un pari de plus avec sa cote et sa chance, sans cadre d'accord.
3. **À mesurer plus tard**, quand VANTAGE v5 aura assez tourné (cohorte à relire vers le 10/11, voir le bilan du lot 5) : sur les lectures réglées, notre lecture gagne-t-elle moins souvent quand l'IA a joué un pari **incompatible** (aucun score ne fait gagner les deux) ? Si oui, nettement et sur un volume suffisant, le signal a sa place, peut-être dans le moteur plutôt qu'à l'écran. Sinon, rien ne change.

## 8. Question ouverte : quel pari montrer comme lecture

La règle du § 2 choisit, parmi les paris retenus par le moteur, celui qui a **la meilleure chance**. Mesuré sur le point d'entrée le 30/10 (copie de prod), elle tombe souvent sur des paris très probables mais peu parlants : « Gremio marque au moins un but · 8 sur 10 » à 1,28, « moins de 4,5 buts » à 1,20. On attendait plutôt « Victoire Arsenal · 7 sur 10 ».

Deux voies, à trancher avant l'écran (C4) :

1. **Garder la meilleure chance** : la règle la plus simple et la plus honnête, mais des lectures banales.
2. **Préférer des marchés parlants** (victoire, double chance, plus/moins 2,5 buts) quand leur chance est proche de la meilleure (par exemple à 5 points près), sinon garder la meilleure chance.

Rien n'est changé en attendant : `MatchesService` applique la voie 1.
