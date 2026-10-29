"""Quand parier ? Valeur à la clôture (Pinnacle T−10, sans marge) d'un pari 1xBet pris la veille (J−1, 15–36 h) contre pris à T−10."""
import sys, numpy as np, pandas as pd
rng = np.random.default_rng(5); B = 600
def shin(odds):
    q = 1/np.asarray(odds, float); Bs = q.sum()
    def probs(z): return (np.sqrt(z*z + 4*(1-z)*q*q/Bs) - z)/(2*(1-z))
    lo, hi = 0.0, 0.5
    for _ in range(60):
        z = (lo+hi)/2
        if probs(z).sum() > 1: lo = z
        else: hi = z
    return probs(z)
def ci(vals, fix):
    groups = pd.Series(range(len(vals))).groupby(fix).apply(list).tolist(); out = []
    for _ in range(B):
        pick = rng.integers(0, len(groups), len(groups)); idx = np.concatenate([groups[j] for j in pick]); out.append(vals[idx].mean())
    return vals.mean(), np.percentile(out, 2.5), np.percentile(out, 97.5)
df = pd.read_csv(sys.argv[1]).rename(columns={"as": "as_"}); rows = []
for (fid, mk), g in df.groupby(["fixture", "market"]):
    def get(bk, w):
        s = g[(g.bookmaker == bk) & (g.w == w)]
        if mk == "ONE_X_TWO":
            if len(s) != 1 or s.homeOdds.isna().any(): return None
            return np.array([s.homeOdds.iloc[0], s.drawOdds.iloc[0], s.awayOdds.iloc[0]])
        o = {p: v for p, v in zip(s.pick, s.odds)}
        return np.array([o["OVER"], o["UNDER"]]) if "OVER" in o and "UNDER" in o else None
    P10, XJ1, X10 = get("Pinnacle", "T10"), get("1xBet", "J1"), get("1xBet", "T10")
    if any(v is None for v in (P10, XJ1, X10)): continue
    hs, as_ = int(g.hs.iloc[0]), int(g.as_.iloc[0])
    won = np.array([hs > as_, hs == as_, hs < as_], int) if mk == "ONE_X_TWO" else np.array([hs+as_ > 2, hs+as_ <= 2], int)
    f10 = shin(P10)
    for i in range(len(won)):
        rows.append(dict(fixture=fid, market=mk, p10=f10[i], oJ1=XJ1[i], o10=X10[i], won=won[i], fav=(f10[i] == f10.max())))
d = pd.DataFrame(rows)
d["clv_J1"] = d.p10*d.oJ1 - 1; d["clv_10"] = d.p10*d.o10 - 1
for mk, s in d.groupby("market"):
    print(f"=== {mk}  matchs {s.fixture.nunique()}")
    for label, col, ocol in (("pris la veille (J−1)", "clv_J1", "oJ1"), ("pris à T−10", "clv_10", "o10")):
        m, l, h = ci(s[col].values, s.fixture.values); r, rl, rh = ci((s.won*s[ocol]-1).values, s.fixture.values)
        print(f"   {label:<22} CLV moyen {m:+.3f} [{l:+.3f} ; {h:+.3f}]   rendement réalisé à mise fixe sur toutes les issues {r:+.3f} [{rl:+.3f} ; {rh:+.3f}]")
    fav = s[s.fav]; out = s[~s.fav]
    print(f"   favoris : CLV J−1 {fav.clv_J1.mean():+.3f} vs T−10 {fav.clv_10.mean():+.3f} (n={len(fav)}) ; outsiders/nul : J−1 {out.clv_J1.mean():+.3f} vs T−10 {out.clv_10.mean():+.3f}")
    better = (s.oJ1 > s.o10).mean(); same = (s.oJ1 == s.o10).mean()
    print(f"   la cote 1xBet de la veille est meilleure que celle de T−10 sur {better:.1%} des lignes, identique sur {same:.1%}")
