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
