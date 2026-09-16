# Handicap asiatique — le biais favori s'y retrouve-t-il ?

Régénérable : `pnpm --filter @evcore/backtest-core backtest:asian-handicap`
(collecte préalable : `collect:asian-handicap`).

## Périmètre

1240 rencontres collectées, dont **467 servant le marché**,
sur **15 jours** du 2026-08-30 au 2026-09-13.
9058 jambes cotées chez Pinnacle, lignes complètes
uniquement — une ligne dont un seul côté est servi est écartée, normaliser sur
une issue unique donnerait une probabilité de 1.

⚠️ **L'unité indépendante est la rencontre, pas la jambe.** Une rencontre sert
une dizaine de jambes — plusieurs lignes, deux côtés — qui gagnent et perdent
ensemble. Tous les intervalles ci-dessous sont **groupés par rencontre** ; lus
au niveau de la jambe, ils seraient environ trois fois trop étroits et
fabriqueraient une significativité inexistante. La fenêtre collectée est courte
(15 jours) : aucune conclusion ne peut y survivre seule.

Marge moyenne du marché : **3.98 %** par jambe, à comparer
aux 4,5 % du Match Winner.

Le règlement traite les remboursements de ligne entière et la scission des
quarts de ligne. Le « retour réel » est une espérance de gain par unité misée,
pas un taux de réussite : sur ce marché les deux ne coïncident pas.

## Toutes périodes

| Cote | Jambes | Rencontres | Cote moy | Implicite | Retour attendu | Retour réel | Écart (pts) | ROI | ± 95 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a. < 1.50 | 2566 | 466 | 1.33 | 72.5 % | 0.9590 | 0.9954 | +2.74 | -0.46 % | 2.54 % |
| b. 1.50-1.75 | 1281 | 466 | 1.61 | 60.0 % | 0.9636 | 0.9777 | +0.88 | -2.23 % | 2.65 % |
| c. 1.75-1.95 | 700 | 454 | 1.84 | 52.6 % | 0.9681 | 0.9915 | +1.27 | -0.85 % | 3.52 % |
| d. 1.95-2.15 | 641 | 438 | 2.04 | 47.4 % | 0.9679 | 0.9455 | -1.10 | -5.45 % | 4.33 % |
| e. 2.15-2.50 | 863 | 453 | 2.32 | 41.7 % | 0.9634 | 0.9380 | -1.10 | -6.20 % | 3.80 % |
| f. 2.50+ | 3007 | 466 | 3.45 | 28.9 % | 0.9600 | 0.8879 | -2.09 | -11.21 % | 6.41 % |

L'« écart » est la différence entre retour réel et retour attendu, ramenée en
points de probabilité pour être comparable au **+2,4 pt** mesuré sous la cote
1,25 sur le 1X2.

## Avant 2026-09-12

| Cote | Jambes | Rencontres | Cote moy | Implicite | Retour attendu | Retour réel | Écart (pts) | ROI | ± 95 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a. < 1.50 | 667 | 120 | 1.33 | 72.4 % | 0.9580 | 1.0111 | +4.00 | 1.11 % | 5.10 % |
| b. 1.50-1.75 | 340 | 120 | 1.61 | 60.0 % | 0.9628 | 0.9774 | +0.91 | -2.26 % | 5.43 % |
| e. 2.15-2.50 | 224 | 118 | 2.31 | 41.7 % | 0.9627 | 0.9242 | -1.67 | -7.58 % | 7.44 % |
| f. 2.50+ | 786 | 120 | 3.44 | 29.0 % | 0.9592 | 0.8585 | -2.93 | -14.15 % | 13.01 % |

## À partir de 2026-09-12

| Cote | Jambes | Rencontres | Cote moy | Implicite | Retour attendu | Retour réel | Écart (pts) | ROI | ± 95 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a. < 1.50 | 1899 | 346 | 1.33 | 72.5 % | 0.9594 | 0.9899 | +2.30 | -1.01 % | 2.94 % |
| b. 1.50-1.75 | 941 | 346 | 1.61 | 60.0 % | 0.9638 | 0.9779 | +0.87 | -2.21 % | 3.03 % |
| c. 1.75-1.95 | 514 | 335 | 1.84 | 52.6 % | 0.9681 | 0.9818 | +0.74 | -1.82 % | 4.16 % |
| d. 1.95-2.15 | 474 | 324 | 2.04 | 47.4 % | 0.9681 | 0.9585 | -0.47 | -4.15 % | 5.11 % |
| e. 2.15-2.50 | 639 | 335 | 2.32 | 41.7 % | 0.9637 | 0.9429 | -0.90 | -5.71 % | 4.42 % |
| f. 2.50+ | 2221 | 346 | 3.45 | 28.9 % | 0.9603 | 0.8983 | -1.80 | -10.17 % | 7.36 % |

## Lecture

Le biais du 1X2 est **monotone** : favorable aux cotes courtes, défavorable
aux longues. Sur un marché à deux issues symétriques comme le handicap
asiatique, un biais de même nature se lirait comme un écart positif sous la
cote 1,95 et négatif au-dessus.

Un écart qui ne se reproduit pas sur les deux périodes est du bruit : à ces
volumes, une tranche de 200 jambes porte encore plusieurs points d'incertitude.
