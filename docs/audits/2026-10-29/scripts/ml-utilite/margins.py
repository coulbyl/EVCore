import sys, re, numpy as np, pandas as pd
df = pd.read_csv(sys.argv[1]).rename(columns={"as": "as_"})
def groups(s):
    """Groupes d'issues complets par (fixture, marché, ligne) → somme des 1/cote."""
    out = []
    for (fid, mk), g in s.groupby(["fixture", "market"]):
        if mk == "ONE_X_TWO":
            r = g.iloc[0]
            if pd.notna(r.homeOdds): out.append((mk, 1/r.homeOdds + 1/r.drawOdds + 1/r.awayOdds))
        elif mk in ("OVER_UNDER", "TEAM_TOTAL_HOME", "TEAM_TOTAL_AWAY", "OVER_UNDER_HT"):
            d = {}
            for p, o in zip(g.pick, g.odds):
                m = re.match(r"(OVER|UNDER)(?:_(\d)_5)?$", p)
                if m: d.setdefault(m.group(2) or "2", {})[m.group(1)] = o
            for ln, so in d.items():
                if "OVER" in so and "UNDER" in so: out.append((mk, 1/so["OVER"] + 1/so["UNDER"]))
        elif mk in ("BTTS", "DOUBLE_CHANCE", "FIRST_HALF_WINNER", "HALF_TIME_FULL_TIME", "CORRECT_SCORE"):
            tot = (1/g.odds).sum()
            if (mk == "BTTS" and len(g) == 2) or (mk == "FIRST_HALF_WINNER" and len(g) == 3) or (mk == "HALF_TIME_FULL_TIME" and len(g) == 9) or (mk == "DOUBLE_CHANCE" and len(g) == 3) or (mk == "CORRECT_SCORE" and len(g) >= 20):
                out.append((mk, tot))
    return pd.DataFrame(out, columns=["market", "overround"])
for bk in ("1xBet", "Pinnacle"):
    m = groups(df[df.bookmaker == bk]).groupby("market").overround.agg(["median", "count"])
    print(f"=== marge {bk} (médiane de somme 1/cote − 1, par groupe d'issues)")
    for mk, r in m.sort_values("median").iterrows(): print(f"   {mk:<20} {r['median']-1:+.3f}  (n={int(r['count'])})")
