# Backtest deterministic-5-15-v1

Période : 2026-07-01 → 2026-09-13. Politique LLM active inchangée.

| Segment         | Jours | Coupons | Gagnés | Perdus | Abst. | Non résolus | Réussite |    ROI |            IC95 |
| --------------- | ----: | ------: | -----: | -----: | ----: | ----------: | -------: | -----: | --------------: |
| Global          |    75 |      69 |     13 |     56 |     5 |           1 |    18.8% |  -3.8% | [-51.6%, 44.0%] |
| Train 60 %      |    45 |      39 |      8 |     31 |     5 |           1 |    20.5% |   8.7% | [-59.6%, 77.1%] |
| Validation 40 % |    30 |      30 |      5 |     25 |     0 |           0 |    16.7% | -20.1% | [-85.7%, 45.6%] |

Coupon moyen : 2.74 jambes, cote 5.52.

## Limites

- Historical stored channel decisions are replayed; the current engine is not recomputed.
- Stored selection odds are used because legacy selections have no immutable odds-snapshot link.
- Evaluated-market candidates are excluded; only stored rank-one selections are eligible.
- VANTAGE candidates are excluded, so neither composition nor candidate production uses AI.
- Historical AVOID signals and past schedule revisions cannot be reconstructed.
