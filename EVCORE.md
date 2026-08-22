# 📘 Projet : Betting Engine Autonome (Value-Driven System)

## 1. Vision du projet

Construire un moteur autonome de sélection de paris sportifs basé sur :

- 📊 Probabilités estimées
- 📈 Expected Value (EV)
- 🎯 Architecture multi-canal — canaux pilotés par la cote (EV, SV) et canaux de prédiction pure par marché (voir §3.3, une vingtaine de canaux au 2026-08-16, en croissance à mesure que chaque marché du domaine reçoit son propre canal — ceci n'est plus une liste figée à 5)
- 🔁 Auto-évaluation et calibration
- 🧠 Apprentissage progressif contrôlé
- ⚖️ Équilibre mathématique + gestion du risque
- 🧱 Architecture robuste et mesurable

Le système ne sera **pas un chatbot**, mais un moteur décisionnel autonome.

---

# 2. Principes fondamentaux

## 2.1 Séparation stricte des responsabilités

| Composant        | Rôle                                  |
| ---------------- | ------------------------------------- |
| Data Engine      | Collecte et normalisation des données |
| Database         | Source de vérité historique           |
| Betting Engine   | Analyse probabiliste + scoring        |
| Backend (NestJS) | Autorité, validation, contrôle risque |
| IA (LLM)         | Raffinement contextuel uniquement     |

---

## 2.2 Règles stratégiques

- ❌ Pas de dépendance LLM pour les données brutes
- ✅ Données déterministes obligatoires
- ✅ Apprentissage validé par backend (Option B)
- ✅ EV prioritaire sur taux de réussite (canaux basés sur la cote : EV/SV) — hit rate/conviction prioritaire sur les canaux de prédiction pure (argmax par marché, indépendants des cotes — voir §3.3)
- ✅ Volume modéré, variance contrôlée
- ✅ “No Bet” autorisé

---

# 3. Scope initial (MVP)

## 3.1 Ligues ciblées

- Premier League
- Serie A
- La Liga
- Ligue 1

Phase 1 : Premier League uniquement.

---

## 3.2 Source de données

### Historique (MVP)

| Source                       | Données                                         | Accès                                  |
| ---------------------------- | ----------------------------------------------- | -------------------------------------- |
| **football-data.org**        | Fixtures, résultats, standings                  | API REST — Premier League forever free |
| **FBref** (scraping Cheerio) | Stats équipes, forme, performance dom/ext       | Scraping — 1 req/3s                    |
| **Understat**                | **xG (Expected Goals)** par match et par équipe | Scraping Node.js                       |
| **API-Sports**               | Odds historiques 15+ ans                        | Free 100 req/jour                      |

Minimum 3 saisons historiques avant tout backtest.

### Live (Phase 2)

| Source           | Données                                         | Accès                      |
| ---------------- | ----------------------------------------------- | -------------------------- |
| **API-Football** | Fixtures + odds intégrées, livescores           | Free 100 req/jour → payant |
| **The Odds API** | Odds haute fréquence (5-10 min), 30+ bookmakers | Payant                     |

- Snapshot des odds horodaté obligatoire
- Versioning temporel de chaque snapshot

---

## 3.3 Marchés ciblés

### MVP (Phase 1)

Ces 4 marchés partagent le même modèle sous-jacent (probabilité de buts par équipe) — un seul modèle les couvre :

| Marché             | Description                                  |
| ------------------ | -------------------------------------------- |
| **1X2**            | Victoire domicile / Nul / Victoire extérieur |
| **Over/Under 2.5** | Total buts dans le match                     |
| **BTTS**           | Les deux équipes marquent (Yes/No)           |
| **Double Chance**  | 1X, X2, 12 — dérivé des probabilités 1X2     |

### Canaux de décision

> **Nomenclature** : les codes de canal sont en anglais dans tout le code —
> `VALUE`, `SAFE`, `DOMINANT`, `DRAW`, `BTTS`. Les tags historiques EV, SV,
> CONF, NUL, BB qui subsistent dans les tableaux ci-dessous sont les anciens
> noms des trois premiers ; ils ne correspondent à aucun identifiant réel.

**Filtres de Phase 2 (VALUE, SAFE)**

Ils ne scannent plus `evaluatedMarkets` : ils re-sélectionnent parmi les
décisions déjà prises par les canaux de marché (voir la redéfinition
architecturale plus bas, livrée le 2026-08-18).

| Canal              | Critère           | Portée                                    |
| ------------------ | ----------------- | ----------------------------------------- |
| **VALUE** (ex-EV)  | edge ≥ 0.10       | toute décision de Phase 1                 |
| **SAFE** (ex-SV)   | P ≥ 68% + EV ≥ 0% | toute décision de Phase 1                 |

⚠️ **Le critère de VALUE est mesuré anti-prédictif** (audit 2026-08-22,
51 860 sélections : taux réel plat 0.511 → 0.375 pendant que l'annoncé monte à
0.699). Toute surface de mise applique donc `MAX_LEG_EDGE = 0.10` en
**plafond**, complément exact du seuil du canal — la plupart des picks VALUE
atterrissent dans la vue « Écarté » d'Investir. Ne pas ajouter de nouvelle
logique de sélection indexée sur l'EV ou l'edge. La piste en cours est de
réduire VALUE à ses picks propres (8% de ses sélections, les seuls qui ne
soient pas des doublons de Phase 1), non validée à ce jour.

**Canaux de prédiction (Phase 1 — un par marché)**

| Canal                   | Critère                           | Marché                       | Signal                                                |
| ----------------------- | --------------------------------- | ---------------------------- | ----------------------------------------------------- |
| **CONF** (Confiance)    | P_max ≥ seuil ligue               | ONE_X_TWO                    | argmax(HOME, DRAW, AWAY)                              |
| **BTTS**                | P(BTTS) ≥ seuil ligue             | BTTS                         | YES uniquement                                        |
| **DRAW** (Nul)          | 1/drawOdds ≥ seuil ligue          | ONE_X_TWO                    | DRAW uniquement                                       |
| **GOALS**               | P(side) ≥ seuil ligne/ligue       | OVER_UNDER (1.5/2.5/3.5/4.5) | meilleur (ligne × side) par EV                        |
| **CLEAN_SHEET**         | P(clean sheet) ≥ seuil ligue      | CLEAN_SHEET_HOME/AWAY        | argmax(HOME, AWAY), YES uniquement                    |
| **TEAM_TOTAL**          | P(side) ≥ seuil ligne/ligue       | TEAM_TOTAL_HOME/AWAY         | meilleur (équipe × ligne × side)                      |
| **WIN_EITHER_HALF**     | P(side) ≥ seuil ligue             | TO_WIN_EITHER_HALF           | argmax(HOME, AWAY)                                    |
| **CORRECT_SCORE**       | P(score) ≥ seuil global           | CORRECT_SCORE                | argmax probabilité (pas EV — évite le bruit longshot) |
| **RESULT_TOTAL_GOALS**  | P(side×ligne UNDER) ≥ seuil ligue | RESULT_TOTAL_GOALS           | meilleur (side × ligne) par EV                        |
| **OVER_UNDER_HT**       | P(side) ≥ seuil ligue             | OVER_UNDER_HT                | meilleur (ligne × side) par EV                        |
| **RESULT_BTTS**         | P(side×issue) ≥ seuil ligue       | RESULT_BTTS                  | meilleur (side × YES/NO) par EV                       |
| **DRAW_NO_BET**         | P(side) ≥ seuil ligue             | DRAW_NO_BET                  | argmax(HOME, AWAY)                                    |
| **WIN_TO_NIL**          | P(side) ≥ seuil ligue             | WIN_TO_NIL_HOME/AWAY         | argmax(HOME, AWAY), YES uniquement                    |
| **DOUBLE_CHANCE**       | P(combo) ≥ seuil global           | DOUBLE_CHANCE                | meilleur (1X/X2/12) par EV                            |
| **FIRST_HALF_WINNER**   | P_max HT ≥ seuil ligue            | FIRST_HALF_WINNER            | argmax(HOME, DRAW, AWAY) à la mi-temps                |
| **HALF_TIME_FULL_TIME** | P(combo) ≥ seuil global           | HALF_TIME_FULL_TIME          | argmax probabilité sur la grille 9 cases HT×FT        |

Les seuils des canaux de prédiction sont configurés par ligue dans `prediction.constants.ts` et calibrés par backtest avant activation. Le canal DRAW utilise la probabilité implicite bookmaker (`1/drawOdds`) comme signal principal — le modèle Poisson est un mauvais discriminateur de nul (plafond structurel ~0.32). CLEAN_SHEET, TEAM_TOTAL et WIN_EITHER_HALF ont été ajoutés le 2026-07-18 : entièrement câblés (moteur, settlement, UI). Aucune cote historique n'existe pour ces marchés (uniquement la sync PREMATCH forward, démarrée le même jour), donc pas de vrai backtest ROI possible — les trois tournent en **OBSERVATION** avec un seuil dérivé du taux de base réel par ligue (jamais misé, même méthodologie que GOALS ; TEAM_TOTAL doublé sur la dimension équipe, avec exclusion des lignes quasi-certaines > 90% de base rate).

CORRECT_SCORE (2026-06-30) et les 8 canaux ajoutés le 2026-08-16 (RESULT_TOTAL_GOALS, OVER_UNDER_HT, RESULT_BTTS, DRAW_NO_BET, WIN_TO_NIL, DOUBLE_CHANCE, FIRST_HALF_WINNER, HALF_TIME_FULL_TIME) complètent la couverture de l'enum `Market` — chaque marché a désormais un canal de prédiction dédié plutôt que de dépendre uniquement de la sélection opportuniste d'EV. ⚠️ **Périmètre de staking réécrit le 2026-08-22.** Le pool de coupon ne part plus d'une liste positive de canaux stakés : il prend tout canal non-méta et non-filtre (`POOL_EXCLUDED_CHANNELS` ne retire que CONSENSUS/CONTRARIAN/AVOID et VALUE/SAFE). L'admission se juge sur la **calibration** — ratio réalisé/annoncé — et non sur le ROI, qui n'a aucune puissance statistique à ces volumes. Les restrictions par ligue qui subsistent (`DRAW_STAKED_LEAGUES`, `BTTS_STAKED_LEAGUES`) sont documentées à leur point de définition, avec pour BTTS un risque ouvert consigné dans TODO.md.

Côté surface de consultation, Investir sépare les canaux dont le **ROI shrinké** (Bayes empirique) reste positif — deux sur dix-neuf au dernier relevé — de ceux en observation, et affiche à part ce que les garde-fous écartent.

> **Redéfinition architecturale (2026-08-17 — livrée le 2026-08-18 pour VALUE/SAFE)** :
> un canal n'est plus un consommateur direct et indépendant du socle Poisson
> unique — c'est un lecteur de **famille de moteur prédictif** (un processus
> générateur par famille, plusieurs canaux/marchés peuvent partager la même
> famille). EV et SV cessent d'être des chercheurs de valeur indépendants
> scannant tous les marchés ; ils deviennent des **filtres** appliqués aux
> décisions déjà prises par les canaux de marché — **c'est le cas depuis le
> 2026-08-18** (orchestrateur à 3 phases). Le reste du cadrage (moteur λ
> mi-temps dédié notamment) n'est pas implémenté. Voir
> `docs/prediction-engine-families.md` (cadrage, portée football actuelle en
> §0) et `docs/channel-strategy-architecture.md` (orchestration, phases mises
> à jour en conséquence).

