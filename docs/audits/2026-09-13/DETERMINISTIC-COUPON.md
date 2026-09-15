# Expérience — composeur de coupon déterministe

Statut : **candidat rejeté pour remplacement en production**. Le générateur
LLM existant et sa politique `unified-5-15-v1` restent actifs et inchangés.

## Politique candidate figée avant mesure

Version : `deterministic-5-15-v1`.

- aucun appel réseau, horloge, aléa ou sortie LLM ;
- VANTAGE exclu du vivier, afin qu'aucune sélection du coupon ne provienne
  d'une IA ;
- mêmes bornes produit : 2 à 5 jambes, cote combinée de 5 à 15, EV positive
  par jambe et au niveau du coupon, mêmes garde-fous par jambe et
  anti-corrélations ; le signal AVOID reste un filtre amont du vivier live ;
- vivier borné de façon stable : 30 meilleures probabilités calibrées et 20
  meilleures EV par jambe, puis déduplication ;
- objectif fixé avant le rejeu : maximiser la probabilité jointe, puis l'EV du
  coupon, puis préférer le coupon avec le moins de jambes ;
- abstention quand aucune combinaison admissible n'existe.

Le code pur vit dans `packages/analysis-core` et sert directement au rejeu :
le backtest ne réimplémente pas le classement du composeur.

## Premier rejeu chronologique

Période : 1er juillet au 13 septembre 2026, soit 75 journées. Pour chaque
journée, le vivier ne contient que les runs, décisions et sélections créés
avant minuit UTC. La calibration utilise uniquement les résultats réglés avant
ce même cutoff. Le split chronologique est fixé à 60 % / 40 %.

| Segment         | Coupons réglés | Gagnés | Perdus | Réussite |     ROI |
| --------------- | -------------: | -----: | -----: | -------: | ------: |
| Global          |             69 |     13 |     56 |   18,8 % |  −3,8 % |
| Train 60 %      |             39 |      8 |     31 |   20,5 % |  +8,7 % |
| Validation 40 % |             30 |      5 |     25 |   16,7 % | −20,1 % |

Le coupon moyen contient 2,74 jambes pour une cote de 5,52. Cinq journées
aboutissent à une abstention et une reste non résolue. L'intervalle à 95 % du
ROI global est très large, de −51,6 % à +44,0 %.

**Décision : ne pas remplacer le générateur LLM.** Le résultat positif de la
partie train disparaît sur la période de validation. Modifier les règles à
partir de ces 30 journées puis les mesurer sur ces mêmes journées constituerait
un surajustement.

## Limites à lever avant une nouvelle comparaison

- Le rejeu utilise les décisions historiques enregistrées ; il ne recalcule
  pas encore le moteur actuel sur les anciennes rencontres.
- Les anciennes sélections n'ont pas de lien immuable vers le snapshot exact
  de cote ; leur cote enregistrée est donc utilisée.
- Les marchés évalués mais non retenus au rang 1 ne font pas partie de ce
  premier vivier.
- Ce premier chargeur historique ne reconstruit pas les anciens signaux AVOID
  et les révisions passées de date de rencontre ne sont pas historisées.
- Les 30 journées de validation ne suffisent pas à produire un intervalle
  étroit pour un coupon coté entre 5 et 15.

Rapports complets :

- `packages/backtest-core/reports/deterministic-coupon-2026-07-01-2026-09-13.md`
- `packages/backtest-core/reports/deterministic-coupon-2026-07-01-2026-09-13.json`

Commande reproductible, avec `DATABASE_URL` fourni explicitement par
l'environnement d'exécution :

```bash
pnpm --filter @evcore/backtest-core backtest:deterministic-coupon -- \
  --from 2026-07-01 --to 2026-09-13
```
