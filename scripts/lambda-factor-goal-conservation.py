#!/usr/bin/env python3
"""Facteurs domicile/extérieur des lambdas : grille scorée sur 1X2, Over 2.5 et BTTS.

Reproduit le protocole simplifié de
packages/db/scripts/backtest-home-advantage-calibration.ts (meanLambda 1,4,
shrinkage 0,7, lambdaScale 1, aucune config par ligue, aucun bloc de shrinkage
O/U) en l'étendant aux marchés « buts », avec un découpage chronologique 70/30.
Le facteur de production (1,00 / 0,75) a été ajusté sur le Brier 1X2 seul : il
retire ~12 % des buts attendus et n'a jamais été scoré sur Over/Under ni BTTS.

Usage (base locale Docker) :
  python3 scripts/lambda-factor-goal-conservation.py            # exporte puis score
  python3 scripts/lambda-factor-goal-conservation.py data.csv   # rejoue un export
Dépendances : numpy. Entrée : matchs terminés des compétitions de backtest
depuis 2023-07-01 avec ≥ 5 lignes team_stats de la saison pour chaque équipe,
xG point-in-time = dernière ligne avant le coup d'envoi.
"""
import csv
import math
import subprocess
import sys

import numpy as np

EXPORT_SQL = r"""
WITH fx AS (
  SELECT f.id, f."scheduledAt", f."seasonId", c.code, f."homeTeamId" h, f."awayTeamId" a,
         f."homeScore" hs, f."awayScore" aws
  FROM fixture f JOIN season s ON s.id = f."seasonId" JOIN competition c ON c.id = s."competitionId"
  WHERE c."includeInBacktest" AND f.status = 'FINISHED' AND f."homeScore" IS NOT NULL
    AND f."scheduledAt" >= '2023-07-01' AND f."scheduledAt" < now()),
 th AS (
  SELECT DISTINCT ON (fx.id) fx.id, t."xgFor" xf, t."xgAgainst" xa,
    (SELECT count(*) FROM team_stats t2 JOIN fixture af2 ON af2.id = t2."afterFixtureId"
     WHERE t2."teamId" = fx.h AND af2."seasonId" = fx."seasonId" AND af2."scheduledAt" < fx."scheduledAt") prior
  FROM fx JOIN team_stats t ON t."teamId" = fx.h JOIN fixture af ON af.id = t."afterFixtureId"
  WHERE af."seasonId" = fx."seasonId" AND af."scheduledAt" < fx."scheduledAt"
  ORDER BY fx.id, af."scheduledAt" DESC),
 ta AS (
  SELECT DISTINCT ON (fx.id) fx.id, t."xgFor" xf, t."xgAgainst" xa,
    (SELECT count(*) FROM team_stats t2 JOIN fixture af2 ON af2.id = t2."afterFixtureId"
     WHERE t2."teamId" = fx.a AND af2."seasonId" = fx."seasonId" AND af2."scheduledAt" < fx."scheduledAt") prior
  FROM fx JOIN team_stats t ON t."teamId" = fx.a JOIN fixture af ON af.id = t."afterFixtureId"
  WHERE af."seasonId" = fx."seasonId" AND af."scheduledAt" < fx."scheduledAt"
  ORDER BY fx.id, af."scheduledAt" DESC)
SELECT fx."scheduledAt", fx.code, fx.hs, fx.aws, th.xf, th.xa, ta.xf, ta.xa
FROM fx JOIN th ON th.id = fx.id JOIN ta ON ta.id = fx.id
WHERE th.prior >= 5 AND ta.prior >= 5 AND th.xf IS NOT NULL AND ta.xf IS NOT NULL
ORDER BY fx."scheduledAt";
"""


def export_rows():
    out = subprocess.run(
        ["docker", "exec", "evcore-postgres", "psql", "-U", "postgres", "-d", "evcore",
         "-At", "-F,", "-c", EXPORT_SQL],
        check=True, capture_output=True, text=True,
    ).stdout
    return list(csv.reader(out.strip().splitlines()))


