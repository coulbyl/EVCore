---
title: "Le canal BTTS (BB) : comment une liste de championnats se périme"
category: channels
difficulty: intermediate
order: 6
slug: btts-channel
summary: "BTTS a été misé sur les seuls championnats où son avantage tenait. Quelques mois plus tard, ces championnats-là étaient passés négatifs. C'est la leçon la plus utile de tout le catalogue sur la fragilité d'un découpage."
updatedAt: "2026-08-22"
related: ["channels-overview", "goals-channel", "team-total-channel"]
---

## Ce que ce canal cherche

BTTS (Both Teams To Score) identifie les matchs où le modèle juge probable que les deux équipes marquent. Marché à très fort volume, calculé à chaque match analysé.

## Le raisonnement d'origine, qui était bon

Le ROI agrégé de BTTS était proche de zéro — un chiffre trop fin pour en tirer quoi que ce soit. Mais en le découpant par championnat, un clivage net apparaissait : quelques ligues nettement positives, la plupart négatives.

La démarche était sérieuse. Le découpage a été validé sur deux périodes distinctes — une moitié pour établir la règle, l'autre pour la vérifier — et seuls les championnats positifs **dans les deux moitiés** ont été retenus. Un championnat qui changeait de signe entre les deux a été écarté pour cette raison précise.

C'est plus rigoureux que ce qui se fait habituellement. Et ça n'a pas suffi.

## Ce qui s'est passé ensuite

Remesurés quelques mois plus tard, les deux championnats retenus étaient passés **négatifs** tous les deux. Celui qui avait été écarté pour instabilité l'était aussi.

Aucune erreur de calcul n'explique ça. Le découpage par championnat multiplie les cases, et chaque case est petite : quelques centaines de paris. À cette taille, l'écart entre les cases est majoritairement du bruit d'échantillonnage, pas une différence réelle entre les championnats. Retenir les meilleures cases revient à retenir les cases qui ont eu de la chance — et la chance ne se reconduit pas.

## Ce que ça change pour la lecture

Un découpage fin donne une impression de précision. « Ce canal marche en Bundesliga » sonne plus scientifique que « ce canal marche ». C'est souvent l'inverse : plus le découpage est fin, plus la part de bruit augmente, et plus le résultat est fragile.

La règle qui en sort, valable bien au-delà de BTTS : **un résultat trouvé en découpant l'historique demande beaucoup plus de preuves qu'un résultat trouvé sur l'ensemble.** Un test sur deux périodes ne suffit pas si les cases sont petites.

## Où en est le canal

BTTS reste misé sur ces deux championnats à ce jour. La mesure qui vient d'être décrite lit l'historique au lieu de rejouer le pipeline complet — le même défaut que celle qui avait produit la liste. Retirer une règle de mise sur une mesure dont on connaît le défaut reproduirait l'erreur qu'on vient de décrire, donc rien n'a été changé en attendant un test propre.

Le risque est assumé et écrit. Le chiffre à jour du canal est dans Track Record.

## À retenir

- Le découpage par championnat semblait rigoureux — validé sur deux périodes — et s'est quand même périmé.
- Plus un découpage est fin, plus les cases sont petites, et plus l'écart entre elles est du bruit.
- Retenir les meilleures cases, c'est souvent retenir celles qui ont eu de la chance.
- Un résultat obtenu en découpant exige plus de preuves qu'un résultat obtenu sur l'ensemble.
