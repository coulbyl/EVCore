# Backend (EVCore)

Backend NestJS du projet EVCore (ETL, stats rolling, modèle probabiliste, backtest).

## Références

- Guide d'écriture backend: [CODE_GUIDE.md](./CODE_GUIDE.md)
- Spécification produit: [../../EVCORE.md](../../EVCORE.md)
- Roadmap d'implémentation: [../../ROADMAP.md](../../ROADMAP.md)

## Setup

```bash
pnpm install
pnpm --filter backend dev
```

## Commandes utiles

```bash
pnpm --filter backend lint
pnpm --filter backend typecheck
pnpm --filter backend test
pnpm --filter backend test:e2e
```
