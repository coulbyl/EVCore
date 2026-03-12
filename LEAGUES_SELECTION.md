# EVCore — Sélection des 10 ligues à exploiter (A + B)

Date: 2026-03-03

## Recommandation courte

Pour ton modèle actuel (Poisson + EV + odds snapshots + coupon multi-jours), je recommande:

1. Premier League (Angleterre) — `E0`
2. Serie A (Italie) — `I1`
3. La Liga (Espagne) — `SP1`
4. Bundesliga (Allemagne) — `D1`
5. Ligue 1 (France) — `F1`
6. Championship (Angleterre) — `E1`
7. Serie B (Italie) — `I2`
8. Segunda División (Espagne) — `SP2`
9. 2. Bundesliga (Allemagne) — `D2`
10. Ligue 2 (France) — `F2`

## Pourquoi ces 10 ligues sont les plus adaptées à EVCore

1. Cohérence "A + B" par pays

- Tu gardes les 5 grands championnats européens + leur division B.
- Avantage: même structure de calendrier, même logique de features, même pipeline ETL.

2. Qualité/poids compétitif des ligues A

- Les associations UEFA 5-year placent Angleterre, Italie, Espagne, Allemagne, France en tête.
- Ça valide que ce sont les championnats les plus "structurants" pour ton scope européen.

3. Couverture data historique exploitable

- football-data.co.uk fournit ces divisions majeures avec historiques, odds match/goal/AH et stats match.
- Les codes CSV sont directement exploitables dans ta logique `csvDivisionCode`.

4. Compatibilité forte avec ton modèle

- Ton modèle dépend d'un volume stable de fixtures + odds + résultats.
- Ces ligues offrent une cadence saisonnière régulière (août-mai), idéale pour rolling stats, calibration et coupon windows 2-3 jours.

5. Liquidité marché (pragmatique EV)

- Les ligues A sont très liquides (prix plus robustes).
- Les ligues B gardent une bonne profondeur tout en laissant souvent plus d'inefficiences que les ligues A.

## Pourquoi je ne mets pas tout de suite Eredivisie / Primeira Liga / Belgique

- Ce sont de bonnes options de phase 2 d'expansion.
- Mais pour un top 10 "propre" et homogène avec ta stack actuelle, le bloc Big-5 + divisions B est plus simple à industrialiser et monitorer.
- Tu peux les ajouter ensuite en slots 11-13 selon la perf live.

## Plan d’activation recommandé

1. Phase 1 (2 semaines): `PL, SA, LL, BL1, L1`
2. Phase 2 (2 semaines): `E1, I2, SP2`
3. Phase 3 (2 semaines): `D2, F2`

KPIs à suivre à chaque phase:

- taux de jobs ETL réussis
- taux de fixtures avec odds valides
- délai moyen de génération coupon
- ROI/Brier/Calibration par ligue

## Notes opérationnelles importantes

- football-data.co.uk indique une fiabilité Pinnacle dégradée depuis 2025-07-23.
- Donc: prioriser Bet365 / market average pour certaines analyses, et garder Pinnacle avec prudence dans les signaux.

## Sources (web)

- UEFA rankings (coefficients associations):  
  https://www.uefa.com/nationalassociations/uefarankings/
- football-data.co.uk (couverture ligues + historiques + odds/stats):  
  https://www.football-data.co.uk/data.php  
  https://www.football-data.co.uk/englandm.php  
  https://www.football-data.co.uk/germanym.php  
  https://www.football-data.co.uk/italym.php  
  https://www.football-data.co.uk/spainm.php  
  https://www.football-data.co.uk/francem.php
- API-Football / API-Sports coverage & plans (quota/rate-limit):  
  https://www.api-football.com/coverage  
  https://api-sports.io/sports/football  
  https://www.api-football.com/news/post/how-to-get-standings-for-all-current-seasons
