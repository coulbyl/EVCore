# 📘 Projet : Betting Engine Autonome (Value-Driven System)

## 1. Vision du projet

Construire un moteur autonome de sélection de paris sportifs basé sur :

- 📊 Probabilités estimées
- 📈 Expected Value (EV)
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
- ✅ EV prioritaire sur taux de réussite
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

| Source | Données | Accès |
|---|---|---|
| **football-data.org** | Fixtures, résultats, standings | API REST — Premier League forever free |
| **FBref** (scraping Cheerio) | Stats équipes, forme, performance dom/ext | Scraping — 1 req/3s |
| **Understat** | **xG (Expected Goals)** par match et par équipe | Scraping Node.js |
| **API-Sports** | Odds historiques 15+ ans | Free 100 req/jour |

Minimum 3 saisons historiques avant tout backtest.

### Live (Phase 2)

| Source | Données | Accès |
|---|---|---|
| **API-Football** | Fixtures + odds intégrées, livescores | Free 100 req/jour → payant |
| **The Odds API** | Odds haute fréquence (5-10 min), 30+ bookmakers | Payant |

- Snapshot des odds horodaté obligatoire
- Versioning temporel de chaque snapshot

---

## 3.3 Marchés ciblés

### MVP (Phase 1)

Ces 4 marchés partagent le même modèle sous-jacent (probabilité de buts par équipe) — un seul modèle les couvre :

| Marché | Description |
|---|---|
| **1X2** | Victoire domicile / Nul / Victoire extérieur |
| **Over/Under 2.5** | Total buts dans le match |
| **BTTS** | Les deux équipes marquent (Yes/No) |
| **Double Chance** | 1X, X2, 12 — dérivé des probabilités 1X2 |

### Phase 2

| Marché | Prérequis |
|---|---|
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

| Feature | Définition | Fenêtre | Source |
|---|---|---|---|
| **Forme récente** | 5 derniers matchs, décroissance exponentielle (facteur 0.8) — poids : 1.0 / 0.8 / 0.64 / 0.51 / 0.41 | Rolling, tout contexte | football-data.org |
| **xG (Expected Goals)** | xG marqués et encaissés séparés — probabilité réelle de but par tir, bien supérieur à la moyenne buts brute | Rolling 10 derniers matchs | Understat |
| **Performance dom/ext** | Taux victoire / nul / défaite selon le contexte du match (domicile ou extérieur) | Toute la saison en cours | FBref |
| **Volatilité ligue** | Écart-type des totaux de buts par match dans la ligue (via distribution de Poisson) | Toute la saison en cours | Understat / FBref |

> **Note :** Le xG remplace la moyenne buts brute. Il reflète la qualité des occasions créées et concédées, pas seulement le score final — ce qui réduit le bruit lié aux matchs atypiques et améliore le Brier Score.

**Pondérations initiales (au sein du score déterministe) :**

| Feature | Poids |
|---|---|
| Forme récente | 30% |
| xG (marqués/encaissés) | 30% |
| Performance domicile/extérieur | 25% |
| Volatilité ligue | 15% |

Ces poids sont ajustables par la boucle d'apprentissage après 50+ paris, dans la limite de 5%/semaine.

### Étape 2 — Raffinement LLM (30%)

- Cohérence contextuelle
- Corrélation picks
- Construction combiné

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

---

## 5.2 Volume recommandé

- 4–8 paris par semaine
- Max 3 legs par combiné
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
- ROI par marché
- ROI par plage de cote

---

# 8. Contraintes majeures

- Pas de changement de poids < 50 paris
- Variation max 5% / semaine
- Snapshot des odds obligatoire en phase live

### Gestion des cas d'erreur données

| Cas | Comportement |
|---|---|
| **Match reporté/annulé** | Fixture marquée `POSTPONED` — aucun `ModelRun` généré, paris existants annulés |
| **Source ETL indisponible** | Job BullMQ retenté 3× avec backoff exponentiel — alerte si échec total |
| **Odds manquantes** | `decision: NO_BET` automatique — pas d'analyse sans snapshot odds en phase live |
| **Données insuffisantes** | Moins de 5 matchs joués en saison → feature `forme_recente` exclue du scoring, poids redistribués proportionnellement |

---

### Seuils de suspension par marché

| Niveau | Condition | Action |
|---|---|---|
| **Alerte** | ROI < -10% sur les 30 derniers paris du marché | Log + notification, aucune action automatique |
| **Suspension** | ROI < -15% sur un minimum de 50 paris du marché | Gel automatique du marché, révision manuelle obligatoire |
| **Réactivation** | Décision backend uniquement | Jamais automatique |

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

- Un générateur de coupons excitants
- Un outil court terme
- Un système basé sur intuition

C’est :

> Un moteur probabiliste discipliné,
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

| Job | Déclencheur | Source |
|---|---|---|
| `fixtures_sync` | Quotidien | football-data.org |
| `results_sync` | Post-match | football-data.org |
| `xg_sync` | Post-match | Understat (scraping) |
| `stats_sync` | Hebdomadaire | FBref (scraping) |
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

- **Novu** (open source, self-hosted) — système de notification multi-canal
  - Canaux : Slack + Email (MVP), push possible en Phase 2
  - Retry logic + templates paramétrés
  - Déployé via Docker Compose avec le reste de la stack

**Événements notifiés :**

| Événement | Canal | Priorité |
|---|---|---|
| Opportunité EV détectée (EV ≥ 8%) | Slack | Haute |
| Marché suspendu automatiquement | Slack + Email | Haute |
| Échec total job ETL | Slack + Email | Critique |
| Rapport hebdomadaire ROI/Brier Score | Email | Normale |

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

- **EV** → _Expected Value_, cœur mathématique du système
- **Core** → moteur central, discipline, fondation structurelle

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
