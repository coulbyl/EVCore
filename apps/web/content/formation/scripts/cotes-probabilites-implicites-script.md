# Script vidéo — Cote, probabilité implicite, probabilité calibrée (compagnon de l'article `cotes-probabilites-implicites`)

Durée cible : `2 min à 2 min 30`
Public : découvre EVCore, aucune notion préalable de paris sportifs supposée.
Note prod : appui visuel simple — une cote affichée à l'écran, une conversion en pourcentage animée, puis deux colonnes "marché" vs "EVCore" pour la comparaison finale.

## Ouverture

Une cote n'est pas une prédiction. C'est un prix. Et comprendre cette différence, c'est la base de tout ce qu'EVCore fait.

## Convertir une cote en probabilité

Quand un bookmaker affiche une cote de 2.00, il ne dit pas "50% de chances". Il dit "voici le prix auquel j'accepte ce pari en face". Pour la transformer en probabilité, une seule formule : un divisé par la cote. 2.00 devient 50%. 1.50 devient 66,7%.

Plus la cote est basse, plus le marché juge l'issue probable.

## Pourquoi ça dépasse toujours 100%

Additionnez les probabilités implicites de toutes les issues d'un même marché, et vous dépassez presque toujours 100% — 104, parfois plus. Cet excédent, c'est la marge du bookmaker, intégrée dans chaque cote. Ce n'est pas une erreur de calcul : c'est le prix de fonctionnement du marché, et ça veut dire qu'une cote "juste" n'existe pas au sens strict.

## Ce qu'EVCore calcule à part

EVCore ne s'arrête pas à cette lecture du marché. Le moteur calcule sa propre estimation — la probabilité calibrée — à partir de données historiques : forme des équipes, xG, confrontations passées. "Calibrée" veut dire une chose précise : quand le modèle annonce 70% sur un ensemble de picks, ces picks se réalisent environ 70% du temps sur un grand nombre d'observations. Pas juste un chiffre qui semble sérieux — un chiffre qui tient dans la durée.

## L'écart, pas les deux chiffres séparément

Voici l'idée centrale : on ne mise jamais sur une probabilité implicite seule. On mise sur l'écart entre ce que le modèle estime et ce que le marché affiche. Deux matchs peuvent avoir la même cote — si le modèle est d'accord avec le marché sur l'un, il n'y a rien à exploiter. Si le modèle voit une probabilité nettement plus haute sur l'autre, cet écart-là s'appelle l'edge — le sujet de la prochaine leçon.

## Clôture

Une cote se convertit avec un divisé par la cote, mais elle inclut toujours la marge du bookmaker. La probabilité calibrée, c'est l'estimation propre d'EVCore. Et ce n'est jamais l'un ou l'autre qui compte — c'est l'écart entre les deux.
