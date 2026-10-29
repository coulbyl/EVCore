"""Rejeu 2023-2026 sur le prix Pinnacle 1X2 d'avant coup d'envoi : accumulateur
week-end contre tous les jours. Une jambe par match, 2 par championnat, les
moins chères d'abord."""
import sys, math
from collections import defaultdict
from datetime import date

by_day = defaultdict(list)
with open(sys.argv[1]) as f:
    for line in f:
        p = line.rstrip("\n").split("|")
        if len(p) != 6: continue
        by_day[p[0]].append((p[1], p[2], float(p[4]), p[5] == "1"))
days = sorted(by_day)
def dow(d):
    y, m, dd = map(int, d.split("-")); return date(y, m, dd).isoweekday()
def wk(d):
    y, m, dd = map(int, d.split("-")); c = date(y, m, dd).isocalendar(); return (c[0], c[1])

print("Matchs par jour de semaine (médiane)")
fx = defaultdict(list)
for d in days: fx[dow(d)].append(len({r[0] for r in by_day[d]}))
print("  " + "  ".join(f"{k}:{sorted(v)[len(v)//2]}" for k, v in sorted(fx.items())))

def compose(d, lo, hi, tmin, tmax, max_legs, per_comp=2):
    best = {}
    for r in by_day[d]:
        if lo <= r[2] < hi and (r[0] not in best or r[2] < best[r[0]][2]): best[r[0]] = r
    legs, prod, comp = [], 1.0, defaultdict(int)
    for r in sorted(best.values(), key=lambda r: r[2]):
        if comp[r[1]] >= per_comp: continue
        legs.append(r); comp[r[1]] += 1; prod *= r[2]
        if prod >= tmin or len(legs) >= max_legs: break
    if prod < tmin or prod > tmax: return None
    paid = 1.0
    for r in legs:
        if not r[3]: return prod, 0.0, len(legs)
        paid *= r[2]
    return prod, paid, len(legs)

def run(label, allowed, lo, hi, tmin, tmax, ml, per_comp=2):
    res = {}
    for d in days:
        if dow(d) in allowed:
            c = compose(d, lo, hi, tmin, tmax, ml, per_comp)
            if c: res[d] = c
    n = len(res)
    if not n: print(label, "rien"); return
    won = sum(1 for v in res.values() if v[1] > 0)
    p = won / n; se = 1.96 * math.sqrt(p * (1 - p) / n)
    streak = cur = 0
    for d in sorted(res):
        if res[d][1] > 0: cur = 0
        else: cur += 1; streak = max(streak, cur)
    weeks = defaultdict(list)
    for d, v in res.items(): weeks[wk(d)].append(v[1] - 1)
    wany = sum(1 for w in weeks.values() if any(x > 0 for x in w))
    wpos = sum(1 for w in weeks.values() if sum(w) > 0)
    cote = sum(v[0] for v in res.values()) / n
    implied = sum(1 / v[0] for v in res.values()) / n
    print(f"{label:24s} cote {cote:4.1f} coupons {n:4d} gagnés {100*p:5.1f} % ± {100*se:3.1f} (cote dit {100*implied:4.1f} %)"
          f" pire série {streak:3d} | semaines : un gain {100*wany/len(weeks):3.0f} %  vert {100*wpos/len(weeks):3.0f} % ({len(weeks)}) | rendu {100*(sum(v[1] for v in res.values())/n-1):+5.1f} %")

ALL, WE = set(range(1, 8)), {6, 7}
for title, lo, hi, tmin, tmax, ml in [
    ("Accu 8-15, 3 jambes 2-4", 2.0, 4.0, 8, 15, 3),
    ("Accu 8-15, 7 jambes 1,4-1,8", 1.4, 1.8, 8, 15, 10),
    ("Accu 15-30, 4 jambes 2-4", 2.0, 4.0, 15, 30, 4),
    ("Cote 5-8, 2-3 jambes 2-3", 2.0, 3.0, 5, 8, 3),
    ("Cote 2-3, jambes 1,2-1,6", 1.2, 1.6, 2, 3, 5),
    ("Combiné 1,4-1,6", 1.2, 1.5, 1.4, 1.6, 2),
    ("Favori 1,20-1,35", 1.2, 1.35, 1.2, 1.35, 1),
]:
    print(f"\n{title}")
    run("  tous les jours", ALL, lo, hi, tmin, tmax, ml)
    run("  samedi + dimanche", WE, lo, hi, tmin, tmax, ml)
    run("  lundi à vendredi", ALL - WE, lo, hi, tmin, tmax, ml)
