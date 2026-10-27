# Décisions : des paris, pas des canaux

_Étape 5 du plan produit, branche `feat/produit-ux`, du 27/10/2026. Pas de revue isolée cette fois : la direction a été proposée puis validée par l'utilisateur le jour même, sur mesures. Les deux détecteurs mesurent avant et après. Captures dans `captures/decisions-avant` et `captures/decisions-apres`, sorties brutes dans `scripts/dc-*.json`. Faux backend (`E2E_ROLE=OPERATOR`) : trois matchs, dont un à six lectures et un « Données suspectes »._

## La décision du 27/10

Question posée par les deux revues précédentes : le joueur doit-il voir les « canaux » ? Réponse validée : **on cache le mot, pas l'information.** Le joueur lit des types de pari, qu'il connaît déjà chez son bookmaker. Les écrans admin et moteur gardent les canaux.

Ce qui l'a décidé, sur la copie de production (30 derniers jours) :

- Un canal correspond à un seul marché, sauf Victoire et Nul (tous deux sur le 1X2) et l'avis IA (sa propre page). Le nom du canal répétait le type de pari dans un vocabulaire à apprendre.
- Un match affiche en moyenne **9,5 lectures** (médiane 10, jusqu'à 14). Dans **27 % des matchs** (562 sur 2 046), deux lectures ne peuvent pas passer ensemble : « les deux équipes marquent » à côté de « clean sheet » ou « gagne sans encaisser » (525 matchs), Victoire à côté de Nul (51). La confusion venait du nombre de lignes sans hiérarchie, pas de leur nom.
- À cote égale, aucun canal ne se distingue (CLAUDE.md : couper sur la cote, jamais sur le canal). La fiabilité d'un canal dans un championnat ne se maintient pas d'une période à l'autre (corrélation 0,06). C'est pourtant sur elle que reposait le badge « Fiable » (52 matchs sur 54 le 23/10, audit P2-12).

## Ce qui est fait

| Commit     | Correction                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cb74021f` | `formatPickWithTeams` : « Victoire Arsenal », « Burnley ou nul », « Arsenal n'encaisse pas », « Plus de 1,5 but », « Victoire Arsenal et plus de 2,5 buts », sur tous les marchés. Fréquence et format des cotes partagés (`lib/frequency.ts`).                                                                                                                                                                                   |
| `96eb54ab` | Décisions : chaque lecture nommée avec les équipes, en fréquence, cote 1xBet d'abord. **Plus de « Fiable »** : à sa place, une note tirée du relevé par cote, seulement quand nos pourcentages ont été optimistes à cette cote. « Les autres lectures du match » ; **une phrase quand deux lectures se contredisent**. Filtres « Type de pari ». Titre pour lecteurs d'écran, bouton Filtres et dépliage à 44 px, textes à 12 px. |
| `7bd3ad1d` | Textes du joueur : tour guidé, « Types de pari suivis » dans les paramètres, catégorie de formation, sous-titre de l'accueil, Mesures historiques « Par type de pari ».                                                                                                                                                                                                                                                           |
| `408626b3` | Carte coupon et sélections de l'accueil : mêmes libellés, même fréquence, même note par cote (l'ancienne phrase fixe à 1,80 disparaît).                                                                                                                                                                                                                                                                                           |
| `f92d6550` | Accueil : « Hier » et le lien du coupon long en cotes françaises.                                                                                                                                                                                                                                                                                                                                                                 |
| `6508b803` | Bandeau « Données suspectes » au contraste AA en clair (3,7:1 → rouge 700) ; icône d'info ouvrable au doigt.                                                                                                                                                                                                                                                                                                                      |

La note par cote lit `GET /dashboard/track-record-summary` sur 90 jours, la même source que Mesures historiques. Sur la copie de production, elle ne s'affiche qu'au-dessus de 1,80 : sur 100 pronostics annoncés à 32 %, 26 sont passés. Sous 1,80, les tranches sont conformes et la ligne ne dit rien.

## Mesures avant → après

| Mesure (`/dashboard/decisions`)      | 375 sombre | 375 clair | 1280 sombre | 1280 clair |
| ------------------------------------ | ---------: | --------: | ----------: | ---------: |
| impeccable, éléments signalés        |     21 → 5 |    21 → 4 |      20 → 4 |     22 → 5 |
| Textes sous 12 px (détecteur maison) |     16 → 0 |    16 → 0 |      19 → 3 |     19 → 3 |
| Contrastes insuffisants              |      0 → 0 |     1 → 0 |       0 → 0 |      1 → 0 |
| Cibles sous 44 px                    |      6 → 1 |     6 → 1 |     21 → 17 |    21 → 17 |
| Titre de page (`h1`)                 |      0 → 1 |     0 → 1 |       0 → 1 |      0 → 1 |

Restes : sur téléphone, l'icône d'info (zone de toucher élargie par un pseudo-élément que le détecteur ne voit pas) ; sur grand écran, la barre latérale (liens de 36 px à la souris, libellés de groupe à 11 px en capitales).

Avant le travail, le faux backend ne connaissait ni la vue par match ni les filtres : la page plantait sur les captures. Il a maintenant trois matchs représentatifs, et `e2e/decisions.spec.ts` vérifie le libellé avec les équipes, la fréquence, l'absence de « Fiable », la phrase sur les contradictions et la note par cote.

## Restes

1. **Avis IA** garde le badge de calibration par championnat (`CalibrationBadge`, `arbitrage-card.tsx`) : à traiter à l'étape Avis IA, avec la même logique par cote.
2. Le choix de « Notre sélection » (`primaryPick`) utilise encore la calibration canal × championnat comme premier critère. Sa calibration mesurée tient (76,9 % réalisés pour 78,6 % annoncés, du 9 au 22/10) : on n'y touche pas sans rejeu.
3. Les articles de formation par canal (« Le canal DRAW »…) sont à renommer en types de pari.
4. Page Paramètres : la carte « Types de pari suivis » a changé de texte, pas de logique ; elle suit toujours des codes de canal en base.
