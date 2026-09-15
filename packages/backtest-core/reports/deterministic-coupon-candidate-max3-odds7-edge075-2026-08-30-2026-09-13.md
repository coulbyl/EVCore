# Backtest deterministic-5-7-v1

Période : 2026-08-30 → 2026-09-13. Politique LLM active inchangée.

| Segment | Jours | Coupons | Gagnés | Perdus | Abst. | Non résolus | Réussite | ROI | IC95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Global | 15 | 12 | 2 | 10 | 3 | 0 | 16.7% | -6.9% | [-130.6%, 116.9%] |
| Train 60 % | 9 | 7 | 0 | 7 | 2 | 0 | 0.0% | -100.0% | [-100.0%, -100.0%] |
| Validation 40 % | 6 | 5 | 2 | 3 | 1 | 0 | 40.0% | 123.5% | [-146.8%, 393.8%] |

Coupon moyen : 2.50 jambes, cote 5.28.

## Limites

- Historical stored channel decisions are replayed; the current engine is not recomputed.
- Stored selection odds are used because legacy selections have no immutable odds-snapshot link.
- Evaluated-market candidates are excluded; only stored rank-one selections are eligible.
- VANTAGE candidates are excluded, so neither composition nor candidate production uses AI.
- Historical AVOID signals and past schedule revisions cannot be reconstructed.
