"""Accumulateur 8-15 (3 jambes 2-4, les moins chères d'abord) : semaine entière
contre week-end seul. Vivier par jour de semaine, jours gagnés, week-ends avec
au moins un gain, pire série."""
import csv, sys
from collections import defaultdict
from datetime import date

PATH = sys.argv[1]
MAIN = {"ONE_X_TWO", "DOUBLE_CHANCE", "OVER_UNDER", "BTTS", "TEAM_TOTAL_HOME", "TEAM_TOTAL_AWAY"}
by_day = defaultdict(list)
with open(PATH, newline="") as f:
    for x in csv.DictReader(f):
        if x["market"] not in MAIN: continue
        by_day[x["day"]].append((x["fixtureId"], x["competition"], float(x["odds"]),
                                 None if x["won"] == "" else x["won"] == "1"))
days = sorted(by_day)
def dow(d):
    y, m, dd = map(int, d.split("-")); return date(y, m, dd).isoweekday()
names = {1:"lun",2:"mar",3:"mer",4:"jeu",5:"ven",6:"sam",7:"dim"}

print("Vivier par jour de semaine (matchs distincts avec au moins une cote principale)")
fx = defaultdict(list)
for d in days: fx[dow(d)].append(len({r[0] for r in by_day[d]}))
for k in range(1, 8):
    v = fx[k]; print(f"  {names[k]}  {len(v):2d} jours  médiane {sorted(v)[len(v)//2]:4d} matchs")

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
        if r[3] is None: continue
        if not r[3]: return prod, 0.0
        paid *= r[2]
    return prod, paid

def run(label, allowed_dow, lo, hi, tmin, tmax, ml):
    res = {d: compose(d, lo, hi, tmin, tmax, ml) for d in days if dow(d) in allowed_dow}
    res = {d: v for d, v in res.items() if v}
    n = len(res); won = sum(1 for v in res.values() if v[1] > 0)
    streak = cur = 0
    for d in sorted(res):
        if res[d][1] > 0: cur = 0
        else: cur += 1; streak = max(streak, cur)
    weeks = defaultdict(list)
    for d, v in res.items():
        y, m, dd = map(int, d.split("-")); weeks[date(y, m, dd).isocalendar()[1]].append(v[1] - 1)
    wpos = sum(1 for w in weeks.values() if sum(w) > 0)
    wany = sum(1 for w in weeks.values() if any(x > 0 for x in w))
    cote = sum(v[0] for v in res.values()) / n
    print(f"{label:26s} cote {cote:4.1f}  coupons {n:3d}  gagnés {won:2d} ({100*won/n:4.1f} %)  pire série {streak:2d}"
          f"  semaines avec un gain {wany:2d}/{len(weeks):2d}  semaines dans le vert {wpos:2d}/{len(weeks):2d}"
          f"  rendu {100*(sum(v[1] for v in res.values())/n-1):+6.1f} %")

print("\nAccumulateur 8-15, 3 jambes 2,0-4,0")
run("tous les jours", set(range(1, 8)), 2.0, 4.0, 8, 15, 3)
run("samedi + dimanche", {6, 7}, 2.0, 4.0, 8, 15, 3)
run("vendredi à dimanche", {5, 6, 7}, 2.0, 4.0, 8, 15, 3)
print("\nAccumulateur 8-15, 7 jambes 1,40-1,80")
run("tous les jours", set(range(1, 8)), 1.4, 1.8, 8, 15, 10)
run("samedi + dimanche", {6, 7}, 1.4, 1.8, 8, 15, 10)
print("\nFavori et Combiné, pour comparer")
run("Favori, samedi + dimanche", {6, 7}, 1.2, 1.35, 1.2, 1.35, 1)
run("Combiné 1,4-1,6, sam + dim", {6, 7}, 1.2, 1.5, 1.4, 1.6, 2)
run("Cote 2-3, sam + dim", {6, 7}, 1.2, 1.6, 2.0, 3.0, 5)
