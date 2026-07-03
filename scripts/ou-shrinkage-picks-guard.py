#!/usr/bin/env python3
# Usage: python3 ou-shrinkage-picks-guard.py generated_config.txt picks.csv
# generated_config.txt = the TS entries emitted by ou-shrinkage-generate-config.py.
# picks.csv export: settled SAFE/VALUE OVER_UNDER/BTTS/OVER_UNDER_HT
# channel_selections with odds + lambdas (see docs/data-poor-leagues-calibration.md).
"""Guard: what happens to real settled SAFE/VALUE O/U picks under shrinkage?

For each settled pick in a shipped league, recompute the shrunk probability
of the picked outcome and re-check EV = p'×odds − 1 ≥ 0.08 (the staking EV
gate). Report kept vs dropped counts and flat-stake ROI per group.
Good outcome: dropped picks have worse ROI than kept ones.
"""
import csv, math, re, sys

cfg_path, picks_path = sys.argv[1], sys.argv[2]

# Parse the generated TS entries (league → factors/bases)
cfg_src = open(cfg_path).read()
cfg = {}
for m in re.finditer(
    r"^\s{2}(\w+): \{\n(.*?)^\s{2}\},", cfg_src, re.S | re.M
):
    code, body = m.group(1), m.group(2)
    entry = {}
    fm = re.search(r"factor: ([\d.]+)", body)
    entry["factor"] = float(fm.group(1))
    bm = re.search(
        r"baseRates: \{ over15: ([\d.]+), over25: ([\d.]+), over35: ([\d.]+), over45: ([\d.]+) \}",
        body)
    entry["bases"] = dict(zip(("o15", "o25", "o35", "o45"),
                              map(float, bm.groups())))
    btts = re.search(r"btts: \{ factor: ([\d.]+), baseYes: ([\d.]+) \}", body)
    if btts:
        entry["btts"] = (float(btts.group(1)), float(btts.group(2)))
    ouht = re.search(
        r"ouHt: \{ factor05: ([\d.]+), base05: ([\d.]+), factor15: ([\d.]+), base15: ([\d.]+) \}",
        body)
    if ouht:
        entry["ouht"] = tuple(map(float, ouht.groups()))
    cfg[code] = entry

def poisson_under_cdf(lt, k):
    term, total = math.exp(-lt), math.exp(-lt)
    for i in range(1, k + 1):
        term *= lt / i
        total += term
    return total

def shrunk_pick_prob(row, entry):
    """Shrunk probability of the PICKED outcome, or None if market untouched."""
    lh, la = float(row["lh"]), float(row["la"])
    lt = lh + la
    market, pick = row["market"], row["pick"]

    def shrink(p_over, base, f):
        f = min(1.0, max(0.0, f))
        return min(1.0, max(0.0, base + f * (p_over - base)))

    if market == "OVER_UNDER":
        line_map = {"OVER_1_5": ("o15", 1), "UNDER_1_5": ("o15", 1),
                    "OVER": ("o25", 2), "UNDER": ("o25", 2),
                    "OVER_2_5": ("o25", 2), "UNDER_2_5": ("o25", 2),
                    "OVER_3_5": ("o35", 3), "UNDER_3_5": ("o35", 3),
                    "OVER_4_5": ("o45", 4), "UNDER_4_5": ("o45", 4)}
        if pick not in line_map:
            return None
        key, k = line_map[pick]
        p_over = 1 - poisson_under_cdf(lt, k)
        s = shrink(p_over, entry["bases"][key], entry["factor"])
        return s if pick.startswith("OVER") else 1 - s
    if market == "BTTS" and "btts" in entry:
        f, base = entry["btts"]
        p_yes = (1 - math.exp(-lh)) * (1 - math.exp(-la))
        s = shrink(p_yes, base, f)
        return s if pick == "YES" else 1 - s
    if market == "OVER_UNDER_HT" and "ouht" in entry:
        f05, b05, f15, b15 = entry["ouht"]
        ht = 0.44 * lt
        if pick in ("OVER_0_5", "UNDER_0_5"):
            s = shrink(1 - poisson_under_cdf(ht, 0), b05, f05)
            return s if pick == "OVER_0_5" else 1 - s
        if pick in ("OVER_1_5", "UNDER_1_5"):
            s = shrink(1 - poisson_under_cdf(ht, 1), b15, f15)
            return s if pick == "OVER_1_5" else 1 - s
    return None

kept, dropped, untouched = [], [], []
for row in csv.DictReader(open(picks_path)):
    entry = cfg.get(row["code"])
    odds = float(row["odds"])
    pnl = (odds - 1) if row["result"] == "WON" else -1.0
    if entry is None:
        untouched.append(pnl)
        continue
    p = shrunk_pick_prob(row, entry)
    if p is None:
        untouched.append(pnl)
        continue
    ev = p * odds - 1
    (kept if ev >= 0.08 else dropped).append(pnl)

def report(name, pnls):
    n = len(pnls)
    if n == 0:
        print(f"{name:10} n=0")
        return
    total = sum(pnls)
    print(f"{name:10} n={n:4d}  pnl={total:+8.1f}u  roi={100*total/n:+6.1f}%")

report("kept", kept)
report("dropped", dropped)
report("untouched", untouched)
