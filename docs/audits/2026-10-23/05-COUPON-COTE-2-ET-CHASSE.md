# Coupon « cote 2 » et coupon « chasse » : faisabilité mesurée

_Étude du 23/10/2026, sur les données de production lues en lecture seule avec une session Opérateur (API `channel-decisions/by-match` et `analysis-sheet` v1), du 08/09 au 22/10/2026 : 2 702 matchs terminés. Complète `04-DIAGNOSTIC-JOUEUR.md`._

## Méthode, en bref

- **Coupon cote 2** : simulation, jour par jour, de plusieurs règles de composition. Elles utilisent uniquement les sélections réellement émises ce jour-là par les canaux du moteur.
  - Filtres appliqués : hors méta-canaux, VALUE, SAFE et IA ; hors matchs AVOID ; hors canal « peu fiable » sur la compétition ; cote jouable d'au moins 1,10 chez le bookmaker de référence.
  - Calcul : une unité misée par jour à la cote jouable, un remboursement compte 1.
- **Chasse** : chaque match terminé est évalué sur trois paris, à partir de la probabilité et de la cote de la fiche d'analyse, puis réglé sur le score final : Plus de 3,5 buts, Les deux équipes marquent (oui), Match nul. Le score exact vient des sélections du canal CORRECT_SCORE.
- **Limites** :
  - 45 jours, c'est court. Un taux de réussite quotidien est connu à environ ± 15 points, un ROI de coupon à environ ± 30 points.
  - Les règles dont les marchés ont été choisis en regardant ces mêmes données sont « dans l'échantillon » : ce sont des hypothèses à tester, pas des résultats.

---

## 1. Un coupon à cote 2 qui « rentre le plus souvent » : est-ce difficile ?

