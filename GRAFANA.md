# GRAFANA.md

Strategie Grafana pour EVCore.

## Statut

`STAND-BY POST-PROD`

Grafana n'est pas requis pour la phase actuelle tant que:

- les KPIs sont suivis de façon fiable via logs/SQL/notifications;
- la charge d'exploitation reste faible.

## Conditions de declenchement

Activer Grafana quand au moins un des points suivants est vrai:

1. Monitoring manuel trop lent pour investiguer les incidents.
2. Besoin de suivi continu des KPIs (ROI, Brier, drawdown) sur plusieurs environnements.
3. Besoin d'alerting centralise et historise.

## Perimetre minimum a l'activation

1. Dashboard business: ROI, Brier, drawdown, volume bets.
2. Dashboard ops: workers ETL, erreurs, retries, latence.
3. Alertes critiques: jobs fails, derive Brier, chute ROI.
