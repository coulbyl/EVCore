# EVCore Project Context

> **Project Name:** EVCore  
> **Mission:** Autonomous, value-driven sports betting engine based on Expected Value (EV) mathematics.

---

## 🏗️ Project Overview

EVCore is a disciplined probabilistic decision system designed for long-term ROI in sports betting. It operates as an autonomous engine rather than a tip generator, utilizing deterministic data scoring (70%) refined by LLM context (30% in later phases), with the backend serving as the ultimate authority.

### 🛠️ Technology Stack

- **Monorepo:** `pnpm` (v10) + `Turborepo`
- **Backend:** NestJS (TypeScript), PostgreSQL (Prisma), BullMQ + Redis (Queues)
- **Frontend:** Next.js (Dashboard), TailwindCSS
- **Communication:** React Email (SMTP) + in-app notifications
- **Infrastructure:** Docker Compose, GitHub Actions
- **Math/Validation:** `decimal.js` (precision math), `Zod` (external data validation), `class-validator` (DTOs)

### 📂 Directory Structure

- `apps/backend/`: NestJS API, Betting Engine, and ETL workers.
- `apps/web/`: Next.js dashboard for performance tracking and management.
- `packages/db/`: Centralized Prisma schema and generated client (`@evcore/db`).
- `packages/ui/`: Shared React component library.
- `packages/transactional/`: React Email templates.
- `packages/eslint-config/` & `packages/typescript-config/`: Shared project standards.

---

## 🚀 Building and Running

### Prerequisites

- Node.js >= 22
- pnpm >= 10
- Docker

### Key Commands

```bash
# Setup
pnpm install
docker compose up -d

# Database
pnpm --filter @evcore/db db:migrate -- --name init
pnpm --filter @evcore/db db:seed

# Development
pnpm dev                       # Run all apps
pnpm --filter backend dev       # Run only backend
pnpm --filter web dev           # Run only web

# Quality & Testing
pnpm lint                       # ESLint across all packages
pnpm typecheck                  # TypeScript validation
pnpm --filter backend test      # Vitest unit tests (backend)
```

---

## 📜 Development Conventions

### 🧠 Core Principles

- **Deterministic First:** 70% of scoring comes from deterministic data; LLM is only for contextual refinement.
- **Strict Authority:** The backend validates all engine outputs and manages risk (e.g., market suspensions).
- **Zod Validation:** All external data (ETL, API responses) MUST be validated with Zod before being processed or persisted.
- **Precision Math:** NEVER use native JavaScript `number` for odds, EV, or stakes. Always use `decimal.js`.

### 💻 TypeScript & Coding Style

- **Strict Mode:** `strict: true` and `noUncheckedIndexedAccess: true` are mandatory.
- **No `any`:** Use `unknown` and narrow, or define proper types.
- **Naming:**
  - Files: `kebab-case` (e.g., `betting-engine.service.ts`)
  - Classes/Types: `PascalCase` (e.g., `BettingEngineService`)
  - Variables/Functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
- **NestJS Pattern:** Controller (Routing) -> Service (Business Logic) -> Repository (Prisma Queries).

### 🔒 Security & Secrets

- **Never** read or print content from `.env` files (except `.env.example`).
- **Never** log or commit API keys, tokens, or credentials.
- Ask the user explicitly for sensitive values if needed for a task.

---

## 🎯 Engine Specifics

### ⚖️ Betting Logic

- **EV Threshold:** Initial target is `EV ≥ 8%`.
- **Stake Sizing:** Fractional Kelly (0.25x) is the target strategy.
- **Daily Picks:** The engine produces individual per-fixture picks (plus an optional Safe Value pick) as the primary operational output.
- **Market Suspension:** Automatically triggered if ROI falls below -15% over 50+ bets on a specific market.

### 🔄 Learning Loop

- The system self-calibrates by logging estimated vs. actual results and proposing `AdjustmentProposals`.
- Backends can auto-apply these adjustments, with manual rollbacks available.

---

## 📖 Key Documentation

- `EVCORE.md`: Full product and architectural specification.
- `ROADMAP.md`: Current implementation status and phase checklist.
- `CLAUDE.md`: AI-specific coding conventions and hard constraints.
- `AGENTS.md`: Specific instructions for AI agents regarding secrets and documentation.

Refer to these files before making any architectural changes or adding new features.
