# Script vidéo — L'edge et l'EV (compagnon de l'article `ev-probabilites-cotes`)

Durée cible : `2 min 30 à 3 min`
Public : a vu la leçon précédente sur cote/probabilité implicite/calibrée.
Note prod : montrer les deux formules à l'écran (edge, puis EV), puis un exemple simple de tri par EV brut vs edge calibré avec les vrais chiffres VALUE.

## Ouverture

Deux chiffres décident si un pick mérite d'être misé : l'edge, et l'EV. Voici comment ils se calculent, et pourquoi il existe un seuil.

## Edge et EV, deux angles du même écart

L'edge, c'est simple : la probabilité calibrée moins la probabilité implicite, en points de pourcentage. Un edge de plus 10 points veut dire que le modèle estime la probabilité 10 points au-dessus du marché.

L'EV, c'est le même écart traduit en rendement attendu : probabilité calibrée fois cote, moins un. Un EV de plus 8% veut dire que chaque unité misée rapporte en moyenne 0,08 unité — en moyenne sur beaucoup de paris, jamais sur un pari isolé.

## Pourquoi un seuil, et pas n'importe quel EV positif

EVCore n'affiche un pick VALUE qu'à partir d'un EV de 8% ou plus. Deux raisons : le modèle n'est jamais parfait, et un EV trop fin peut disparaître entièrement dans le bruit statistique. Le seuil filtre mécaniquement les picks les plus fragiles.

## Le point le plus contre-intuitif

Voici ce qui surprend le plus : classer les picks VALUE par EV brut n'est pas la meilleure méthode. Sur les données réelles d'EVCore, le top 5 classé par edge calibré tient à plus 2,27% sur des données jamais vues par le modèle. Le même canal, classé par probabilité brute, tombe à moins 12,70% sur les mêmes données.

Pourquoi ? Un EV élevé peut venir d'une vraie divergence d'analyse — ce qu'on veut capter — ou d'une cote généreuse sur un match où le modèle se trompe. Le classement par edge calibré filtre mieux le deuxième cas. C'est pour ça que le Coupon Composer et la page Investir n'utilisent jamais le tri par EV brut.

## Ce que ces chiffres ne disent pas

Un EV positif n'est pas une garantie sur un pari donné — c'est une moyenne statistique. Et un canal peut rester rentable en moyenne tout en perdant plusieurs paris d'affilée : c'est la variance, pas un échec du modèle.

## Clôture

Edge, c'est l'écart de probabilité. EV, c'est le rendement attendu. Le seuil filtre les picks fragiles. Et trier par edge calibré protège mieux que trier par EV brut — ce n'est pas une préférence, c'est un résultat mesuré.
