# Backend (EVCore)

Backend NestJS du projet EVCore (ETL, stats rolling, modèle probabiliste, backtest).

## Références

- Guide d'écriture backend: [CODE_GUIDE.md](./CODE_GUIDE.md)
- Runbook validation odds historiques: [docs/ODDS_HISTORICAL_VALIDATION.md](./docs/ODDS_HISTORICAL_VALIDATION.md)
- Spécification produit: [../../EVCORE.md](../../EVCORE.md)
- Roadmap d'implémentation: [../../ROADMAP.md](../../ROADMAP.md)

## Setup

```bash
pnpm install
pnpm --filter backend dev
```

## API Reference

- Scalar (OpenAPI): `http://localhost:3000/reference`

## Commandes utiles

```bash
pnpm --filter backend lint
pnpm --filter backend typecheck
pnpm --filter backend test
pnpm --filter backend test:e2e
```

## Données xG

- `stats-sync` marque maintenant les fixtures `xG unavailable` quand l'API renvoie `expected_goals: null`.
- Le calcul `rolling-stats` bascule sur un proxy par buts quand la couverture xG historique manque.
- Pour nettoyer les faux `0/0` historiques côté DB, utiliser:

```bash
pnpm --filter @evcore/db db:reset-zero-xg --codes=I2,F2,SP2,D2
pnpm --filter @evcore/db db:reset-zero-xg --apply --codes=I2,F2,SP2,D2
```
