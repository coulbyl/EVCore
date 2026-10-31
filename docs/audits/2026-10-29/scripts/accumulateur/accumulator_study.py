"""Rejeu d'un chasseur d'accumulateur (cote combinée 8–30) sur l'espace
d'opportunités réglé (settled-picks.csv, 2026-07-01 → 2026-10-10).

Pas de probabilité du moteur, pas de coût appris : on empile des jambes d'une
bande de cote donnée, les plus courtes d'abord, une par match, au plus K par
championnat, jusqu'à atteindre la cible. On mesure jours composés, jours
gagnés, pire série, et l'écart entre « 1 fois sur N » annoncé par la cote et
le réalisé.
"""
import csv, sys, math
from collections import defaultdict

PATH = sys.argv[1]
MAIN = {"ONE_X_TWO", "DOUBLE_CHANCE", "OVER_UNDER", "BTTS", "TEAM_TOTAL_HOME",
        "TEAM_TOTAL_AWAY", "DRAW_NO_BET"}

rows = []
with open(PATH, newline="") as f:
    r = csv.DictReader(f)
    for x in r:
        if x["market"] not in MAIN:
            continue
        rows.append((x["day"], x["fixtureId"], x["competition"], x["market"],
                     x["pick"], float(x["odds"]),
                     None if x["won"] == "" else x["won"] == "1"))

by_day = defaultdict(list)
for row in rows:
    by_day[row[0]].append(row)
days = sorted(by_day)

def compose(day, lo, hi, tmin, tmax, max_legs, per_comp, order):
    cands = [r for r in by_day[day] if lo <= r[5] < hi]
    best = {}
    for r in cands:
        fid = r[1]
        if fid not in best or r[5] < best[fid][5]:
            best[fid] = r
    pool = sorted(best.values(), key=lambda r: r[5], reverse=(order == "long"))
    legs, prod, comp = [], 1.0, defaultdict(int)
    for r in pool:
        if comp[r[2]] >= per_comp:
            continue
        legs.append(r); comp[r[2]] += 1; prod *= r[5]
        if prod >= tmin:
            break
        if len(legs) >= max_legs:
            break
    if prod < tmin or prod > tmax:
        return None
    return legs, prod

def run(label, lo, hi, tmin, tmax, max_legs, per_comp=2, order="short"):
    n = won = 0; streak = cur = 0; cotes = []; legs_n = []
    inv_sum = 0.0; stake = ret = 0.0
    for d in days:
        c = compose(d, lo, hi, tmin, tmax, max_legs, per_comp, order)
        if c is None:
            continue
        legs, prod = c
        n += 1; cotes.append(prod); legs_n.append(len(legs))
        paid = 1.0; ok = True
        for r in legs:
            if r[6] is None:
                continue  # remboursé → cote 1
            if not r[6]:
                ok = False; break
            paid *= r[5]
        inv_sum += 1.0 / prod
        stake += 1
        if ok:
            won += 1; cur = 0; ret += paid
        else:
            cur += 1; streak = max(streak, cur)
    if n == 0:
        print(f"{label:34s} aucun jour"); return
    mean_cote = sum(cotes) / n
    announced = inv_sum / n  # fréquence impliquée par la cote (marge comprise)
    realised = won / n
    se = math.sqrt(realised * (1 - realised) / n) if n else 0
    print(f"{label:34s} jours {n:3d}  gagnés {won:2d} ({100*realised:4.1f} % ± {100*1.96*se:3.1f})"
          f"  1 sur {1/realised if realised else float('inf'):5.1f}  (cote dit 1 sur {1/announced:5.1f})"
          f"  pire série {streak:3d} j  cote {mean_cote:5.1f}  jambes {sum(legs_n)/n:4.1f}"
          f"  rendu {100*(ret/stake-1):+6.1f} %")

print(f"{len(days)} journées, {len(rows)} jambes des marchés principaux\n")
print("Chasseur d'accumulateur : jambes courtes empilées, les plus courtes d'abord")
for lo, hi, ml in [(1.20, 1.50, 14), (1.30, 1.60, 12), (1.40, 1.80, 10), (1.50, 2.00, 8)]:
    for tmin, tmax in [(8, 15), (15, 30), (8, 30)]:
        run(f"jambes {lo:.2f}-{hi:.2f}  cible {tmin}-{tmax}", lo, hi, tmin, tmax, ml)
print("\nVariante : jambes 1,80-3,00, 2 à 4 jambes (ce que fait le compositeur actuel)")
for tmin, tmax in [(8, 15), (15, 30)]:
    run(f"jambes 1.80-3.00  cible {tmin}-{tmax}", 1.80, 3.00, tmin, tmax, 4, per_comp=2)
print("\nVariante : une jambe par championnat")
run("jambes 1.30-1.60  cible 8-30  1/ch", 1.30, 1.60, 8, 30, 12, per_comp=1)
run("jambes 1.40-1.80  cible 8-30  1/ch", 1.40, 1.80, 8, 30, 10, per_comp=1)
print("\nRappel produits courts, même protocole")
run("jambes 1.20-1.50  cible 1.3-1.6", 1.20, 1.50, 1.3, 1.6, 2)
run("jambes 1.20-1.50  cible 2-3", 1.20, 1.50, 2, 3, 4)
