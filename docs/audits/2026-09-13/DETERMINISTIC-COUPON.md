# Expérience — composeur de coupon déterministe

Statut : **candidat `deterministic-5-7-v1` non validé pour remplacer le LLM,
placé en observation shadow prospective**. Le générateur LLM existant et sa
politique `unified-5-15-v1` restent actifs et inchangés.

## Baseline déterministe

Le premier composeur déterministe a été rejoué du 1er juillet au 13 septembre
2026 avec les bornes produit de 2 à 5 jambes et une cote combinée de 5 à 15.

| Segment         | Coupons réglés | Gagnés | Perdus | Réussite |     ROI |
| --------------- | -------------: | -----: | -----: | -------: | ------: |
| Global          |             69 |     13 |     56 |   18,8 % |  −3,8 % |
| Train 60 %      |             39 |      8 |     31 |   20,5 % |  +8,7 % |
| Validation 40 % |             30 |      5 |     25 |   16,7 % | −20,1 % |

Cette baseline est rejetée. Son résultat positif sur la première partie ne se
maintient pas sur la suite de la période. Son rapport historique complet est
conservé dans
`packages/backtest-core/reports/deterministic-coupon-2026-07-01-2026-09-13.*`.

## Recherche sur la fenêtre de développement

La recherche suivante utilise uniquement les journées du 1er juillet au
29 août 2026. Les 60 journées sont aussi découpées en trois blocs
chronologiques de 20 jours pour écarter les règles dont le résultat dépend
d'une seule partie de la fenêtre.

Le sweep compare 20 configurations structurelles pré-déclarées : nombre
maximal de jambes, plafond de cote du coupon, plafond de cote par jambe,
probabilité minimale et plafond d'edge positif. Il ne supprime pas des canaux
individuels à partir de petits sous-échantillons. Le candidat retenu n'est pas
la configuration au ROI global maximal : il est choisi pour la stabilité de
ses trois blocs et pour des contraintes plus conservatrices.

| Configuration                  | Coupons | ROI global | Bloc 1 | Bloc 2 | Bloc 3 |
| ------------------------------ | ------: | ----------: | -----: | -----: | -----: |
| Baseline 2–5 jambes, cote 5–15 |      54 |      +6,6 % | +1,7 % | +12,8 % | +4,3 % |
| **Candidat 2–3, cote 5–7**     |  **50** |  **+35,0 %** | **+32,8 %** | **+32,7 %** | **+39,0 %** |
| Variante edge maximal 9 points |      49 |     +36,4 % | +27,2 % | +33,8 % | +46,0 % |

Le rapport détaillé du candidat donne 13 coupons gagnés et 37 perdus, une cote
moyenne de 5,28 et 2,54 jambes par coupon. Son intervalle à 95 % pour le ROI
reste très large, de −29,2 % à +99,3 %. Le signal est donc assez cohérent pour
ouvrir le holdout, mais pas assez précis pour autoriser un remplacement en
production.

## Candidat figé

Version : `deterministic-5-7-v1`.

- aucun appel réseau, horloge, aléa ou sortie LLM ;
- VANTAGE exclu du vivier afin qu'aucune sélection ne provienne d'une IA ;
- 2 à 3 jambes et cote combinée de 5 à 7 ;
- EV positive par jambe et au niveau du coupon ;
- edge positif maximal de 7,5 points par rapport à la cote de référence ;
- mêmes garde-fous par jambe et anti-corrélations que la politique unifiée ;
- vivier stable composé des 30 meilleures probabilités calibrées et des 20
  meilleures EV par jambe, puis dédupliqué ;
- maximisation de la probabilité jointe, puis de l'EV du coupon, puis préférence
  pour le moins de jambes ;
- abstention si aucune combinaison admissible n'existe.

La période finale a été fixée au **30 août–13 septembre 2026**. La baseline
historique couvrait déjà ces dates, mais la configuration candidate n'avait pas
été exécutée sur ces 15 journées pendant sa sélection. Le candidat a été figé
dans le commit `5fbbc17a` avant son unique exécution sur cette période.

## Évaluation finale

| Période finale | Coupons réglés | Gagnés | Perdus | Abstentions | Réussite | ROI |
| -------------- | -------------: | -----: | -----: | ----------: | -------: | --: |
| 30 août–13 septembre | 12 | 2 | 10 | 3 | 16,7 % | −6,9 % |

La cote moyenne est 5,28. Les probabilités du composeur annonçaient environ
3,05 coupons gagnants sur ces 12 essais ; deux ont gagné. L'intervalle à 95 %
du ROI va de −130,6 % à +116,9 %. Cette fenêtre ne démontre ni une panne nette
de la règle ni sa rentabilité, mais elle échoue au critère minimal d'un ROI
final positif. Le candidat ne remplace donc pas le générateur LLM.

## Observation prospective

Le worker exécute désormais le candidat en parallèle sur le même vivier scoré,
avant la composition LLM. Il inscrit une tentative append-only sous la version
`deterministic-5-7-v1`, avec ses jambes, probabilités et cotes dans `metadata`.
Il ne crée jamais de `CouponProposal` et ne change jamais le coupon présenté
aux utilisateurs. Une erreur d'enregistrement shadow est journalisée sans
bloquer la voie LLM.

Le shadow exclut VANTAGE et les marchés évalués sans `ChannelSelection`, comme
le backtest qui a servi à figer le candidat. Les résultats prospectifs sont
reproductibles avec `deterministic-shadow-scorecard.sql`. Une nouvelle décision
demande une fenêtre prospective suffisamment longue, étudiée sans retoucher
`deterministic-5-7-v1`.

## Limites du rejeu

- Le rejeu utilise les décisions historiques enregistrées ; il ne recalcule
  pas le moteur actuel sur les anciennes rencontres.
- Les anciennes sélections n'ont pas de lien immuable vers le snapshot exact
  de cote ; leur cote enregistrée est utilisée.
- Les marchés évalués mais non retenus au rang 1 ne font pas partie du vivier.
- Le chargeur ne reconstruit pas les anciens signaux AVOID et les révisions
  passées de date de rencontre ne sont pas historisées.
- Cinquante coupons de développement et quinze journées finales ne permettent
  pas d'établir seuls une rentabilité statistiquement robuste.

Rapports de développement :

- `packages/backtest-core/reports/deterministic-coupon-sweep-2026-07-01-2026-08-29.json`
- `packages/backtest-core/reports/deterministic-coupon-candidate-max3-odds7-edge075-2026-07-01-2026-08-29.md`
- `packages/backtest-core/reports/deterministic-coupon-candidate-max3-odds7-edge075-2026-07-01-2026-08-29.json`
- `packages/backtest-core/reports/deterministic-coupon-candidate-max3-odds7-edge075-2026-08-30-2026-09-13.md`
- `packages/backtest-core/reports/deterministic-coupon-candidate-max3-odds7-edge075-2026-08-30-2026-09-13.json`

Commandes reproductibles, avec `DATABASE_URL` fourni explicitement par
l'environnement d'exécution :

```bash
pnpm --filter @evcore/backtest-core backtest:deterministic-coupon -- \
  --from 2026-07-01 --to 2026-08-29 --sweep

pnpm --filter @evcore/backtest-core backtest:deterministic-coupon -- \
  --from 2026-07-01 --to 2026-08-29 --config candidate
```
