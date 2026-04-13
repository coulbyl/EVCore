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

node_modules/next/dist/docs/
├── 01-app/
│ ├── 01-getting-started/
│ ├── 02-guides/
│ └── 03-api-reference/
├── 02-pages/
├── 03-architecture/
└── index.mdx
