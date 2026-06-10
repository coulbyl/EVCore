# EVCore — Phase 4 : AI Chat Analyst

> **Principe** : un assistant conversationnel qui permet à chaque user d'interroger les données du moteur EVCore en langage naturel — performances, analyses ML, segments, fixtures — sur n'importe quelle période disponible.
>
> Ce n'est pas un ChatGPT générique. Il a accès aux vraies données du moteur via function calling.

---

## Concept

Chaque user pose ses propres questions, voit son propre historique de conversation. Les données interrogées sont les mêmes pour tout le monde (source unique : la DB EVCore). Le chat est un **data analyst du moteur**, pas un assistant de paris personnel.

**Exemples de questions :**
- "Comment a performé le segment DRAW ces 3 derniers jours ?"
- "Pourquoi le modèle ML BTTS:BTTS a été activé ?"
- "Quels picks EV avaient le meilleur edge la semaine dernière ?"
- "Compare le ROI simulé ML vs ROI réel sur les 30 derniers jours"
- "Montre-moi les fixtures où le moteur s'est le plus trompé"

---

## Stack

| Composant | Choix | Raison |
|---|---|---|
| LLM | Llama 3.1 8B via Groq API | Gratuit (free tier), rapide, function calling |
| Pattern | Function calling (tool use) | Données structurées en DB, pas de RAG |
| Historique | PostgreSQL `chat_message` | Cohérence inter-sessions par user |
| Transport | SSE (Server-Sent Events) | Streaming de la réponse token par token |
| Rate limit | Par user, configurable | Contrôle du coût Groq |

**Groq free tier :** 30 req/min · 6 000 tokens/min · 1 000 req/jour — suffisant pour un usage admin interne.
**Groq payant (si dépassement) :** $0.05/M tokens input · $0.08/M tokens output (Llama 3.1 8B).

---

## Architecture

```
User (browser)
    ↓ POST /chat/message  (content, conversationId?)
ChatController (NestJS)
    ↓
ChatService
    ├── Charge l'historique de la conversation (ChatRepository)
    ├── Construit le prompt system (contexte EVCore)
    └── Appelle Groq API avec tools + historique
            ↓ tool_call ?
        ChatToolsService (queries DB)
            ↓ résultat JSON
        Groq API (2e appel avec résultat tool)
            ↓ stream SSE
User reçoit la réponse token par token
```

---

## Tools (function calling)

Le LLM décide lui-même quels tools appeler selon la question. Chaque tool retourne du JSON structuré.

### `getModelRuns(from, to, segment?)`
Analyses du moteur sur une période. Filtre optionnel par segment (`EV:ONE_X_TWO`, `BTTS:BTTS`, etc.).
```json
{ "from": "2026-06-07", "to": "2026-06-10", "segment": "DRAW:ONE_X_TWO" }
```

### `getPredictionOutcomes(from, to, canal?)`
Résultats réels des prédictions (WON/LOST/PENDING) avec edge affiché et odds.
```json
{ "from": "2026-06-07", "to": "2026-06-10" }
```

### `getSegmentPerformance(from, to)`
ROI réel, hit rate, nombre de picks, edge moyen — par segment sur la période.
```json
{ "from": "2026-06-01", "to": "2026-06-10" }
```

### `getMLMetrics()`
Modèles ML actifs, leur segment, algorithme, Brier score, ROI simulé, date d'activation.

### `getFixtureAnalysis(fixtureId)`
Détail complet d'une fixture : ModelRun, features, score déterministe, delta ML, décision finale.

### `getEdgeAnalysis(from, to)`
Edge affiché vs Pinnacle par segment. Identifie les biais structurels du moteur.

---

## Modèle de données

### Table `chat_conversation`
```sql
id          UUID  PRIMARY KEY DEFAULT uuidv7()
userId      UUID  NOT NULL REFERENCES "User"(id)
title       TEXT              -- généré automatiquement (1ère question tronquée)
createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
updatedAt   TIMESTAMP NOT NULL DEFAULT NOW()
```

### Table `chat_message`
```sql
id              UUID  PRIMARY KEY DEFAULT uuidv7()
conversationId  UUID  NOT NULL REFERENCES chat_conversation(id) ON DELETE CASCADE
role            TEXT  NOT NULL  -- 'user' | 'assistant' | 'tool'
content         TEXT  NOT NULL
toolName        TEXT            -- renseigné si role = 'tool'
inputTokens     INT   DEFAULT 0
outputTokens    INT   DEFAULT 0
createdAt       TIMESTAMP NOT NULL DEFAULT NOW()
```

### Table `chat_usage` (rate limiting + suivi coût)
```sql
userId      UUID  NOT NULL REFERENCES "User"(id)
month       DATE  NOT NULL  -- 1er jour du mois
requests    INT   DEFAULT 0
inputTokens  INT   DEFAULT 0
outputTokens INT   DEFAULT 0
PRIMARY KEY (userId, month)
```

---

## Module NestJS

```
apps/backend/src/modules/chat/
  chat.module.ts
  chat.controller.ts      POST /chat/conversations
                          GET  /chat/conversations
                          POST /chat/conversations/:id/messages  (SSE stream)
                          GET  /chat/conversations/:id/messages
  chat.service.ts         orchestration Groq + tool calls + historique
  chat.repository.ts      CRUD chat_conversation + chat_message + usage
  chat.tools.service.ts   les 6 fonctions DB exposées comme tools
  dto/
    create-message.dto.ts
```

**Prompt system (injecté à chaque conversation) :**
```
Tu es l'assistant analytique d'EVCore, un moteur de paris sportifs probabiliste.
Tu as accès aux données réelles du moteur via des fonctions. Réponds en français.
Date actuelle : {date}. Segments disponibles : EV, SV, CONF, DRAW, BTTS.
Ne donne jamais de conseils de paris. Analyse uniquement les données du moteur.
```

---

## Frontend

Page `/dashboard/chat` — interface simple :
- Liste des conversations (sidebar gauche)
- Zone de messages (bulles user/assistant)
- Input textarea + bouton envoyer
- Streaming affiché token par token (SSE)
- Badge sur les tool calls ("Recherche des performances...")

Composants à créer dans `apps/web/app/dashboard/chat/`.

---

## Rate limiting

| Tier | Requêtes/jour | Configurable via |
|---|---|---|
| Default | 50 req/jour/user | `CHAT_DAILY_LIMIT_PER_USER=50` |
| Admin | illimité | rôle `ADMIN` bypass |

Erreur `429` si dépassement, message explicite dans l'UI.

---

## Contraintes et règles

- **Jamais de conseils de paris directs** — le chat analyse, n'oriente pas
- **Pas d'accès aux données d'autres users** — le chat ne lit pas les données personnelles
- **Contexte temporel libre** — l'user peut demander n'importe quelle période disponible en DB
- **Historique persisté** — chaque conversation est retrouvable, pas juste la session courante
- **Fallback gracieux** — si Groq est indisponible, message d'erreur clair, pas de crash

---

## Ordre d'implémentation suggéré

1. Migration DB (`chat_conversation`, `chat_message`, `chat_usage`)
2. `ChatToolsService` — les 6 tools avec leurs queries Prisma
3. `ChatService` — intégration Groq SDK + orchestration tool calls
4. `ChatController` — endpoints REST + stream SSE
5. Page frontend `/dashboard/chat` — UI basique fonctionnelle
6. Rate limiting + usage tracking
7. Titre auto-généré des conversations (appel LLM léger)
