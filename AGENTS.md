# AGENTS.md

Instructions pour les agents de code (Codex/assistants automatisés) dans ce repo.

## Secrets & fichiers `.env`

- Ne jamais lire, parser, afficher, ni copier le contenu de fichiers secrets:
  - `.env`
  - `.env.*` (ex: `.env.local`, `.env.production`, etc.)
  - tout fichier contenant des credentials/tokens
- Exception autorisée: `.env.example` (template non secret) peut être lu/modifié.
- Si une action semble nécessiter un secret, demander explicitement à l'utilisateur la valeur à fournir, sans ouvrir les fichiers secrets.
- Ne jamais inclure de secret dans un commit, log, test snapshot, ou sortie terminal.

## next.js

Next.js ships version-matched documentation inside the next package, allowing AI coding agents to reference accurate, up-to-date APIs and patterns. An AGENTS.md file at the root of your project directs agents to these bundled docs instead of their training data.

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work:
1. Identify the feature involved.
2. Read the relevant doc in `node_modules/next/dist/docs/`.
3. Follow the bundled docs over model memory if they differ.

Use the local Next.js docs as the source of truth for:
- App Router
- Server vs Client Components
- data fetching and caching
- routing and navigation
- metadata
- middleware
- configuration

<!-- END:nextjs-agent-rules -->

## shadcn/ui

<!-- BEGIN:shadcn-agent-rules -->

# shadcn/ui: ALWAYS check project context before coding

Before any shadcn/ui work:
1. Read `.agents/skills/shadcn/SKILL.md`.
2. Run `pnpm dlx shadcn@latest info --json` to inspect the current project context.
3. Run `pnpm dlx shadcn@latest docs <component>` for every component you plan to add, modify, or compose.
4. Prefer existing shadcn components and built-in variants over custom markup.

Follow these rules:
- Use semantic tokens and component variants instead of raw Tailwind colors.
- Use `gap-*` instead of `space-x-*` / `space-y-*`.
- Use existing shadcn composition patterns before building custom wrappers.
- Never overwrite existing shadcn components blindly; preview updates with `--dry-run` and `--diff`.

<!-- END:shadcn-agent-rules -->

## TanStack Table

<!-- BEGIN:tanstack-table-agent-rules -->

# TanStack Table: ALWAYS align with repo patterns before coding

Before any TanStack Table work:
1. Inspect current table usage in this repo and the surrounding feature UI.
2. Read the relevant TanStack Table documentation for the feature being implemented.
3. Design the table API around reusable column definitions and feature flags, not one-off page markup.

Use TanStack Table for:
- sorting
- column visibility
- expandable rows
- pagination
- responsive table-to-card fallbacks

Do not:
- rebuild sorting or row state manually with ad hoc React state if TanStack already provides the model
- mix business logic into cell renderers when it belongs in selectors, formatters, or feature components
- hardcode mobile/desktop table variants separately when one shared table model can drive both

<!-- END:tanstack-table-agent-rules -->

node_modules/next/dist/docs/
├── 01-app/
│ ├── 01-getting-started/
│ ├── 02-guides/
│ └── 03-api-reference/
├── 02-pages/
├── 03-architecture/
└── index.mdx
