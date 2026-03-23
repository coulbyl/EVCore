# EVCore — TODO

> Branche active : `feat/engine-calibration-audit-2026-03-22`

---

## Compétitions internationales (trève mars 2026)

- [ ] Ajouter `apiSeasonOverride Int?` au modèle Competition dans `schema.prisma`
- [ ] Migrer la DB + rebuilder `@evcore/db`
- [ ] Modifier `computeSeasons()` dans `etl.service.ts` pour utiliser `apiSeasonOverride` quand présent
- [ ] Insérer les compétitions internationales en DB :
  - WCQE — WCQ Europe (leagueId=32, season=2024)
  - FRI  — Friendlies (leagueId=10, season=2026)
  - UNL  — UEFA Nations League (leagueId=5, season=2024)
- [ ] Ajouter WCQE, FRI, UNL, CAN, COPA dans `MODEL_SCORE_THRESHOLD_MAP` (`ev.constants.ts`)
- [ ] Déclencher ETL fixtures pour WCQE et FRI — vérifier les fixtures en DB
- [ ] Déclencher ETL odds-prematch pour les fixtures internationales
- [ ] Lancer le betting engine sur les fixtures internationales + audit des sélections
- [ ] lint + typecheck + tests (279) → commit
