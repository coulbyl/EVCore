"""Frontière jours gagnés / cote, et bilan par semaine et par mois à mise fixe."""
import csv, sys, math
from collections import defaultdict
from datetime import date

PATH = sys.argv[1]
MAIN = {"ONE_X_TWO", "DOUBLE_CHANCE", "OVER_UNDER", "BTTS", "TEAM_TOTAL_HOME", "TEAM_TOTAL_AWAY"}
by_day = defaultdict(list)
with open(PATH, newline="") as f:
    for x in csv.DictReader(f):
        if x["market"] not in MAIN: continue
        by_day[x["day"]].append((x["fixtureId"], x["competition"], x["market"], float(x["odds"]),
                                 None if x["won"] == "" else x["won"] == "1"))
days = sorted(by_day)

def compose(d, lo, hi, tmin, tmax, max_legs, per_comp=2):
    best = {}
    for r in by_day[d]:
        if lo <= r[3] < hi and (r[0] not in best or r[3] < best[r[0]][3]): best[r[0]] = r
    legs, prod, comp = [], 1.0, defaultdict(int)
    for r in sorted(best.values(), key=lambda r: r[3]):
        if comp[r[1]] >= per_comp: continue
        legs.append(r); comp[r[1]] += 1; prod *= r[3]
        if prod >= tmin or len(legs) >= max_legs: break
    if prod < tmin or prod > tmax: return None
    paid = 1.0
    for r in legs:
        if r[4] is None: continue
        if not r[4]: return prod, 0.0
        paid *= r[3]
    return prod, paid

def run(label, lo, hi, tmin, tmax, max_legs):
    daily = {}
    for d in days:
        c = compose(d, lo, hi, tmin, tmax, max_legs)
        if c: daily[d] = c
    n = len(daily); won = sum(1 for v in daily.values() if v[1] > 0)
    weeks, months = defaultdict(float), defaultdict(float)
    wk_n, mo_n = defaultdict(int), defaultdict(int)
    for d, (prod, paid) in daily.items():
        y, m, dd = map(int, d.split("-")); dt = date(y, m, dd)
        wk = dt.isocalendar()[1]; weeks[wk] += paid - 1; wk_n[wk] += 1
        months[m] += paid - 1; mo_n[m] += 1
    wpos = sum(1 for w in weeks if weeks[w] > 0); mpos = sum(1 for m in months if months[m] > 0)
    cote = sum(v[0] for v in daily.values()) / n
    print(f"{label:28s} cote {cote:5.1f}  jours {won:3d}/{n:3d} gagnés ({100*won/n:4.1f} %)"
          f"  semaines positives {wpos:2d}/{len(weeks):2d}  mois positifs {mpos}/{len(months)}"
          f"  rendu {100*(sum(v[1] for v in daily.values())/n-1):+6.1f} %")

print("Frontière : jambes les moins chères d'abord, 1 par match, 2 par championnat")
for label, lo, hi, tmin, tmax, ml in [
    ("Favori (1 jambe 1,20-1,35)", 1.20, 1.35, 1.2, 1.35, 1),
    ("cible 1,4-1,6", 1.20, 1.50, 1.4, 1.6, 2),
    ("cible 1,8-2,2", 1.20, 1.60, 1.8, 2.2, 4),
    ("cible 2-3", 1.20, 1.60, 2.0, 3.0, 5),
    ("cible 3-5 (jambes 1,8-3)", 1.80, 3.00, 3.0, 5.0, 2),
    ("cible 5-8 (jambes 1,8-3)", 1.80, 3.00, 5.0, 8.0, 3),
    ("cible 8-15 (jambes 2-4)", 2.00, 4.00, 8.0, 15.0, 3),
    ("cible 15-30 (jambes 2-4)", 2.00, 4.00, 15.0, 30.0, 4),
]:
    run(label, lo, hi, tmin, tmax, ml)
