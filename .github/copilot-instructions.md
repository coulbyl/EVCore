# GitHub Copilot Instructions — EVCore

**[CLAUDE.md](../CLAUDE.md) is the single source of rules for this repo; read
it first.** It holds the measured results that override older intuitions, the
commands, the database rules, the coding conventions and the hard constraints.

- Product as it exists today: [EVCORE.md](../EVCORE.md).
- Current state and open work: [ROADMAP.md](../ROADMAP.md).
- Review rules for settlement and scheduled jobs: [docs/review-expectations.md](../docs/review-expectations.md).

When reviewing a pull request, check it against CLAUDE.md, in particular: no
Prisma call outside a `*.repository.ts`, no hardcoded threshold that belongs in
`config/`, `decimal.js` for odds and probabilities, Zod at every external
boundary, no LLM output in the score, and statistics on
`channel_selection_deduped`, never on raw `channel_selection`.

Never read or print `.env` / `.env.*` (only `.env.example`). Do not copy rules
from CLAUDE.md into this file: copies drift.
