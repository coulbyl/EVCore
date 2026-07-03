#!/usr/bin/env python3
# Usage: python3 ou-shrinkage-forward-backtest.py fixtures.csv
# fixtures.csv export:
#   docker exec evcore-postgres psql -U postgres -d evcore -c "\\copy (
#     SELECT DISTINCT ON (f.id) c.code, s.name AS season,
#            f.\"homeScore\" AS hs, f.\"awayScore\" AS aws,
#            f.\"homeHtScore\" AS hht, f.\"awayHtScore\" AS aht,
#            (mr.features->>'lambdaHome')::float AS lh,
#            (mr.features->>'lambdaAway')::float AS la
#     FROM model_run mr JOIN fixture f ON f.id=mr.\"fixtureId\"
#     JOIN season s ON s.id=f.\"seasonId\" JOIN competition c ON c.id=s.\"competitionId\"
#     WHERE f.status='FINISHED' AND mr.features->>'lambdaHome' IS NOT NULL
#       AND f.\"homeScore\" IS NOT NULL
#     ORDER BY f.id, mr.\"analyzedAt\" DESC) TO '/tmp/fixtures.csv' WITH CSV HEADER"
"""Forward validation of O/U probability shrinkage, per league × market.

Method (honest out-of-sample):
  - train = all seasons except the league's most recent; test = most recent.
  - On train: fit slope (OLS realized ~ predicted) and base rate.
  - On test: brier(raw) vs brier(shrunk) where shrunk = base + f×(p−base),
    f clamped to [0,1].
  - A market block passes if brier improves (or ties) on the held-out season.

Markets: pooled O/U lines (o15..o45, one shared factor = mean of slopes,
per-line bases), BTTS, HT o05/o15 (per-line factors).
"""
import csv, math, sys
from collections import defaultdict

path = sys.argv[1]
rows = list(csv.DictReader(open(path)))

def poisson_under_cdf(lt, k):
    # P(N <= k) for N ~ Poisson(lt)
    term, total = math.exp(-lt), math.exp(-lt)
    for i in range(1, k + 1):
        term *= lt / i
        total += term
    return total

def preds(r):
    lh, la = float(r["lh"]), float(r["la"])
    lt = lh + la
    p = {
        "o15": 1 - poisson_under_cdf(lt, 1),
        "o25": 1 - poisson_under_cdf(lt, 2),
        "o35": 1 - poisson_under_cdf(lt, 3),
        "o45": 1 - poisson_under_cdf(lt, 4),
        "btts": (1 - math.exp(-lh)) * (1 - math.exp(-la)),
    }
    ht = 0.44 * lt
    p["ht05"] = 1 - poisson_under_cdf(ht, 0)
    p["ht15"] = 1 - poisson_under_cdf(ht, 1)
    return p

def outcomes(r):
    hs, aws = int(r["hs"]), int(r["aws"])
    tot = hs + aws
    o = {
        "o15": tot >= 2, "o25": tot >= 3, "o35": tot >= 4, "o45": tot >= 5,
        "btts": hs > 0 and aws > 0,
    }
    if r["hht"] != "" and r["aht"] != "":
        htot = int(r["hht"]) + int(r["aht"])
        o["ht05"] = htot >= 1
        o["ht15"] = htot >= 2
    return o

MARKETS = ["o15", "o25", "o35", "o45", "btts", "ht05", "ht15"]

by_league = defaultdict(list)
for r in rows:
    by_league[r["code"]].append(r)

def fit(data, market):
    """Returns (slope, base) of realized ~ predicted, or None if degenerate."""
    pts = [(preds(r)[market], outcomes(r).get(market)) for r in data]
    pts = [(x, 1.0 if y else 0.0) for x, y in pts if y is not None]
    n = len(pts)
    if n < 50:
        return None
    mx = sum(x for x, _ in pts) / n
    my = sum(y for _, y in pts) / n
    sxx = sum((x - mx) ** 2 for x, _ in pts)
    if sxx < 1e-9:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in pts)
    return sxy / sxx, my

def brier(data, market, transform):
    pts = []
    for r in data:
        y = outcomes(r).get(market)
        if y is None:
            continue
        pts.append((transform(preds(r)[market]), 1.0 if y else 0.0))
    if not pts:
        return None, 0
    return sum((p - y) ** 2 for p, y in pts) / len(pts), len(pts)

print(f"{'league':6} {'market':6} {'nTr':>5} {'nTe':>4} {'slope':>6} {'base':>5} "
      f"{'brierRaw':>9} {'brierShr':>9} {'delta':>8} pass")

results = defaultdict(dict)
for code, data in sorted(by_league.items()):
    seasons = sorted({r["season"] for r in data})
    if len(seasons) < 2:
        continue
    test_season = seasons[-1]
    train = [r for r in data if r["season"] != test_season]
    test = [r for r in data if r["season"] == test_season]
    if len(test) < 50:
        # merge two last seasons as test if last is tiny? no — keep honest, skip.
        test_season2 = seasons[-2]
        # use last season as test only if >=50; else use previous as test and rest as train
        test = [r for r in data if r["season"] in (test_season, test_season2)]
        train = [r for r in data if r["season"] not in (test_season, test_season2)]
        if len(train) < 100 or len(test) < 50:
            continue

    for m in MARKETS:
        fitted = fit(train, m)
        if fitted is None:
            continue
        slope, base = fitted
        f = min(1.0, max(0.0, slope))
        raw, n_te = brier(test, m, lambda p: p)
        shr, _ = brier(test, m, lambda p: min(1.0, max(0.0, base + f * (p - base))))
        if raw is None:
            continue
        delta = shr - raw
        ok = delta <= 0.0005  # pass = improves or ties (tolerance 5e-4)
        results[code][m] = {"slope": slope, "base": base, "f": f,
                            "raw": raw, "shr": shr, "delta": delta,
                            "pass": ok, "n_train": len(train), "n_test": n_te}
        print(f"{code:6} {m:6} {len(train):5d} {n_te:4d} {slope:6.2f} {base:5.2f} "
              f"{raw:9.4f} {shr:9.4f} {delta:+8.4f} {'PASS' if ok else 'fail'}")

# Summary: leagues where the pooled O/U block improves
print("\n=== SUMMARY (mean delta over o15..o45; negative = shrinkage better) ===")
for code in sorted(results):
    ou = [results[code][m] for m in ("o15", "o25", "o35", "o45") if m in results[code]]
    if len(ou) < 4:
        continue
    mean_delta = sum(r["delta"] for r in ou) / 4
    mean_f = sum(r["f"] for r in ou) / 4
    n_pass = sum(1 for r in ou if r["pass"])
    btts = results[code].get("btts")
    ht05 = results[code].get("ht05")
    ht15 = results[code].get("ht15")
    fmt = lambda r: (f"{r['delta']:+.4f}/f{r['f']:.2f}" if r else "  n/a  ")
    print(f"{code:6} OU mean_delta {mean_delta:+.4f} mean_f {mean_f:.2f} pass {n_pass}/4 | "
          f"btts {fmt(btts)} | ht05 {fmt(ht05)} | ht15 {fmt(ht15)}")
