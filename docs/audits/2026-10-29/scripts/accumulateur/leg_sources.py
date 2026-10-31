"""Coût réel de chaque source de jambes (marché × bande de cote) sur l'espace
réglé, et rejeu d'un accumulateur 'intelligent' à 3-4 jambes longues."""
import csv, sys, math
from collections import defaultdict

PATH = sys.argv[1]
rows = []
with open(PATH, newline="") as f:
    for x in csv.DictReader(f):
        rows.append((x["day"], x["fixtureId"], x["competition"], x["market"],
                     x["pick"], float(x["odds"]),
                     None if x["won"] == "" else x["won"] == "1"))

def band(o):
    for lo, hi in [(1.2,1.5),(1.5,1.8),(1.8,2.2),(2.2,3),(3,4),(4,6),(6,12)]:
        if lo <= o < hi: return f"{lo}-{hi}"
    return None

print("Coût réel par marché × bande (jambes réglées, dernière analyse avant coup d'envoi)")
print(f"{'marché':20s} {'bande':8s} {'n':>7s} {'cote dit':>9s} {'réalisé':>9s} {'± 95%':>6s} {'rendu':>7s}")
agg = defaultdict(lambda: [0, 0, 0.0, 0.0])  # n, won, sum 1/odds, return
for r in rows:
    if r[6] is None: continue
    b = band(r[5])
    if b is None: continue
    a = agg[(r[3], b)]
    a[0] += 1; a[1] += r[6]; a[2] += 1 / r[5]; a[3] += r[5] if r[6] else 0
for (m, b), (n, w, inv, ret) in sorted(agg.items()):
    if n < 2000: continue
    p = w / n; se = 1.96 * math.sqrt(p * (1 - p) / n)
    print(f"{m:20s} {b:8s} {n:7d} {100*inv/n:8.1f}% {100*p:8.1f}% {100*se:5.1f} {100*(ret/n-1):+6.1f}%")

# Accumulateur 'chasseur' : jambes longues et calibrées, 3 à 4 jambes
by_day = defaultdict(list)
for r in rows: by_day[r[0]].append(r)
days = sorted(by_day)

def run(label, allowed, tmin, tmax, max_legs, per_comp=1):
    n = won = streak = cur = 0; inv = 0.0; stake = ret = 0.0; legs_n = 0
    for d in days:
        best = {}
        for r in by_day[d]:
            lo, hi = allowed.get(r[3], (None, None))
            if lo is None or not (lo <= r[5] < hi): continue
            if r[1] not in best or r[5] < best[r[1]][5]: best[r[1]] = r
        pool = sorted(best.values(), key=lambda r: r[5])
        legs, prod, comp = [], 1.0, defaultdict(int)
        for r in pool:
            if comp[r[2]] >= per_comp: continue
            legs.append(r); comp[r[2]] += 1; prod *= r[5]
            if prod >= tmin or len(legs) >= max_legs: break
        if prod < tmin or prod > tmax: continue
        n += 1; legs_n += len(legs); inv += 1 / prod; stake += 1
        ok, paid = True, 1.0
        for r in legs:
            if r[6] is None: continue
            if not r[6]: ok = False; break
            paid *= r[5]
        if ok: won += 1; cur = 0; ret += paid
        else: cur += 1; streak = max(streak, cur)
    if n == 0: print(f"{label:40s} aucun jour"); return
    p = won / n; se = 1.96 * math.sqrt(p * (1 - p) / n)
    print(f"{label:40s} jours {n:3d} gagnés {won:2d} ({100*p:4.1f} % ± {100*se:3.1f}) 1 sur {1/p if p else 0:5.1f}"
          f" (cote dit 1 sur {n/inv:5.1f}) pire série {streak:3d} j jambes {legs_n/n:3.1f} rendu {100*(ret/stake-1):+6.1f} %")

print("\nAccumulateur à jambes de chasseur (BTTS, Nul, plus/moins, 1X2), les moins chères d'abord")
H = {"BTTS": (1.6, 2.3), "ONE_X_TWO": (1.6, 3.8), "OVER_UNDER": (1.6, 2.3)}
run("BTTS+1X2(dont nul)+O/U 1,6-3,8  8-15", H, 8, 15, 4)
run("idem  15-30", H, 15, 30, 5)
H2 = {"BTTS": (1.6, 2.3), "OVER_UNDER": (1.6, 2.3)}
run("BTTS + O/U seulement  8-15", H2, 8, 15, 5)
H3 = {"ONE_X_TWO": (2.8, 3.8)}
run("Nuls seulement 2,8-3,8  8-15", H3, 8, 15, 3)
H4 = {"ONE_X_TWO": (3.0, 8.0), "BTTS": (1.6, 2.3)}
run("Grosses cotes 1X2 3-8 + BTTS  8-15", H4, 8, 15, 3)
run("Grosses cotes 1X2 3-8 + BTTS  15-30", H4, 15, 30, 3)

print("\nAccumulateur 'chasseur' : 3-4 jambes longues des marchés des chasseurs, les moins chères d'abord")
HH = {"BTTS": (1.8, 3.0), "ONE_X_TWO": (1.8, 3.0), "OVER_UNDER": (1.8, 3.0)}
run("BTTS/1X2/O-U 1,8-3,0  8-15  max 4  2/ch", HH, 8, 15, 4, per_comp=2)
HH2 = {"BTTS": (2.0, 4.0), "ONE_X_TWO": (2.0, 4.0), "OVER_UNDER": (2.0, 4.0)}
run("BTTS/1X2/O-U 2,0-4,0  8-15  max 3  2/ch", HH2, 8, 15, 3, per_comp=2)
run("BTTS/1X2/O-U 2,0-4,0  15-30 max 4  2/ch", HH2, 15, 30, 4, per_comp=2)
HH3 = {"ONE_X_TWO": (2.5, 4.0), "OVER_UNDER": (1.8, 3.0)}
run("Nuls/outsiders 2,5-4 + O-U 1,8-3  8-15 max 3", HH3, 8, 15, 3, per_comp=2)
