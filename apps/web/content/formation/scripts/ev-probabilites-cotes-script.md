# Script vidéo — L'edge et l'EV (compagnon de l'article `ev-probabilites-cotes`)

Durée cible : `2 min 30 à 3 min`
Public : a vu la leçon précédente sur cote/probabilité implicite/calibrée.
Note prod : montrer les deux formules à l'écran (edge, puis EV), puis le tableau par tranche d'edge — laisser la colonne « réel » à l'écran pendant qu'elle est commentée, c'est elle qui porte la démonstration.

## Ouverture

Deux chiffres décident si un pick mérite d'être misé : l'edge, et l'EV. Voici comment ils se calculent, et pourquoi il existe un seuil.

## Edge et EV, deux angles du même écart

L'edge, c'est simple : la probabilité calibrée moins la probabilité implicite, en points de pourcentage. Un edge de plus 10 points veut dire que le modèle estime la probabilité 10 points au-dessus du marché.

L'EV, c'est le même écart traduit en rendement attendu : probabilité calibrée fois cote, moins un. Un EV de plus 8% veut dire que chaque unité misée rapporte en moyenne 0,08 unité — en moyenne sur beaucoup de paris, jamais sur un pari isolé.

## Pourquoi un seuil, et pas n'importe quel EV positif

EVCore n'affiche un pick VALUE, en français Valeur, qu'à partir d'un EV de 8% ou plus. Deux raisons : le modèle n'est jamais parfait, et un EV trop fin peut disparaître entièrement dans le bruit statistique. Le seuil filtre mécaniquement les picks les plus fragiles.

## Le point le plus contre-intuitif

Voici le résultat qui a tout changé. On a rangé 51 860 sélections réglées par tranche d'écart revendiqué, et comparé ce que chaque tranche annonçait à ce qu'elle a réalisé.

Quand le modèle price en dessous du marché, il réalise 6% de plus qu'annoncé. Entre 0 et 5 points d'écart, il réalise 91% de ce qu'il annonce. Entre 5 et 10 points, 81%. Entre 10 et 15, 76%. Entre 15 et 25, 68%. Au-delà de 25 points d'écart : 54%.

Regardez le taux réel, pas le rapport : il **descend**, de 51% à 37%, pendant que le taux annoncé monte de 48% à 70%.

Autrement dit : plus le modèle annonce un gros avantage, moins le pari passe. L'écart revendiqué ne dit rien du résultat. Il mesure l'ampleur de l'erreur du modèle.

Pourquoi ? Un gros écart a deux origines possibles. Soit le modèle a vu quelque chose que le marché a raté — ça existe, c'est rare. Soit le modèle s'est trompé, et le marché a raison la plupart du temps : c'est son métier. Trier par écart décroissant, ce n'est donc pas trier par qualité de lecture, c'est trier par distance au marché. Et la deuxième explication est bien plus fréquente que la première.

## Ce que ces chiffres ne disent pas

Un EV positif n'est pas une garantie sur un pari donné — c'est une moyenne statistique. Et un canal peut rester rentable en moyenne tout en perdant plusieurs paris d'affilée : c'est la variance, pas un échec du modèle.

## Clôture

Edge, c'est l'écart de probabilité. EV, c'est le rendement attendu. Les deux mesurent l'avantage que le modèle croit avoir, pas celui qu'il a. EVCore s'en sert désormais comme d'un plafond d'exclusion, et classe sur la probabilité calibrée. Un chiffre affiché sur un pick n'est pas forcément un critère de décision — celui-ci a mis trois ans à être démasqué.
