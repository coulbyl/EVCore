# Ligues sans cotes — Statut et feuille de route

Ce document recense les ligues qui ont été analysées mais **exclues du backtest et du moteur** faute de cotes Pinnacle dans le pipeline ETL. Ces ligues ne génèrent aucun pick tant que les odds ne sont pas couvertes.

Dernière mise à jour : 30 avril 2026.

---

## Ligues exclues (MISSING_ODDS)

| Code     | Compétition      | Pays        | Fixtures analysées     | Raison                                   |
| -------- | ---------------- | ----------- | ---------------------- | ---------------------------------------- |
| **TUR2** | TFF 1. Lig       | Turquie 🇹🇷  | 905 / 1 040 sans cotes | Pinnacle ne couvre pas la D2 turque      |
| **SRB1** | SuperLiga        | Serbie 🇷🇸   | 717 / 841 sans cotes   | Pinnacle ne couvre pas la D1 serbe       |
| **CZE1** | Fortuna Liga     | Tchéquie 🇨🇿 | Non évalué             | Absence de cotes confirmée               |
| **SVN1** | PrvaLiga         | Slovénie 🇸🇮 | 15 / 76 analysées      | Données insuffisantes + absence de cotes |
| **NOR2** | 1. divisjon      | Norvège 🇳🇴  | Non évalué             | Pinnacle ne couvre pas la D2 norvégienne |
| **SUI2** | Challenge League | Suisse 🇨🇭   | Non évalué             | Pinnacle ne couvre pas la D2 suisse      |
| **POL2** | I liga           | Pologne 🇵🇱  | Non évalué             | Pinnacle ne couvre pas la D2 polonaise   |

---

## Diagnostic technique

Le backtest requiert une **snapshot de cotes Pinnacle** (`oddsAvailable = true`) pour évaluer l'Expected Value d'un match. Sans cote, le moteur rejette le match avec le motif `MISSING_ODDS` et aucun pick n'est généré.

Les journaux de backtest (`backtest-analysis.latest.ndjson`) confirment que ces ligues ont un taux de `MISSING_ODDS` supérieur à 85 %, ce qui les rend inexploitables en l'état.

---

## Pour débloquer une ligue

Pour qu'une ligue puisse entrer dans le backtest et le moteur de paris, il faut :

1. **Identifier la source de cotes** — Pinnacle est la référence ; une API alternative (ex. OddsAPI, BetFair) peut être envisagée si le taux de couverture est suffisant (> 80 % des matchs).
2. **Ajouter un worker ETL** — créer un job BullMQ dédié à l'ingestion des cotes pour la ligue cible, avec validation Zod.
3. **Alimenter la table `odds_snapshot`** — les cotes doivent être stockées avant le coup d'envoi et liées au `fixture_id` correspondant.
4. **Relancer un backtest historique** — une fois les cotes historiques importées (au moins 2 saisons complètes), lancer `POST /backtest/{code}` et appliquer le workflow de calibration standard ([CALIBRATION-GUIDE.md](../../CALIBRATION-GUIDE.md)).

---

## Priorités suggérées

| Priorité   | Ligue                  | Justification                                                                                              |
| ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| 🔴 Haute   | **TUR2**               | Forte audience, 1 040 fixtures disponibles, marché actif sur Pinnacle pour certaines compétitions voisines |
| 🟡 Moyenne | **CZE1**               | Ligue D1 d'un marché UEFA actif ; bonne couverture supposée sur d'autres bookmakers                        |
| 🟡 Moyenne | **SRB1**               | D1 des Balkans, intéressant pour diversifier le portefeuille                                               |
| 🟢 Basse   | **NOR2 / SUI2 / POL2** | Ligues D2 — n'intégrer qu'après validation de leurs D1 respectives                                         |
| 🟢 Basse   | **SVN1**               | Trop peu de fixtures (76 total) pour espérer un backtest significatif même avec les cotes                  |
