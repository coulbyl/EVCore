"""Fenêtre des compositions : Pinnacle bouge-t-il entre T−60 et T−10, 1xBet suit-il, et un pari 1xBet pris à T−60
garde-t-il de la valeur contre la clôture Pinnacle (T−10) ?"""
import sys, numpy as np, pandas as pd
rng = np.random.default_rng(3); B = 600
def shin(odds):
    q = 1/np.asarray(odds, float); Bs = q.sum()
    def probs(z): return (np.sqrt(z*z + 4*(1-z)*q*q/Bs) - z)/(2*(1-z))
    lo, hi = 0.0, 0.5
    for _ in range(60):
        z = (lo+hi)/2
        if probs(z).sum() > 1: lo = z
        else: hi = z
    return probs(z)
def logit(p): p = np.clip(p, 1e-4, 1-1e-4); return np.log(p/(1-p))
def roi_ci(ret, fix):
    groups = pd.Series(range(len(ret))).groupby(fix).apply(list).tolist(); vals = []
    for _ in range(B):
        pick = rng.integers(0, len(groups), len(groups)); idx = np.concatenate([groups[j] for j in pick]); vals.append(ret[idx].mean())
    return ret.mean(), np.percentile(vals, 2.5), np.percentile(vals, 97.5)

df = pd.read_csv(sys.argv[1]).rename(columns={"as": "as_"})
rows = []
for (fid, mk), g in df.groupby(["fixture", "market"]):
    def get(bk, w):
        s = g[(g.bookmaker == bk) & (g.w == w)]
        if mk == "ONE_X_TWO":
            if len(s) != 1 or s.homeOdds.isna().any(): return None
            return np.array([s.homeOdds.iloc[0], s.drawOdds.iloc[0], s.awayOdds.iloc[0]])
        o = {p: v for p, v in zip(s.pick, s.odds)}
        return np.array([o["OVER"], o["UNDER"]]) if "OVER" in o and "UNDER" in o else None
    P60, P10, X60, X10 = get("Pinnacle", "T60"), get("Pinnacle", "T10"), get("1xBet", "T60"), get("1xBet", "T10")
    if any(v is None for v in (P60, P10, X60, X10)): continue
    hs, as_ = int(g.hs.iloc[0]), int(g.as_.iloc[0])
    if mk == "ONE_X_TWO": won = np.array([hs > as_, hs == as_, hs < as_], int); sides = ["H", "D", "A"]
    else: won = np.array([hs + as_ > 2, hs + as_ <= 2], int); sides = ["OVER", "UNDER"]
    f60, f10 = shin(P60), shin(P10); x60f, x10f = shin(X60), shin(X10)
    for i, sd in enumerate(sides):
        rows.append(dict(fixture=fid, market=mk, side=sd, p60=f60[i], p10=f10[i], x60=x60f[i], x10=x10f[i],
                         o60=X60[i], o10=X10[i], won=won[i], comp=g.competition.iloc[0]))
d = pd.DataFrame(rows)
d["dP"] = logit(d.p10) - logit(d.p60)          # mouvement Pinnacle (logit)
d["dX"] = logit(d.x10) - logit(d.x60)          # mouvement 1xBet
d["clv60"] = d.p10 * d.o60 - 1                 # valeur à la clôture d'un pari 1xBet pris à T−60
d["ev60_contemp"] = d.p60 * d.o60 - 1          # avantage « statique » à T−60 (Pinnacle au même instant)
d["ev10"] = d.p10 * d.o10 - 1                  # avantage à T−10

for mk, s in d.groupby("market"):
    nfix = s.fixture.nunique()
    print(f"=== {mk}  matchs {nfix}  lignes {len(s)}")
    big = s[s.dP.abs() > 0.10]
    print(f"   mouvement Pinnacle T−60→T−10 : |Δlogit| médian {s.dP.abs().median():.3f}, > 0,10 sur {len(big)/len(s):.1%} des lignes ({big.fixture.nunique()} matchs)")
    slope = np.polyfit(s.dP, s.dX, 1)[0]; corr = np.corrcoef(s.dP, s.dX)[0, 1]
    print(f"   1xBet suit : pente de Δ1xBet sur ΔPinnacle {slope:+.2f} (corr {corr:+.2f}) ; sur les gros mouvements pente {np.polyfit(big.dP, big.dX, 1)[0] if len(big) > 10 else float('nan'):+.2f}")
    print(f"   marge 1xBet T−60 {((1/s.groupby('fixture').o60.apply(lambda o: (1/o).sum())).mean()):.3f}… (1/somme 1/cote) ; CLV moyen d'un pari 1xBet pris à T−60 : {s.clv60.mean():+.3f}")
    for label, col in (("avantage statique à T−60 (Pinnacle T−60)", "ev60_contemp"), ("CLV à T−60 contre clôture (Pinnacle T−10)", "clv60"), ("avantage à T−10", "ev10")):
        pos = s[s[col] > 0]
        if len(pos) < 30: print(f"   {label}: {len(pos)} lignes > 0 seulement"); continue
        m, l, h = roi_ci((pos.won * pos.o60).values - 1 if col != "ev10" else (pos.won * pos.o10).values - 1, pos.fixture.values)
        print(f"   {label}: lignes > 0 : {len(pos)} ({len(pos)/nfix:.2f}/match), annoncé {pos[col].mean():+.3f}, réalisé {m:+.3f} [{l:+.3f} ; {h:+.3f}], cote moy {pos.o60.mean():.2f}")
    # les lignes où Pinnacle a bougé en faveur du pari (p10 > p60) : 1xBet a-t-il bougé autant ?
    up = s[s.dP > 0.10]
    if len(up) > 20:
        print(f"   quand Pinnacle monte (> 0,10 logit, n={len(up)}) : 1xBet monte de {up.dX.mean():+.3f} logit contre {up.dP.mean():+.3f} ; CLV d'un pari 1xBet pris à T−60 sur ces lignes {up.clv60.mean():+.3f}, réalisé {((up.won*up.o60)-1).mean():+.3f}")
    print()
