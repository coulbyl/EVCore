#!/usr/bin/env python3
# Usage: python3 ou-shrinkage-generate-config.py fixtures.csv
# (same fixtures.csv export as ou-shrinkage-forward-backtest.py)
# Prints the OU_SHRINKAGE_CONFIG entries to paste into
# packages/analysis-core/src/probability/ou-shrinkage.ts.
"""Final shrinkage config, gated by the forward validation.

Shipping rule (per league, per block):
  - OU block: forward mean delta (o15..o45) <= -0.001 AND >= 3/4 lines pass.
  - btts / ht05 / ht15: own forward delta <= -0.001.
  - Skip blocks whose final full-sample factor >= 0.9 (identity in practice).

Shipped parameters are re-fitted on the FULL sample (standard practice once
the method is validated out-of-sample):
  - factor = full-sample OLS slope (OU: mean over the 4 lines), clamped [0,1].
  - base rates = the league's 2 most recent seasons.
Outputs the TypeScript entries for OU_SHRINKAGE_CONFIG.
"""
import csv, math, sys
from collections import defaultdict

path = sys.argv[1]
rows = list(csv.DictReader(open(path)))

def poisson_under_cdf(lt, k):
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
    o = {"o15": tot >= 2, "o25": tot >= 3, "o35": tot >= 4, "o45": tot >= 5,
         "btts": hs > 0 and aws > 0}
    if r["hht"] != "" and r["aht"] != "":
        htot = int(r["hht"]) + int(r["aht"])
        o["ht05"] = htot >= 1
        o["ht15"] = htot >= 2
    return o

MARKETS = ["o15", "o25", "o35", "o45", "btts", "ht05", "ht15"]

def fit_slope(data, market):
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
    return sum((x - mx) * (y - my) for x, y in pts) / sxx

def brier(data, market, transform):
    pts = [(transform(preds(r)[market]), 1.0 if outcomes(r).get(market) else 0.0)
           for r in data if outcomes(r).get(market) is not None]
    if not pts:
        return None
    return sum((p - y) ** 2 for p, y in pts) / len(pts)

def base_rate(data, market):
    ys = [outcomes(r).get(market) for r in data]
    ys = [1.0 if y else 0.0 for y in ys if y is not None]
    return sum(ys) / len(ys) if ys else None

by_league = defaultdict(list)
for r in rows:
    by_league[r["code"]].append(r)

entries = []
report = []
for code, data in sorted(by_league.items()):
    seasons = sorted({r["season"] for r in data})
    if len(seasons) < 2:
        continue
    # Forward split (same as forward_backtest.py)
    test_season = seasons[-1]
    train = [r for r in data if r["season"] != test_season]
    test = [r for r in data if r["season"] == test_season]
    if len(test) < 50:
        two = (seasons[-1], seasons[-2])
        test = [r for r in data if r["season"] in two]
        train = [r for r in data if r["season"] not in two]
        if len(train) < 100 or len(test) < 50:
            continue

    def forward_delta(m):
        s = fit_slope(train, m)
        b = base_rate(train, m)
        if s is None or b is None:
            return None, 0, 0
        f = min(1.0, max(0.0, s))
        raw = brier(test, m, lambda p: p)
        shr = brier(test, m, lambda p: min(1.0, max(0.0, b + f * (p - b))))
        if raw is None:
            return None, 0, 0
        return shr - raw, f, raw

    fw = {m: forward_delta(m) for m in MARKETS}
    ou_deltas = [fw[m][0] for m in ("o15", "o25", "o35", "o45")]
    if any(d is None for d in ou_deltas):
        continue
    ou_mean = sum(ou_deltas) / 4
    ou_npass = sum(1 for d in ou_deltas if d <= 0.0005)
    ship_ou = ou_mean <= -0.001 and ou_npass >= 3
    ship_btts = fw["btts"][0] is not None and fw["btts"][0] <= -0.001
    ship_ht05 = fw["ht05"][0] is not None and fw["ht05"][0] <= -0.001
    ship_ht15 = fw["ht15"][0] is not None and fw["ht15"][0] <= -0.001

    if not (ship_ou or ship_btts or ship_ht05 or ship_ht15):
        continue

    # Full-sample factors + recent (2 last seasons) base rates
    recent = [r for r in data if r["season"] in seasons[-2:]]
    def full_factor(ms):
        slopes = [fit_slope(data, m) for m in ms]
        slopes = [s for s in slopes if s is not None]
        if not slopes:
            return None
        return min(1.0, max(0.0, sum(slopes) / len(slopes)))

    f_ou = full_factor(["o15", "o25", "o35", "o45"])
    if ship_ou and (f_ou is None or f_ou >= 0.9):
        ship_ou = False
    f_btts = full_factor(["btts"])
    if ship_btts and (f_btts is None or f_btts >= 0.9):
        ship_btts = False
    f_ht05 = full_factor(["ht05"])
    f_ht15 = full_factor(["ht15"])
    if ship_ht05 and (f_ht05 is None or f_ht05 >= 0.9):
        ship_ht05 = False
    if ship_ht15 and (f_ht15 is None or f_ht15 >= 0.9):
        ship_ht15 = False
    if not (ship_ou or ship_btts or ship_ht05 or ship_ht15):
        continue

    b = {m: base_rate(recent, m) for m in MARKETS}
    r2 = lambda v: round(v + 1e-9, 2)

    lines = []
    slopes_txt = " · ".join(
        f"{m} {fit_slope(data, m):.2f}" for m in ("o15", "o25", "o35", "o45"))
    fwd_txt = f"forward ΔBrier OU {ou_mean:+.4f} ({ou_npass}/4)"
    lines.append(f"  // {code}: full-sample slopes {slopes_txt}; {fwd_txt}.")
    lines.append(f"  {code}: {{")
    if ship_ou:
        lines.append(f"    factor: {r2(f_ou)},")
        lines.append(
            f"    baseRates: {{ over15: {r2(b['o15'])}, over25: {r2(b['o25'])}, "
            f"over35: {r2(b['o35'])}, over45: {r2(b['o45'])} }},")
    else:
        # OU untouched: factor 1 = identity, bases still required by the type.
        lines.append("    factor: 1,")
        lines.append(
            f"    baseRates: {{ over15: {r2(b['o15'])}, over25: {r2(b['o25'])}, "
            f"over35: {r2(b['o35'])}, over45: {r2(b['o45'])} }},")
    if ship_btts and b["btts"] is not None:
        lines.append(f"    btts: {{ factor: {r2(f_btts)}, baseYes: {r2(b['btts'])} }},")
    if (ship_ht05 or ship_ht15) and b["ht05"] is not None and b["ht15"] is not None:
        f05 = r2(f_ht05) if ship_ht05 else 1
        f15 = r2(f_ht15) if ship_ht15 else 1
        lines.append(
            f"    ouHt: {{ factor05: {f05}, base05: {r2(b['ht05'])}, "
            f"factor15: {f15}, base15: {r2(b['ht15'])} }},")
    lines.append("  },")
    entries.append("\n".join(lines))
    report.append(
        f"{code:6} OU:{'SHIP f'+format(f_ou,'.2f') if ship_ou else 'skip':>10} "
        f"btts:{'SHIP f'+format(f_btts,'.2f') if ship_btts else 'skip':>10} "
        f"ht05:{'SHIP' if ship_ht05 else 'skip'} ht15:{'SHIP' if ship_ht15 else 'skip'}")

print("=== SHIP REPORT ===")
print("\n".join(report))
print(f"\n{len(report)} leagues configured")
print("\n=== TS CONFIG ===")
print("\n".join(entries))
