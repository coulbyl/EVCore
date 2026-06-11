<!--
Ce squelette se pré-remplit à chaque ouverture de PR. Remplis les sections
utiles, supprime celles qui ne s'appliquent pas. Garde-le court et factuel.
-->

## Résumé

<!-- 1-3 phrases : quoi et pourquoi. -->

## Changements

<!-- Liste par thème. Préfixe utile : 🐛 fix · ✨ feat · 📄 docs · ♻️ refactor · ✅ test -->

-

## 🐛 Bugs corrigés

<!-- Supprime la section s'il n'y en a pas. Une ligne par bug : impact → fix. -->

| Bug | Impact | Fix |
| --- | --- | --- |
|     |        |     |

## ✅ Tests & vérifications

<!-- Coche ce qui a tourné. -->

- [ ] `pnpm lint` (backend `--max-warnings 0`)
- [ ] `pnpm typecheck`
- [ ] `pnpm --filter backend test`
- [ ] Tests ml-worker (`pytest`) — si `apps/ml-worker` touché
- [ ] Vérification manuelle (préciser) :

## 🔁 Migration / données

<!-- Migration Prisma ? Backfill DB ? Sinon écris "Aucune". -->

Aucune.

## Note de revue

<!--
Points d'attention pour le relecteur. Rappels EVCore utiles :
- Le backend reste l'autorité finale ; le ML en shadow mode n'agit pas sur les décisions.
- Pas de seuil numérique en dur (config/), pas d'appel Prisma hors repository.
- Phase concernée (cf. ROADMAP.md / TODO.md).
-->

## Issues liées

<!-- Closes #123 -->
