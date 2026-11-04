# AGENTS.md

**[CLAUDE.md](CLAUDE.md) is the single source of rules for this repo; read it
first.** It holds the measured results that override older intuitions, the
database rules, the coding conventions and the hard constraints. The product
as it exists today is described in [EVCORE.md](EVCORE.md), the current state
and open work in [ROADMAP.md](ROADMAP.md). Do not copy rules from CLAUDE.md
into this file: copies drift.

## Skills

Project skills live in `.agents/skills/<name>/SKILL.md`. Read the matching one
before the work it covers:

| Skill                                 | Use it for                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `evcore-forecast-audit`               | Forecasts, ranking, calibration, model-market divergence (point-in-time replay) |
| `evcore-coupon-review`                | Coupon composition, candidate ranking, settlement review                        |
| `betting`                             | Offline odds maths: de-vig, EV, independent parlays                             |
| `shadcn`                              | Any shadcn/ui work (see the shadcn section of CLAUDE.md)                        |
| `nextjs-app-router-patterns`          | Next.js App Router work                                                         |
| `nestjs-best-practices`               | NestJS modules, DI, security                                                    |
| `playwright-best-practices`           | Playwright e2e tests in `apps/web/e2e`                                          |
| `turborepo`                           | `turbo.json`, task pipelines, caching                                           |
| `impeccable`, `web-design-guidelines` | UI design, critique and audit                                                   |

`@evcore/analysis-core` stays the production source of truth. These skills
guide development and audit agents; the VANTAGE runtime does not load them.
Scope, sources and validation: [docs/ai-analysis-skills.md](docs/ai-analysis-skills.md).

Before touching settlement, results, follows or a scheduled job, and before
any PR to main, read [docs/review-expectations.md](docs/review-expectations.md).

## Secrets

Never read, print or copy `.env` / `.env.*` (only `.env.example` is allowed).
Ask the user for a secret value instead of opening a secret file.

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, read the relevant doc in `node_modules/next/dist/docs/`
and follow it over model memory if they differ.

<!-- END:nextjs-agent-rules -->