rows = list(csv.reader(open(sys.argv[1]))) if len(sys.argv) > 1 else export_rows()
dates = [r[0] for r in rows]
hs = np.array([int(r[2]) for r in rows])
aws = np.array([int(r[3]) for r in rows])
hxf, hxa = (np.array([float(r[i]) for r in rows]) for i in (4, 5))
axf, axa = (np.array([float(r[i]) for r in rows]) for i in (6, 7))
n = len(rows)
MEAN, SHRINK, MAXG = 1.4, 0.7, 10
league_avg = np.maximum(0.5, (hxf + axf + hxa + axa) / 4)
raw_home = SHRINK * (hxf * axa / league_avg) + (1 - SHRINK) * MEAN
raw_away = SHRINK * (axf * hxa / league_avg) + (1 - SHRINK) * MEAN
ks = np.arange(MAXG + 1)
logfact = np.array([math.lgamma(k + 1) for k in ks])
H, A = np.meshgrid(ks, ks, indexing="ij")
home_won, draw, away_won = (hs > aws) * 1.0, (hs == aws) * 1.0, (hs < aws) * 1.0
over25, btts = (hs + aws > 2) * 1.0, ((hs > 0) & (aws > 0)) * 1.0
split = int(n * 0.7)
mask_train = np.zeros(n, bool)
mask_train[:split] = True
mask_test = ~mask_train


def pmf(lam):
    lam = lam[:, None]
    p = np.exp(ks[None, :] * np.log(lam) - lam - logfact[None, :])
    return p / p.sum(axis=1, keepdims=True)


def score(h, a, m):
    lh, la = np.clip(raw_home * h, 0.05, 5), np.clip(raw_away * a, 0.05, 5)
    joint = pmf(lh)[:, :, None] * pmf(la)[:, None, :]
    p_home, p_draw, p_away = (joint[:, H > A].sum(1), joint[:, H == A].sum(1), joint[:, H < A].sum(1))
    p_over, p_btts = joint[:, (H + A) > 2].sum(1), joint[:, (H > 0) & (A > 0)].sum(1)
    b3 = ((p_home - home_won) ** 2 + (p_draw - draw) ** 2 + (p_away - away_won) ** 2)[m].mean()
    bo, bb = ((p_over - over25) ** 2)[m].mean(), ((p_btts - btts) ** 2)[m].mean()
    return dict(b3=b3, bo=bo, bb=bb, sum=b3 + bo + bb, lam_total=(lh + la)[m].mean(),
                goals=(hs + aws)[m].mean(), p_over=p_over[m].mean(), over=over25[m].mean(),
                p_btts=p_btts[m].mean(), btts=btts[m].mean(), p_home=p_home[m].mean(),
                home=home_won[m].mean(), p_away=p_away[m].mean(), away=away_won[m].mean())


def fmt(k, r):
    return (f"h={k[0]:.3f} a={k[1]:.3f} | brier3={r['b3']:.5f} over25={r['bo']:.5f} btts={r['bb']:.5f} "
            f"sum={r['sum']:.5f} | lam_tot={r['lam_total']:.3f} goals={r['goals']:.3f} | "
            f"P(over) {r['p_over']:.3f} vs {r['over']:.3f} | P(btts) {r['p_btts']:.3f} vs {r['btts']:.3f} | "
            f"P(home) {r['p_home']:.3f} vs {r['home']:.3f} | P(away) {r['p_away']:.3f} vs {r['away']:.3f}")


grid = {(h, a): score(h, a, mask_train)
        for h in np.round(np.arange(0.85, 1.251, 0.025), 3)
        for a in np.round(np.arange(0.65, 1.051, 0.025), 3)}
best = lambda key: min(grid, key=lambda k: grid[k][key])
cur = (1.0, 0.75)
print(f"n={n} train={split} test={n - split} window {dates[0][:10]} -> {dates[-1][:10]}")
print("\n== TRAIN (70 %) ==")
print("current      ", fmt(cur, grid[cur]))
for key in ("b3", "bo", "bb", "sum"):
    print(f"best {key:<4}     ", fmt(best(key), grid[best(key)]))
print("\n== TEST (30 %, untouched) ==")
for name, k in {"current": cur, "best_b3": best("b3"), "best_sum": best("sum"), "neutral": (1.0, 1.0)}.items():
    print(f"{name:<9}", fmt(k, score(k[0], k[1], mask_test)))
print("\n== TEST: same 1X2 asymmetry as current (h/a = 1,333), total de buts croissant ==")
for h, a in [(1.0, 0.75), (1.05, 0.7875), (1.1, 0.825), (1.15, 0.8625), (1.2, 0.9)]:
    print(fmt((h, a), score(h, a, mask_test)))