**La limite est arithmétique.** À cote 2, un pari juste gagne une fois sur deux. Avec la marge du bookmaker (médiane de 5,6 % sur le groupe d'issues, mesurée sur 3 019 sélections à cote 1,20–1,65 via le champ `marginPaid`, cf. [MARGIN-PAID.md](../2026-10-11/MARGIN-PAID.md)), le plafond réaliste se situe **autour de 47 à 50 % de jours gagnants**. Gagner plus souvent, durablement, à cote 2 voudrait dire battre le marché. Les audits du dépôt établissent que le moteur ne le fait pas ([journal-experiences.md](../../journal-experiences.md), CLAUDE.md).

**Ce qu'ont donné les règles simulées (45 jours) :**

| Règle                                                            | Jours | Gagnés | Réussite | Cote jouable moy. |     ROI | Pire série perdante |
| ---------------------------------------------------------------- | ----: | -----: | -------: | ----------------: | ------: | ------------------: |
| 2 jambes 1,20–1,65, paire la plus probable (combinée 1,80–2,30)  |    38 |     18 | **47 %** |              1,91 | −12,9 % |                   4 |
| 3 jambes 1,20–1,40, triplet le plus probable                     |    42 |     17 |     40 % |              1,94 | −22,9 % |                   5 |
| 2 jambes 1,35–1,50 (combinée 1,85–2,20)                          |    41 |     19 |     46 % |              1,95 | −13,3 % |                   4 |
| Simple unique à 1,80–2,30, la plus probable                      |    44 |     21 | **48 %** |              1,89 |  −0,3 % |               **8** |
| 2 jambes, probabilité recalibrée par marché                      |    41 |     19 |     46 % |              1,93 | −19,2 % |                   5 |
| 2 jambes, classement au prix (marge la plus basse), tous marchés |    42 |     16 |     38 % |              2,04 | −23,1 % |                   6 |
| 2 jambes, marchés sous-annoncés*, paire la plus probable         |    41 |     24 |     59 % |              1,90 |  +5,2 % |                   3 |
| 2 jambes, marchés sous-annoncés*, marge la plus basse            |    43 |     28 | **65 %** |              2,01 | +30,1 % |                   4 |

\* Marchés « sous-annoncés » d'après le diagnostic joueur : Plus/Moins de buts, Buts par équipe (domicile), Gagne une mi-temps, Remboursé si nul, Buts 1re mi-temps. Ils sont choisis en regardant ces mêmes données.

**La meilleure règle ne tient pas dans le temps.** Coupée en deux périodes :

| Règle « marchés sous-annoncés, marge la plus basse » | Jours | Gagnés | Réussite |     ROI |
| ---------------------------------------------------- | ----: | -----: | -------: | ------: |
| 08/09 → 30/09                                        |    21 |     17 |     81 % |   +61 % |
| 01/10 → 22/10                                        |    22 |     11 | **50 %** | **0 %** |

Le 65 % global vient d'un bon mois de septembre. En octobre, la règle retombe exactement au plafond arithmétique. C'est le même schéma que celui documenté dans [ESPACE-OPPORTUNITES.md](../2026-09-16/ESPACE-OPPORTUNITES.md) : un classement compétition × marché ne persiste pas d'une période à l'autre.

**Le piège à éviter dans l'interface.** Quand on prend la paire « la plus probable » selon le moteur, sa probabilité annoncée moyenne est de **70 %**, pour **47 %** de réussite réelle. Choisir ce qui semble le plus sûr revient à choisir ce que le moteur surestime le plus (CLAUDE.md : « most likely to land » est un détecteur de surestimation). Un coupon cote 2 qui afficherait « CHANCES 70 % » tromperait le joueur de plus de 20 points.

### Ce qui est faisable et honnête

1. **Un « Coupon du jour à cote 2 » est faisable techniquement**, avec le compositeur existant (cible 1,80–2,30, jambes de 1,20 à 1,65, cote jouable d'au moins 1,10). Mais **il gagnera environ un jour sur deux**, pas plus. Le présenter comme tel : « Gagne environ 1 jour sur 2. »
2. **Les chances affichées doivent être recalibrées** sur le réalisé par marché et par tranche de cote, jamais la simple multiplication des probabilités du moteur.
3. **La piste « marchés sous-annoncés + marge la plus basse » mérite un test en ombre** de 6 à 8 semaines, avec règle figée à l'avance et comparaison par jambe. Ne pas la publier avant : la moitié d'octobre est déjà à 50 %.
4. La simple à 1,80–2,30 donne le même taux de réussite qu'un combiné, avec moins de jambes à vérifier. Mais sa série perdante peut atteindre 8 jours : c'est à afficher.

---

## 2. Un coupon « chasse » (BTTS, nul, plus de 3,5 buts, score exact) : y gagnerait-on ?

**Sur tous les matchs terminés (fiche d'analyse) et sur les sélections des canaux concernés :**

| Pari                                 | Paris | Réussite réelle | Proba moteur | Proba marché (marge incluse) | Cote moy. |                           ROI | Pire série perdante |
| ------------------------------------ | ----: | --------------: | -----------: | ---------------------------: | --------: | ----------------------------: | ------------------: |
| Plus de 3,5 buts, tous matchs        | 2 525 |          33,4 % |       28,8 % |                       36,2 % |      3,04 |                        −8,4 % |                  19 |
| Plus de 3,5, λ total ≥ 3,2           |   351 |          45,6 % |       42,8 % |                       47,3 % |      2,21 |                    **−4,5 %** |                  10 |
| Plus de 3,5, proba moteur ≥ 45 %     |   109 |          45,9 % |       50,4 % |                       51,0 % |      2,08 |                       −12,0 % |                   5 |
| Plus de 3,5, « edge » ≥ 5 pts        |   157 |      **26,1 %** |       37,4 % |                       28,5 % |      3,82 |                       −10,0 % |                  14 |
| BTTS oui, tous matchs                | 2 525 |          56,3 % |       52,8 % |                       58,8 % |      1,74 |                        −3,8 % |                   8 |
| BTTS oui, proba ≥ 62 %               |   304 |          66,4 % |       65,2 % |                       68,6 % |      1,47 |                        −3,2 % |                   5 |
| BTTS oui, canal BTTS                 |   757 |          59,8 % |       60,0 % |                            — |      1,60 |       −5,4 % (jouable −7,5 %) |                   6 |
| BTTS oui, avis IA                    |   404 |          59,9 % |       59,1 % |                            — |      1,61 |                        −4,0 % |                   7 |
| Nul, tous matchs                     | 2 610 |          24,8 % |       24,6 % |                       25,7 % |      4,18 |                        −4,1 % |              **23** |
| Nul, cote 2,9–3,4                    |   507 |          30,4 % |       27,5 % |                       31,2 % |      3,21 |                        −2,9 % |                  10 |
| Nul, « edge » ≥ 5 pts                |   214 |      **14,0 %** |       26,4 % |                       18,3 % |      6,33 |                       −22,7 % |                  23 |
| Nul, canal DRAW                      |   734 |          28,3 % |       29,7 % |                            — |      3,40 |       −4,8 % (jouable −7,7 %) |                  18 |
| **Score exact, canal CORRECT_SCORE** | 2 525 |          10,9 % |       12,6 % |                            — |      8,01 | **−19,7 % (jouable −26,0 %)** |              **57** |
| Score exact, avis IA                 |    17 |             0 % |       15,8 % |                            — |      7,41 |                        −100 % |                  17 |

**Lecture :**

- **Aucune version de la chasse n'est rentable sur la période.** Les meilleures, le Nul à cote 2,9–3,4 et le Plus de 3,5 avec un λ élevé, perdent environ 3 à 5 %. Ces chiffres valent à la cote de référence ; ils sont pires chez le bookmaker local.
- **La cote du marché est plus juste que le moteur** sur ces quatre marchés, ce qui recoupe l'audit de septembre.
- **Filtrer sur l'« edge » est la pire idée** : là où le moteur se croit le plus en avance sur le marché (+5 points ou plus), il se trompe le plus. Le Plus de 3,5 tombe à 26 % de réussite pour 37 % annoncés, le Nul à 14 % pour 26 %.
- **Le score exact détruit la mise** : −20 % à −26 %, et une série de 57 pertes d'affilée. C'est aussi le seul de ces marchés où le moteur est clairement surconfiant (10,9 % réels pour 12,6 % annoncés).
- **Le moteur sous-estime le Plus de 3,5 buts** (33,4 % réels pour 28,8 % annoncés). C'est pour cela que le canal GOALS ne le sélectionne presque jamais. Le marché, lui, l'estime correctement.
- **Les séries perdantes sont le vrai problème pour un joueur** : 10 à 23 pertes d'affilée sur le Nul, 57 sur le score exact. Un débutant abandonne, ou double ses mises pour « se refaire ».

### Recommandation sur la chasse

- **Ne pas en faire un produit mis en avant**, et surtout **ne pas la proposer en combiné** : cumuler des marges de 5 à 10 % sur des cotes de 3 à 8 donne des ROI de −30 à −50 %.
- **Si vous voulez un espace « pari plaisir »**, en faire un bloc séparé et clairement étiqueté. Il devrait comporter : la fréquence réelle (« gagne environ 1 fois sur 4 » pour le Nul, « 1 fois sur 10 » pour le score exact), la pire série perdante observée, une mise suggérée réduite (un quart d'unité au plus) et le ROI mesuré. **Retirer le score exact** de toute mise en avant.
- **Ce qui a de la valeur pour la marque, ce n'est pas la chasse mais sa démonstration** : publier ce tableau, c'est expliquer aux joueurs pourquoi les « coupons à grosse cote » des pronostiqueurs perdent, et c'est un excellent contenu de campagne (voir `03-PLAN-MARKETING.md`, série « Le mythe du coupon sûr »).

---

## 3. Synthèse pour le travail du week-end

| Question                                                             | Réponse courte                                                                                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coupon cote 2 qui gagne le plus souvent ?                            | Faisable, mais le plafond est d'environ 1 jour sur 2. Afficher des chances recalibrées. Tester en ombre la règle « marchés sous-annoncés + marge la plus basse » avant toute publication. |
| La chasse BTTS / nul / plus de 3,5 / score exact rapporterait-elle ? | Non sur 45 jours : de −3 % à −26 %, avec des séries de 10 à 57 pertes. Au mieux un bloc « pari plaisir » encadré, sans score exact.                                                       |
| Filtrer sur l'edge pour trouver les bonnes cotes longues ?           | À proscrire : c'est le filtre le plus perdant, ce qui confirme l'audit du 22/08.                                                                                                          |
| Ce qu'il faut corriger d'abord                                       | Les chances affichées des coupons et des sélections, recalibrées par marché et par tranche de cote.                                                                                       |
