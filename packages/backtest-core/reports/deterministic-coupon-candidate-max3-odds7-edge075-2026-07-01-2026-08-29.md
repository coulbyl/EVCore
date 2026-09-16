# Backtest deterministic-5-7-v1

Période : 2026-07-01 → 2026-08-29. Politique LLM active inchangée.

| Segment         | Jours | Coupons | Gagnés | Perdus | Abst. | Non résolus | Réussite |   ROI |             IC95 |
| --------------- | ----: | ------: | -----: | -----: | ----: | ----------: | -------: | ----: | ---------------: |
| Global          |    60 |      50 |     13 |     37 |    10 |           0 |    26.0% | 35.0% |  [-29.2%, 99.3%] |
| Train 60 %      |    36 |      28 |      6 |     22 |     8 |           0 |    21.4% | 15.5% |  [-68.3%, 99.4%] |
| Validation 40 % |    24 |      22 |      7 |     15 |     2 |           0 |    31.8% | 59.8% | [-41.2%, 160.8%] |

Coupon moyen : 2.54 jambes, cote 5.28.

## Limites

- Historical stored channel decisions are replayed; the current engine is not recomputed.
- Stored selection odds are used because legacy selections have no immutable odds-snapshot link.
- Evaluated-market candidates are excluded; only stored rank-one selections are eligible.
- VANTAGE candidates are excluded, so neither composition nor candidate production uses AI.
- Historical AVOID signals and past schedule revisions cannot be reconstructed.
