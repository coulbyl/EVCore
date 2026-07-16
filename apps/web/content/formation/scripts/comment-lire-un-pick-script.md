# Script vidéo — Comment lire une fiche EVCore (compagnon de l'article `comment-lire-un-pick`)

Durée cible : `2 min 30 à 3 min`
Public : a déjà vu le tableau de bord, découvre la page Décisions pour la première fois.
Note prod : filmer un vrai écran de la page `/dashboard/decisions`, idéalement sur un match qui a une décision SELECTED, une décision REJECTED, et si possible un bandeau Attention visible sur un autre match de la même liste.

## Ouverture

Une fiche EVCore n'est jamais juste un conseil isolé — chaque élément affiché correspond à un calcul précis. Cette vidéo vous montre comment lire une carte de pick en moins de trois minutes.

## L'en-tête du match

En haut de chaque carte : les deux équipes, la compétition, l'heure du coup d'envoi. Rien de spécial ici — c'est le repère du match.

## La ligne de canal

En dessous, une ligne par canal qui a pris une décision sur ce match. Regardons un exemple réel : Lahti contre HJK Helsinki, le 11 juillet 2026.

Sur la première ligne, en gras : **Domicile** — c'est le pick lui-même. À droite, un badge de résultat : ici, vert, **Gagné**, parce que ce match est déjà terminé et réglé.

En dessous, en plus petit : le badge du canal, coloré — ici **Valeur** — puis le marché entre parenthèses, ici 1X2. Ensuite trois chiffres, toujours dans le même ordre : la probabilité calibrée, 58%, la cote, 3.11, en gras, et l'EV, ici largement positif.

C'est exactement la structure qu'on a vue dans la leçon sur l'edge et l'EV : la cote est le prix du marché, la probabilité est l'estimation du moteur, et l'EV est l'écart entre les deux, traduit en rendement attendu.

## Quand il n'y a pas de pick

Tous les matchs n'ont pas de ligne verte. Sur un match où aucun canal n'a de conviction suffisante, vous verrez une ligne grisée avec un statut — par exemple **Écarté** — et une raison affichée juste à côté, comme "Probabilité sous le seuil". Un survol de la carte affiche le détail complet.

Ce n'est pas un bug ni un manque de données. C'est le filtre qui fonctionne exactement comme prévu — la leçon sur les canaux revient en détail sur pourquoi la majorité des matchs n'ont, volontairement, aucun pick.

## Les bandeaux d'alerte

Sur certains matchs, un bandeau apparaît au-dessus de l'en-tête, avant même la liste des canaux. Un bandeau **Attention** signale qu'un canal a été explicitement écarté à cause d'un écart jugé trop important entre le modèle et le marché. Un bandeau **Données suspectes** va plus loin : il indique que le moteur exclut automatiquement toutes les décisions sur ce match des paris réels, parce que le désaccord entre le modèle et le marché est jugé trop extrême pour être fiable.

Ces bandeaux ne sont pas des erreurs à ignorer — ce sont des garde-fous qui font exactement ce pour quoi ils ont été conçus : vous protéger d'un pick sur un match où le modèle lui-même n'a pas confiance dans ses propres données.

## Le badge Consensus

Parfois, plusieurs canaux indépendants arrivent à la même conclusion sur un même match. Dans ce cas, un badge **Consensus** apparaît dans l'en-tête de la carte, avec la liste des canaux qui convergent — un signal renforcé, mais qui reste soumis aux mêmes règles de lecture que les autres : cote, probabilité, edge, jamais un seul chiffre isolé.

## Clôture

Trois choses à retenir en repartant : le canal indique quelle question a été posée au match, les trois chiffres — cote, probabilité, EV — se lisent toujours ensemble, et l'absence de pick ou un bandeau d'alerte sont des résultats normaux du filtre, pas un problème à contourner.
