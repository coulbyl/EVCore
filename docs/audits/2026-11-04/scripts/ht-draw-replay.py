"""Chasseur Nul à la mi-temps — rejeu de la règle sur les clôtures.

Entrée : le CSV de ht-draw-closings.sql (une ligne par match et par book).
    python3 -I ht-draw-replay.py ht-draw.csv

Règle (HUNTER_HT_DRAW_CLASS, composeHunterByMarket) : par jour de coup
d'envoi (UTC), parmi les matchs dont le nul à la mi-temps est coté de 2,10 à
2,80, la marge la plus basse du groupe à trois issues, puis la fréquence du
marché (normalisation proportionnelle, `fairProbabilities`) la plus haute.
"""

import collections
import csv
import math
import sys

LO, HI = 2.10, 2.80


def load(path):
    by_book = collections.defaultdict(dict)
    for r in csv.DictReader(open(path)):
        h, d, a = float(r["home"]), float(r["draw"]), float(r["away"])
        over = 1 / h + 1 / d + 1 / a
        by_book[r["bookmaker"]][r["fixtureId"]] = {
            "fixture": r["fixtureId"],
            "day": r["day"],
            "draw": d,
            "margin": over - 1,
            "fair": (1 / d) / over,
            "won": int(r["hht"]) == int(r["aht"]),
            "hours": float(r["hours"]),
        }
    return by_book


def ci(k, n):
    p = k / n
    return p, 1.96 * math.sqrt(p * (1 - p) / n)


def worst_streak(results):
    run = best = 0
    for won in results:
        run = 0 if won else run + 1
        best = max(best, run)
    return best


def calibration(rows, label):
    n = len(rows)
    k = sum(r["won"] for r in rows)
    p, e = ci(k, n)
    fair = sum(r["fair"] for r in rows) / n
    margin = sum(r["margin"] for r in rows) / n
    odds = sum(r["draw"] for r in rows) / n
    print(
        f"{label}: n={n} announced={fair:.4f} realised={p:.4f}±{e:.4f} "
        f"margin={margin:.4f} mean draw odds={odds:.3f}"
    )


def replay(rows, label, lo=LO, hi=HI, cost=None):
    """cost(row) → the margin the rule ranks on (default: the book's own)."""
    cost = cost or (lambda r: r["margin"])
    by_day = collections.defaultdict(list)
    days = set()
    for r in rows:
        days.add(r["day"])
        if lo <= r["draw"] <= hi:
            by_day[r["day"]].append(r)
    picks = []
    for day in sorted(days):
        cands = by_day.get(day)
        if not cands:
            continue
        best = min(cands, key=lambda r: (cost(r), -r["fair"], r["fixture"]))
        picks.append(best)
    n = len(picks)
    k = sum(r["won"] for r in picks)
    p, e = ci(k, n)
    fair = sum(r["fair"] for r in picks) / n
    odds = sum(r["draw"] for r in picks) / n
    margin = sum(r["margin"] for r in picks) / n
    ret = sum(r["draw"] if r["won"] else 0 for r in picks) / n
    rets = [r["draw"] if r["won"] else 0 for r in picks]
    sd = math.sqrt(sum((x - ret) ** 2 for x in rets) / (n - 1))
    print(
        f"{label}: days {n}/{len(days)} won {k} realised={p:.4f}±{e:.4f} "
        f"announced={fair:.4f} odds={odds:.3f} margin={margin:.4f} "
        f"return/unit={ret:.4f}±{1.96 * sd / math.sqrt(n):.4f} "
        f"worst streak={worst_streak([r['won'] for r in picks])} "
        f"from {picks[0]['day']} to {picks[-1]['day']}"
    )
    return picks


def by_year(picks):
    years = collections.defaultdict(list)
    for r in picks:
        years[r["day"][:4]].append(r)
    for year, rs in sorted(years.items()):
        n = len(rs)
        k = sum(r["won"] for r in rs)
        p, e = ci(k, n)
        fair = sum(r["fair"] for r in rs) / n
        ret = sum(r["draw"] if r["won"] else 0 for r in rs) / n
        print(
            f"  {year}: days {n} realised={p:.4f}±{e:.4f} announced={fair:.4f} "
            f"return/unit={ret:.4f} worst streak="
            f"{worst_streak([r['won'] for r in rs])}"
        )


def main():
    books = load(sys.argv[1])
    pin = list(books["Pinnacle"].values())
    one = books["1xBet"]

    print("== Calibration du nul à la mi-temps, tous les matchs ==")
    calibration(pin, "Pinnacle, all")
    calibration([r for r in pin if LO <= r["draw"] <= HI], "Pinnacle, 2.10-2.80")
    calibration(list(one.values()), "1xBet, all")

    print("\n== Rejeu de la règle sur Pinnacle ==")
    picks = replay(pin, "Pinnacle 2.10-2.80")
    by_year(picks)
    replay(pin, "Pinnacle 2.20-2.70 (study band)", 2.20, 2.70)

    # CLAUDE.md : un dernier prix à 24 h n'est pas une clôture. Les seuls
    # prix à moins de 3 h du coup d'envoi.
    fresh = [r for r in pin if r["hours"] <= 3]
    print("\n== Pinnacle, prix à moins de 3 h ==")
    calibration(fresh, "Pinnacle <= 3 h, all")
    replay(fresh, "Pinnacle <= 3 h, 2.10-2.80")

    # Prix 1xBet : même règle, moins l'écart de marge. Sur les jours où
    # 1xBet cote le match retenu, le paiement réel chez lui.
    gap = [r for r in picks if r["fixture"] in one]
    if gap:
        n = len(gap)
        pin_ret = sum(r["draw"] if r["won"] else 0 for r in gap) / n
        one_ret = sum(one[r["fixture"]]["draw"] if r["won"] else 0 for r in gap) / n
        pin_m = sum(r["margin"] for r in gap) / n
        one_m = sum(one[r["fixture"]]["margin"] for r in gap) / n
        odds = sum(one[r["fixture"]]["draw"] for r in gap) / n
        print(
            f"\nSame picks priced at 1xBet: n={n} pinnacle return={pin_ret:.4f} "
            f"1xBet return={one_ret:.4f} margin pin={pin_m:.4f} 1xBet={one_m:.4f} "
            f"1xBet odds={odds:.3f}"
        )
    # Ce que coûte, en moyenne, l'écart de marge sur tout le rejeu.
    one_all = list(one.values())
    m_one = sum(r["margin"] for r in one_all) / len(one_all)
    m_pick = sum(r["margin"] for r in picks) / len(picks)
    ret = sum(r["draw"] if r["won"] else 0 for r in picks) / len(picks)
    print(
        f"Margin-gap adjusted return: {ret:.4f} x (1+{m_pick:.4f})/(1+{m_one:.4f})"
        f" = {ret * (1 + m_pick) / (1 + m_one):.4f}"
    )

    print("\n== La règle telle qu'en production : bande et coût chez 1xBet ==")
    replay(one_all, "1xBet 2.10-2.80, lowest 1xBet margin")
    pin_since = [r for r in pin if r["day"] >= min(x["day"] for x in one_all)]
    replay(pin_since, "Pinnacle 2.10-2.80 over the same days")


if __name__ == "__main__":
    main()