---

### Marchés pré-combinés (RESULT_TOTAL_GOALS, RESULT_BTTS)

Retiré (2026-07-18) : le système précédent combinait deux marchés synthétiquement
(probabilité jointe Poisson + cote corrélée estimée). Il est remplacé par de vrais
marchés bookmaker pré-combinés — résultat × total de buts (`RESULT_TOTAL_GOALS`) et
résultat × BTTS (`RESULT_BTTS`) — qui portent une cote réelle plutôt qu'estimée. Ce
ne sont pas des combos à deux jambes mais des marchés à pick composé (comme
`HALF_TIME_FULL_TIME`). Voir `docs/market-coverage-expansion.md`.

### Phase 2+

| Marché                    | Prérequis                                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| **Mi-temps/Fin de match** | Nécessite stats de mi-temps (buts avant 45') — dépend des sources live |

---

## 3.4 Architecture MVP

### Tables principales

- Competition
- Season
- Team
- Fixture
- Bet
- ModelRun
- AdjustmentProposal

---

## 3.5 Pipeline MVP

1. Import historique
2. Calcul stats rolling
3. Génération probabilités
4. Backtest
5. Analyse calibration
6. Rapport performance

Pas d’odds au début.

---

# 4. Modèle décisionnel

## 4.1 Scoring hybride (C)

### Étape 1 — Scoring déterministe (70%)

Le score déterministe est la somme pondérée des facteurs **activés**. Tous les facteurs sont calculés en permanence — les facteurs désactivés sont loggés en mode shadow dans `ModelRun.features` sans contribuer au score.

**Facteurs core (toujours activés) :**

| Feature                 | Définition                                                                                                  | Fenêtre                    | Source       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------- | ------------ |
| **Forme récente**       | 5 derniers matchs, décroissance exponentielle (facteur 0.8) — poids : 1.0 / 0.8 / 0.64 / 0.51 / 0.41        | Rolling, tout contexte     | API-Football |
| **xG (Expected Goals)** | xG marqués et encaissés séparés — probabilité réelle de but par tir, bien supérieur à la moyenne buts brute | Rolling 10 derniers matchs | API-Football |
| **Performance dom/ext** | Taux victoire / nul / défaite selon le contexte du match (domicile ou extérieur)                            | Toute la saison en cours   | API-Football |
| **Volatilité ligue**    | Écart-type des totaux de buts par match dans la ligue (via distribution de Poisson)                         | Toute la saison en cours   | API-Football |

**Facteurs additionnels activés (Phase 2) :**

| Feature           | Définition                                                                                                    | Source                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Line movement** | Mouvement de cote Pinnacle entre premier et dernier snapshot. Mouvement > 10% contre notre pick → pick exclu. | OddsSnapshots en DB      |
| **Injuries**      | Absences joueurs clés (gardien, attaquants). 3+ titulaires absents → fixture exclue.                          | API-Football `/injuries` |

**Facteurs shadow (calculés, non activés, auto-activation possible) :**

| Feature        | Définition                                           | Activation                                        |
| -------------- | ---------------------------------------------------- | ------------------------------------------------- |
| **H2H**        | 5 dernières confrontations directes                  | Auto si corrélation Spearman > 0.15 sur 50+ paris |
| **Congestion** | Jours depuis dernier match, charge calendrier        | Auto si corrélation Spearman > 0.15 sur 50+ paris |
| **Lineups**    | Compositions officielles (post-hoc, ~1h avant match) | Auto si corrélation Spearman > 0.15 sur 50+ paris |

> **Note :** Le xG remplace la moyenne buts brute. Il reflète la qualité des occasions créées et concédées, pas seulement le score final — ce qui réduit le bruit lié aux matchs atypiques et améliore le Brier Score.

**Pondérations initiales (facteurs core activés) :**

| Feature                        | Poids |
| ------------------------------ | ----- |
| Forme récente                  | 30%   |
| xG (marqués/encaissés)         | 30%   |
| Performance domicile/extérieur | 25%   |
| Volatilité ligue               | 15%   |

Ces poids sont ajustables par la boucle d'apprentissage après 50+ paris, dans la limite de 5%/semaine. L'activation d'un nouveau facteur shadow déclenche une redistribution automatique des poids via `AdjustmentProposal`.

### Étape 2 — Raffinement LLM (30%)

- Cohérence contextuelle

Backend valide toujours.

---

## 4.2 Format d'output

Le Betting Engine produit un objet JSON par fixture analysée, stocké dans `ModelRun` et transmis au backend pour validation :

```json
{
  "fixture_id": "epl_2024_matchday28_mci_vs_ars",
  "analyzed_at": "2024-03-10T09:00:00Z",
  "model_run_id": "run_00421",
  "decision": "BET | NO_BET",
  "bets": [
    {
      "market": "1X2 | OVER_UNDER | BTTS | DOUBLE_CHANCE",
      "pick": "HOME | DRAW | AWAY | OVER | UNDER | YES | NO | 1X | X2 | 12",
      "prob_estimated": 0.62,
      "odds_snapshot": 1.85,
      "ev": 0.147,
      "stake_pct": 0.01,
      "score": {
        "deterministic": 0.71,
        "llm_delta": 0.04,
        "final": 0.75
      },
      "features": {
        "forme_recente": 0.68,
        "xg": 0.74,
        "performance_dom_ext": 0.65,
        "volatilite_ligue": 0.42
      }
    }
  ],
  "openclaw_raw": {},
  "validated_by_backend": true
}
```

- `decision` au niveau fixture — une seule décision globale par match
- `llm_delta` isolé du score déterministe — contribution OpenClaw auditable indépendamment
- `features` loggées à chaque run — permet de rejouer n'importe quel `ModelRun`
- `odds_snapshot` obligatoire en phase live
- `validated_by_backend` — trace explicite de l'autorité backend

---

# 5. Stratégie Value & Risk

## 5.1 Expected Value (EV)

Formule :

EV = (Probabilité × Cote) − 1

Seuil initial :

- EV ≥ 8%

⚠️ Ce seuil existe toujours dans le code (`EV_THRESHOLD`, gate du canal VALUE)
mais **il ne sélectionne pas sur une quantité prédictive** — voir l'encadré de
§ « Canaux de décision ». Un plafond `MAX_LEG_EDGE = 0.10` s'applique
par-dessus sur toute surface de mise, et le classement se fait partout sur la
probabilité calibrée.

---

## 5.2 Volume recommandé

- 4–8 paris par semaine
- No bet autorisé
- 1% bankroll par pari (fixe au début)

---

## 5.3 Approche choisie

✔️ ROI stable
✔️ EV strict
✔️ Pas de Kelly au début
✔️ Ajustement progressif des poids

---

# 6. Boucle d’apprentissage (Option B)

## Après chaque match :

1. Log probabilité estimée
2. Log résultat réel
3. Calcul erreur calibration
4. Proposer ajustement

Backend décide :

- Appliquer partiellement
- Refuser
- Geler un marché

---

# 7. Métriques clés

- Brier Score
- Calibration Error
- ROI glissant
- Drawdown max
- EV moyen
- ROI par compétition (Priorité 1)
- ROI par marché au sein de la compétition
- ROI par plage de cote

---

# 8. Contraintes majeures

- Pas de changement de poids < 50 paris
- Variation max 5% / semaine
- Snapshot des odds obligatoire en phase live

### Gestion des cas d'erreur données

| Cas                         | Comportement                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Match reporté/annulé**    | Fixture marquée `POSTPONED` — aucun `ModelRun` généré, paris existants annulés                                        |
| **Source ETL indisponible** | Job BullMQ retenté 3× avec backoff exponentiel — alerte si échec total                                                |
| **Odds manquantes**         | `decision: NO_BET` automatique — pas d'analyse sans snapshot odds en phase live                                       |
| **Données insuffisantes**   | Moins de 5 matchs joués en saison → feature `forme_recente` exclue du scoring, poids redistribués proportionnellement |

---

### Seuils de suspension par marché

| Niveau           | Condition                                       | Action                                                   |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------- |
| **Alerte**       | ROI < -10% sur les 30 derniers paris du marché  | Log + notification, aucune action automatique            |
| **Suspension**   | ROI < -15% sur un minimum de 50 paris du marché | Gel automatique du marché, révision manuelle obligatoire |
| **Réactivation** | Décision backend uniquement                     | Jamais automatique                                       |

- La suspension s'applique par marché indépendamment — un marché suspendu n'affecte pas les autres
- Aucune suspension possible avant 50 paris sur le marché concerné

---

# 9. MVP (3 mois)

## Mois 1

- Import historique
- Modèle probabiliste simple
- Backtest complet
- Calibration

## Mois 2

- Ajout odds
- Calcul EV
- Simulation value bets
- Tracking ROI

## Mois 3

- Automatisation quotidienne
- Hybride scan + monitor
- Apprentissage validé
- Stabilisation

---

# 10. LTS (Long Term Strategy)

## Phase 2

- Kelly fractionnelle (0.25)
- Multi-ligues actives
- Diversification corrélations
- Multi-bookmakers
- **Grafana** — dashboards ROI, Brier Score, drawdown (connexion directe PostgreSQL)
- **TimescaleDB** — extension PostgreSQL pour odds snapshots haute fréquence (90% compression, 1000x faster queries)

## Phase 3

- Modèle ML léger (XGBoost)
- Détection marché inefficience
- Simulation Monte Carlo
- Gestion dynamique drawdown
- **Python worker** — backtesting avancé (`sports-betting`) + calibration probabiliste (`scikit-learn` : Platt Scaling, isotonic regression, reliability diagrams)

## Phase 4

- SaaS possible
- Multi-tenant
- Groupe premium
- API interne

---

# 11. Règles psychologiques intégrées

- Le système peut perdre 10 fois d’affilée
- Drawdown de 10–15% normal
- Évaluation sur 150–300 bets minimum
- Pas d’optimisation court terme

---

# 12. Philosophie finale

Ce projet n’est pas :

- Un générateur de pronostics excitants
- Un outil court terme
- Un système basé sur intuition

C’est :

> Un moteur probabiliste discipliné,
> Multi-canal (cotes : EV, SV — prédiction par marché : voir §3.3),
> Mesurable,
> Auto-calibré,
> Construit pour survivre à la variance.

---

# 13. Étape immédiate suivante

1. Importer 3 saisons EPL
2. Construire modèle simple
3. Backtester
4. Mesurer calibration

Ne rien complexifier avant validation.

---

# 14. Stack Technique

## 14.1 Backend

- **Framework** : NestJS
- **Langage** : TypeScript
- **ORM** : Prisma
- **Base de données** : PostgreSQL
- **Queue & Scheduling** : BullMQ + Redis
- **Validation** : Zod ou class-validator
- **Tests** : Vitest
- **Build** : SWC

---

## 14.2 Data Engine (ETL)

### Orchestration

- **Kestra** (open source) — orchestrateur ETL YAML-based, remplace le scheduling manuel BullMQ
  - Monitoring visuel, historique d'exécution, retries configurables
  - Wrape les workers Node.js existants sans réécriture
- **BullMQ + Redis** — conservé pour les workers Node.js de traitement

### Jobs principaux

| Job             | Déclencheur            | Source                      |
| --------------- | ---------------------- | --------------------------- |
| `fixtures_sync` | Quotidien              | football-data.org           |
| `results_sync`  | Post-match             | football-data.org           |
| `xg_sync`       | Post-match             | Understat (scraping)        |
| `stats_sync`    | Hebdomadaire           | FBref (scraping)            |
| `odds_snapshot` | Pré-match (phase live) | API-Football / The Odds API |

### Librairies

- **HTTP / Scraping** : Axios + Cheerio
- **Validation données** : Zod (schéma strict sur chaque ingestion)
- **Math / Modèle probabiliste** :
  - `jStat` — distributions de Poisson (standard football)
  - `decimal.js` — arithmétique précise sur les cotes
  - `simple-statistics` — écart-type, calibration error, corrélation
- **Logging** : Pino

---

## 14.3 Intelligence & IA

- OpenClaw (runtime agent)
- LLM externe (GPT / Claude selon coût)
- Rôle :
  - Raffinement contextuel
  - Construction ticket
  - Proposition ajustement poids

LLM non utilisé pour :

- Scraping
- Source de fixtures
- Données primaires

### Contraintes d'encadrement OpenClaw

OpenClaw est un composant contraint, pas une boîte noire. Trois risques identifiés et leurs garde-fous :

**Hallucination**

- Les prompts sont strictement structurés — OpenClaw reçoit les données déjà calculées par le moteur déterministe, jamais de question ouverte
- Chaque output est validé contre un schéma Zod — toute réponse non conforme est rejetée automatiquement

**Manque de reproductibilité**

- `temperature: 0` sur tous les appels de scoring
- Chaque appel est loggé intégralement : input exact, output exact, timestamp, version du prompt
- Les propositions OpenClaw sont stockées séparément du score final pour permettre l'audit de sa contribution réelle

**Dérive de confiance (poids réel > 30%)**

- Le plafond de 30% est hard-codé côté backend — OpenClaw ne peut pas le dépasser
- Son output est un `delta` numérique sur le score, jamais un raisonnement narratif que le système interpréterait librement

**Timing d'introduction**

- OpenClaw n'entre pas dans la boucle avant la fin du MVP
- Il faut un ROI et un Brier Score de référence mesurés (modèle 100% déterministe) avant d'introduire le LLM — pour pouvoir quantifier sa contribution réelle et le retirer s'il n'apporte rien

---

## 14.4 Notifications & Alertes

- **Nodemailer** (SMTP) — email transactionnel (alertes moteur, rapports hebdomadaires)
  - Kill-switch `SMTP_ENABLED` — désactivé par défaut en dev, Mailpit en local (port 1025/8025)
  - En prod : `SMTP_HOST/PORT/USER/PASSWORD` (Gmail, SES, etc.)
- **In-app** — notifications PostgreSQL consultables via `GET /notifications`

**Événements notifiés :**

| Événement                            | Canal         | Priorité |
| ------------------------------------ | ------------- | -------- |
| Picks du jour générés (≥ 1 pari)     | Email + Slack | Haute    |
| NO BET du jour (0 opportunité)       | Email + Slack | Normale  |
| Marché suspendu automatiquement      | Slack + Email | Haute    |
| Échec total job ETL                  | Slack + Email | Critique |
| Rapport hebdomadaire ROI/Brier Score | Email         | Normale  |

---

## 14.5 Infrastructure

- Docker Compose (local & prod)
- VPS (Hetzner recommandé)
- Reverse proxy (Nginx)
- CI/CD (GitHub Actions)

---

## 14.6 Architecture globale

```
Data Engine (ETL)
        ↓
PostgreSQL
        ↓
Betting Engine (NestJS)
        ↓
OpenClaw (IA refine)
        ↓
Validation Backend
        ↓
Stockage + Tracking
```

---

## 14.7 Philosophie technique

- Données déterministes
- IA interprétative
- Backend autorité
- Système mesurable
- Scalabilité possible vers SaaS

---

# 15. Nom du Projet

## 🎯 Nom officiel

# **EVCore**

Domaine : **evcore.live**

---

## Signification

- **EV** → _Expected Value_, concept fondateur — le moteur ne génère un pick que lorsqu'il y a un avantage mathématique mesurable
- **Core** → moteur central, discipline, fondation structurelle

Le système a évolué au-delà du seul canal EV : il opère désormais sur une vingtaine de canaux (voir §3.3 pour la liste complète et le statut staké/observation de chacun), mais l'Expected Value reste le critère primaire pour les canaux basés sur les cotes (EV/SV).

Le nom reflète :

> Un moteur construit autour de l’avantage mathématique,
> avec une approche rigoureuse et long terme.

---

## Positionnement

EVCore n’est pas :

- Un générateur de “tips”
- Un outil émotionnel
- Un système court terme

EVCore est :

- Un moteur probabiliste
- Un système value-driven
- Un framework d’optimisation long terme
- Un outil mesurable et calibré

---

## Vision associée au nom

EVCore représente :

- Discipline
- Structure
- Mathématiques appliquées
- Calibration continue
- Gestion intelligente du risque

---

## Extension future

Le nom permet une évolution naturelle vers :

- EVCore Engine
- EVCore Analytics
- EVCore Pro
- EVCore AI

---
