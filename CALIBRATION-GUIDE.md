# EVCore - Workflow Backtest Ligue

## Objectif

Avoir une methode claire et reusable pour analyser une ligue, corriger sa calibration si necessaire, puis documenter les signaux a garder dans le produit.

Critere principal:

- verifier si la ligue est vraiment exploitable
- identifier les marches et segments rentables
- retirer ou durcir les branches qui detruisent le ROI

## Workflow

1. Le backend de backtest tourne localement sur le port 3001.
2. Lancer le backtest de la ligue via `POST /backtest/{competitionCode}`. via curl, il retourne le resultat du backtest
3. Recuperer et lire la reponse complete du backtest.
4. Extraire les metriques globales:
   - nombre total de paris
   - gains / pertes
   - profit
   - ROI
   - performance par marche
5. Lire `apps/backend/logs/backtest-analysis.latest.ndjson` pour comprendre:
   - pourquoi des picks ont ete places
   - pourquoi d'autres ont ete rejetes
   - quelles directions et quelles fourchettes de cotes sont bonnes ou mauvaises
6. Isoler les branches toxiques:
   - marches negatifs
   - picks negatifs
   - buckets de cotes negatifs
   - segments a EV eleve mais resultats mauvais
7. Regarder le code du moteur pour trouver le bon levier:
   - seuil de probabilite
   - floor / cap de cote
   - EV floor
   - EV soft cap
   - seuil de qualite
   - desactivation d'un marche ou d'une direction
8. Appliquer une correction minimale et ciblee dans la configuration du moteur.
9. Relancer le backtest de la ligue apres patch.
10. Comparer avant / apres:

- ROI global
- volume de paris
- contribution par marche
- robustesse du signal restant

11. Si le backtest devient satisfaisant, ajouter ou ajuster les tests relies a la calibration retenue.
12. Si la ligue devient propre:

- garder les segments rentables
- laisser de cote les segments encore trop fragiles

13. Mettre a jour la documentation produit dans l'aide web:

- signaux a jouer
- signaux a eviter
- plages de cotes utiles
- avertissements sur les segments fragiles

## Regles pratiques

- Ne pas corriger une ligue avec un changement global si le probleme est localise a un marche ou a un pick.
- Preferer une calibration par `competitionCode|market|pick` quand un segment precis est en cause.
- Ne pas garder un marche juste parce qu'il est legerement positif sur un echantillon minuscule.
- Si un marche secondaire est bruite mais qu'un sous-segment est bon, essayer d'abord une fenetre stricte avant de le supprimer.
- Toujours revalider la ligue complete apres chaque changement.
- N'ecrire les tests qu'une fois la calibration jugee satisfaisante au backtest, pour eviter de les reecrire a chaque iteration.

## Notes d'execution

- Utiliser `curl` pour declencher le backtest.
- Le fichier `apps/backend/logs/backtest-analysis.latest.ndjson` est la source principale pour le diagnostic fin.
- Si une reponse JSON temporaire est stockee localement, la supprimer une fois l'analyse terminee.
- Si le backtest ne reflete pas le patch, verifier que le backend a bien recharge le nouveau code.

## Contexte technique

- La base de donnees est accessible via Docker si une analyse plus poussee est necessaire.
- La logique de calibration vit principalement dans le moteur de betting et ses constantes.
- La restitution utilisateur des signaux de ligue vit dans l'aide web.

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/evcore

on va travailler sur la calibration, backtest de ces ligues

TUR1, SVN1, SWE1, CZE1, POL1, NOR1, MLS, SUI1, SRB1 et TUR2

on va traiter league après league
