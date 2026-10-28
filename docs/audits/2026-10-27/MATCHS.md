# Matchs : une fiche de match pour le joueur, le diagnostic pour les admins

_Étape 8 du plan produit, branche `feat/produit-ux`, du 27/10/2026. Revue isolée (14/40, la note la plus basse des pages revues) ; recommandation validée par l'utilisateur le jour même. Captures dans `captures/matchs-avant` et `captures/matchs-apres`, sorties des détecteurs dans `scripts/ma-*.json`._

## Ce que la revue a trouvé

- **L'EV mis en avant.** Une carte « Valeur (EV) » et un EV coloré vert ou rouge sur chaque lecture, alors qu'il est anti-prédictif (CLAUDE.md). Le badge vert « Viable » portait sur 2 390 lectures, dont 2 387 à une cote au-dessus de 1,80, là où nos pourcentages ne tiennent pas.
- **Un panier qui contournait les garde-fous.** Il ajoutait au coupon n'importe quelle ligne, à notre cote de référence. Cela incluait une lecture d'un marché suspendu (15 % des lignes) ou rejetée pour chances insuffisantes (51 %).
- **Un écran vide depuis le 04/09.** Le pari retenu, « Prob. estimée », « Valeur (EV) » et le bouton d'ajout venaient de la table des paris internes, qui n'est plus écrite. Chaque match affichait « Aucun marché ne répond aux critères » au-dessus de « 2 viables ».
- **Un doublon de Décisions.** Décisions montre déjà 1 984 des 1 996 matchs des 30 derniers jours, avec Notre sélection et les autres lectures. Matchs n'ajoutait que les facteurs, les buts attendus et les lectures écartées, noyés dans environ 94 lignes par match.
- Un tiroir « Réussite par marché » qui disait « concentre ta mise là où le ROI est positif », en euros.

## Ce qui est fait

| Commit     | Changement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9ce25690` | « Matchs » sort de la navigation du joueur (un joueur est redirigé vers Décisions) et du tour guidé. Les admins gardent le diagnostic brut : facteurs, λ, toutes les lectures avec EV et motif, en ton neutre. **Plus de panier.** Tout ce qui lisait la table des paris internes est retiré de bout en bout (DTO backend, types, bandeau, cartes vides). La saisie manuelle du résultat redevient disponible pour les admins. Le tiroir « Réussite par marché » ne parle plus de miser là où le ROI est positif. |
| `4aca9e81` | **Fiche de match**, ouverte par « Pourquoi ? Voir la fiche du match » sur chaque carte de Décisions (`/dashboard/decisions/match/[id]`, backend `GET /fixture/:id/sheet`). Elle montre ce que le modèle attend avec le nom des équipes, les facteurs en mots, et tout ce que le moteur a écarté, groupé par type de pari, replié, chaque ligne avec son motif en clair. Pas d'EV, pas de « Viable », pas de panier. Rien n'est filtré ni classé.                                                                  |

### La fiche, ligne par ligne

- « Arsenal environ 1,6 but, Burnley environ 0,9 but : 2,6 buts en moyenne. Une moyenne, pas un score annoncé. »
- Forme récente, occasions créées, domicile et extérieur : « avantage Arsenal », « équilibré » ou « avantage Burnley ». Le championnat est « plutôt régulier », « dans la moyenne » ou « plutôt imprévisible ». Dans l'ancien écran, l'indicateur « Stabilité de la ligue » mesurait en réalité l'imprévisibilité.
- Lectures écartées, par exemple : « Les deux équipes marquent · environ 6 fois sur 10 · cote 1,85 · notre estimation est trop proche de la cote ». Les motifs sont réécrits pour le joueur, par exemple « type de pari suspendu : il a trop perdu ces derniers mois ».

| Mesure (impeccable, éléments signalés) | 375 sombre | 375 clair | 1280 sombre | 1280 clair |
| -------------------------------------- | ---------: | --------: | ----------: | ---------: |
| Ancienne liste Matchs                  |          6 |         5 |           2 |          3 |
| Fiche de match                         |          4 |         3 |           3 |          4 |

La fiche a un `h1` et des sections titrées : quatre titres, contre aucun sur l'ancienne liste. Aucun contraste insuffisant, aucune cible sous 44 px sur téléphone. Sur grand écran, ce qui reste vient de la barre latérale. Les mesures du panneau d'origine ne sont pas comparables : c'était un tiroir, désormais réservé aux admins.

## Tests

`e2e/match-sheet.spec.ts` ouvre la fiche depuis Décisions, vérifie les buts attendus, les facteurs, une lecture écartée, et l'absence d'EV et de « Viable ». Il vérifie aussi qu'un joueur qui ouvre Matchs arrive sur Décisions. La passe complète (Coupons, Décisions, Avis IA, Formation, fiche) est verte. Seules échouent, sous le faux backend en rôle joueur, les pages réservées aux admins (`audit`, `fixtures`). Elles passent avec le rôle admin, celui par défaut des tests.

## Restes

- Les lignes « Marché suspendu » apparaissent dans la fiche comme preuve qu'on s'abstient. À revoir si le joueur trouve la liste trop longue.
- « Viable » ne nourrit plus aucun canal depuis le 03/09. Côté admin, il faudra peut-être le remplacer par le seul motif de rejet.
