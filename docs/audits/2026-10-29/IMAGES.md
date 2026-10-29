# Images de déploiement : mesure et correctifs

_Lot 7 (`docs/plan-lot-7-2026-10-29.md`). Le script serveur `/opt/apps/scripts/deploy-evcore.sh`, hors dépôt, n'est pas modifié._

## Réponse courte

1. **Le temps de déploiement varie surtout côté serveur** : de 42 s à 6 min 24 selon les déploiements, alors que les quatre images se construisent en parallèle en 2 min 30 à 3 min 54.
2. **À chaque version, le serveur retéléchargeait toutes les dépendances.** Dans l'image backend (967 Mo), la couche `node_modules` de 539 Mo était recréée à chaque fois, même sans changement de dépendances. C'était pareil pour VANTAGE (environ 390 Mo).
3. **Les conteneurs backend et web étaient toujours « unhealthy ».** Le `HEALTHCHECK` appelait `http://localhost:…`. Dans le conteneur, busybox `wget` résout `localhost` en `::1`, alors que les serveurs n'écoutent qu'en IPv4. Mesuré sur l'image de `main` : 5 échecs sur 5. Si le script serveur attend l'état healthy, cela peut expliquer les déploiements longs et irréguliers.
4. **Après correctifs**, une version qui ne touche pas aux dépendances ne fait plus retélécharger que le code :

| Image          | Taille | Avant : à retélécharger par version | Après |
| -------------- | -----: | ----------------------------------: | ----: |
| backend        | 967 Mo |                             ~550 Mo | 27 Mo |
| vantage-worker | 747 Mo |                             ~390 Mo | 21 Mo |
| web            | 344 Mo |                              ~58 Mo | 18 Mo |

« Après » est mesuré en local : deux constructions avec une modification d'une ligne entre les deux, puis comparaison des condensés de couches. « Avant » est la taille des couches recréées par l'ancienne image : `node_modules` et code, en une seule couche.

## Ce qui a changé

- **Étape `deps`** : `pnpm fetch` sur le seul `pnpm-lock.yaml`. La couche reste en cache tant que le lockfile ne bouge pas, en local et via le cache de registre en CI. Ensuite, `pnpm install --offline` : **54 s → 3 s** en construction chaude.
- **Deux couches de dépendances.** Pour le backend et VANTAGE, les paquets tiers d'un côté, les paquets du dépôt de l'autre (`@evcore/*` et `.modules.yaml`, qui porte une date). Pour le web, les `node_modules` tracés du bundle `standalone` sont séparés du code du serveur.
- **Couches reproductibles** (`deploy.yml`) : `rewrite-timestamp=true` avec `SOURCE_DATE_EPOCH` fixé sur le dernier commit. À contenu identique, le condensé est identique : la couche n'est ni repoussée ni retéléchargée.
- **Contexte de build allégé** : `.dockerignore` exclut maintenant `apps/web/.next` (9 Go en local), les résultats de tests, `apps/web/e2e`, `.claude` et les données d'audit.
- **`HEALTHCHECK` sur `127.0.0.1`** : le backend reconstruit passe « healthy » en local.

## Non fait

- `pnpm deploy` prend toujours environ 85 s en construction chaude. Le mode `--offline` échoue (`ERR_PNPM_NO_OFFLINE_META`), et c'est une étape de construction, pas un téléchargement serveur.
- Le runtime backend embarque le CLI Prisma, avec TypeScript, Prettier et Prisma Studio, soit environ 120 Mo. Il en a besoin pour les migrations au démarrage. À étudier à part.

## À vérifier après le premier déploiement

- Les durées des jobs, en particulier « Deploy to Hetzner », sur les deux ou trois premiers déploiements après fusion. Le premier reconstruit encore toutes les couches : les nouvelles couches doivent être poussées une première fois.
- Sur le serveur, `docker ps` doit montrer les conteneurs backend et web en `healthy`.
