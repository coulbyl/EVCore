"""Grille de score impliquée par le marché (Pinnacle, retrait de marge de Shin, ajustement Dixon-Coles),
puis prix juste de chaque pick 1xBet et rendement réalisé quand 1xBet paie plus que le juste."""
import sys, re, numpy as np, pandas as pd
from scipy.optimize import minimize
from scipy.stats import poisson
rng = np.random.default_rng(11); B = 500; GMAX = 10

def shin(odds):
    q = 1/np.asarray(odds, float); Bsum = q.sum()
    def probs(z): return (np.sqrt(z*z + 4*(1-z)*q*q/Bsum) - z) / (2*(1-z))
    lo, hi = 0.0, 0.5
    for _ in range(60):
        z = (lo+hi)/2
        if probs(z).sum() > 1: lo = z
        else: hi = z
    return probs(z)

def grid(lh, la, rho):
    h = poisson.pmf(np.arange(GMAX+1), lh); a = poisson.pmf(np.arange(GMAX+1), la)
    g = np.outer(h, a)
    tau = {(0,0): 1 - lh*la*rho, (0,1): 1 + lh*rho, (1,0): 1 + la*rho, (1,1): 1 - rho}
    for (i,j), t in tau.items(): g[i,j] *= max(t, 1e-9)
    return g / g.sum()

def line_of(pick):
    m = re.match(r"(OVER|UNDER)(?:_(\d)_5)?$", pick)
    if not m: return None, None
    return m.group(1), (float(m.group(2)) + 0.5) if m.group(2) else 2.5

def targets(px):
    """Probabilités Pinnacle sans marge : 1X2, O/U par ligne, totaux d'équipe par ligne."""
    t = {}
    r = px[px.market == "ONE_X_TWO"]
    if len(r) == 1 and r.homeOdds.notna().all():
        ph, pd_, pa = shin([r.homeOdds.iloc[0], r.drawOdds.iloc[0], r.awayOdds.iloc[0]]); t["1x2"] = (ph, pd_, pa)
    for mk, key in (("OVER_UNDER", "ou"), ("TEAM_TOTAL_HOME", "tth"), ("TEAM_TOTAL_AWAY", "tta")):
        r = px[px.market == mk]; d = {}
        for pick, o in zip(r.pick, r.odds):
            side, ln = line_of(pick)
            if side: d.setdefault(ln, {})[side] = o
        for ln, so in d.items():
            if "OVER" in so and "UNDER" in so: t.setdefault(key, {})[ln] = shin([so["OVER"], so["UNDER"]])[0]
    return t

def model_probs(g, t):
    out = {}
    if "1x2" in t:
        out["1x2"] = (np.tril(g, -1).sum(), np.trace(g), np.triu(g, 1).sum())
    tot = np.add.outer(np.arange(GMAX+1), np.arange(GMAX+1))
    for key, axis in (("ou", None), ("tth", 0), ("tta", 1)):
        for ln in t.get(key, {}):
            if axis is None: out[(key, ln)] = g[tot > ln].sum()
            else: out[(key, ln)] = g.sum(axis=1-axis)[np.arange(GMAX+1) > ln].sum()
    return out

def fit(t):
    def loss(x):
        g = grid(x[0], x[1], x[2]); m = model_probs(g, t); s = 0.0
        if "1x2" in t: s += 3*sum((a-b)**2 for a, b in zip(m["1x2"], t["1x2"]))
        for key in ("ou", "tth", "tta"):
            for ln, p in t.get(key, {}).items(): s += (m[(key, ln)] - p)**2
        return s
    best = None
    for x0 in ((1.4, 1.1, 0.0), (1.0, 1.6, 0.0), (2.0, 0.8, 0.0)):
        r = minimize(loss, x0, bounds=[(0.1, 5), (0.1, 5), (-0.3, 0.3)], method="L-BFGS-B")
        if best is None or r.fun < best.fun: best = r
    return best.x, best.fun

def price_pick(g, market, pick, hs, as_):
    """(probabilité juste, gagné) pour un pick 1xBet, ou None si non pricé."""
    tot = np.add.outer(np.arange(GMAX+1), np.arange(GMAX+1))
    if market == "DOUBLE_CHANCE":
        p = {"1X": np.tril(g, 0).sum(), "X2": np.triu(g, 0).sum(), "12": 1 - np.trace(g)}.get(pick)
        w = {"1X": hs >= as_, "X2": as_ >= hs, "12": hs != as_}.get(pick)
        return (p, int(w)) if p is not None else None
    if market == "BTTS":
        p = g[1:, 1:].sum(); w = hs > 0 and as_ > 0
        return (p, int(w)) if pick == "YES" else (1-p, int(not w))
    if market == "CORRECT_SCORE":
        m = re.match(r"^(\d+):(\d+)$", pick)
        if not m: return None
        i, j = int(m.group(1)), int(m.group(2))
        if i > GMAX or j > GMAX: return None
        return (g[i, j], int(hs == i and as_ == j))
    if market in ("OVER_UNDER", "TEAM_TOTAL_HOME", "TEAM_TOTAL_AWAY"):
        side, ln = line_of(pick)
        if not side: return None
        if market == "OVER_UNDER": p_over = g[tot > ln].sum(); v = hs + as_
        elif market == "TEAM_TOTAL_HOME": p_over = g.sum(axis=1)[np.arange(GMAX+1) > ln].sum(); v = hs
        else: p_over = g.sum(axis=0)[np.arange(GMAX+1) > ln].sum(); v = as_
        return (p_over, int(v > ln)) if side == "OVER" else (1-p_over, int(v < ln))
    return None

def roi_ci(d):
    ret = (d.won * d.odds - 1).values; fix = d.fixture.values
    groups = pd.Series(range(len(d))).groupby(fix).apply(list).tolist(); vals = []
    for _ in range(B):
        pick = rng.integers(0, len(groups), len(groups)); idx = np.concatenate([groups[j] for j in pick]); vals.append(ret[idx].mean())
    return ret.mean(), np.percentile(vals, 2.5), np.percentile(vals, 97.5)

df = pd.read_csv(sys.argv[1]).rename(columns={"as": "as_"})
rows, fits = [], []
for fid, fx in df.groupby("fixture", sort=False):
    px = fx[fx.bookmaker == "Pinnacle"]; sx = fx[fx.bookmaker == "1xBet"]
    t = targets(px)
    if "1x2" not in t or "ou" not in t: continue
    (lh, la, rho), err = fit(t); g = grid(lh, la, rho)
    hs, as_ = int(fx.hs.iloc[0]), int(fx.as_.iloc[0])
    fits.append(dict(fixture=fid, lh=lh, la=la, rho=rho, err=err, n_targets=1+sum(len(t.get(k, {})) for k in ("ou","tth","tta"))))
    # 1X2 de 1xBet : trois lignes depuis homeOdds/drawOdds/awayOdds
    r = sx[sx.market == "ONE_X_TWO"]
    if len(r) == 1 and r.homeOdds.notna().all():
        ph, pd_, pa = t["1x2"]; res = "H" if hs > as_ else ("A" if hs < as_ else "D")
        for side, p, o in (("H", ph, r.homeOdds.iloc[0]), ("D", pd_, r.drawOdds.iloc[0]), ("A", pa, r.awayOdds.iloc[0])):
            rows.append(dict(fixture=fid, market="ONE_X_TWO", pick=side, group="direct", p_fair=p, odds=o, won=int(res == side), comp=fx.competition.iloc[0], month=str(fx.scheduledAt.iloc[0])[:7]))
    for r in sx.itertuples():
        if r.market == "ONE_X_TWO" or not np.isfinite(r.odds) or r.odds <= 1: continue
        pr = price_pick(g, r.market, r.pick, hs, as_)
        if pr is None: continue
        p, w = pr
        # direct = Pinnacle cote la même ligne (on prend alors Pinnacle sans marge plutôt que la grille)
        side, ln = line_of(r.pick) if r.market in ("OVER_UNDER","TEAM_TOTAL_HOME","TEAM_TOTAL_AWAY") else (None, None)
        key = {"OVER_UNDER": "ou", "TEAM_TOTAL_HOME": "tth", "TEAM_TOTAL_AWAY": "tta"}.get(r.market)
        group = "derived"
        if key and ln in t.get(key, {}):
            p_direct = t[key][ln] if side == "OVER" else 1 - t[key][ln]; p = p_direct; group = "direct"
        rows.append(dict(fixture=fid, market=r.market, pick=r.pick, group=group, p_fair=p, odds=r.odds, won=w, comp=fx.competition.iloc[0], month=str(fx.scheduledAt.iloc[0])[:7]))

d = pd.DataFrame(rows); d["ev"] = d.p_fair * d.odds - 1; d["p_1xbet"] = 1/d.odds
F = pd.DataFrame(fits)
print(f"matchs ajustés {len(F)}  λ dom {F.lh.mean():.2f}  λ ext {F.la.mean():.2f}  ρ {F.rho.mean():+.3f}  erreur quadratique médiane {F.err.median():.5f}  cibles/match {F.n_targets.mean():.1f}")
print(f"lignes 1xBet pricées {len(d)}  ({len(d)/len(F):.0f} par match)\n")

print("=== Par marché : la grille est-elle un meilleur estimateur que 1xBet lui-même ? (Brier sur l'issue) + marge 1xBet + lignes payées au-dessus du juste")
for mk, s in d.groupby("market"):
    # marge 1xBet = somme des 1/cote du groupe d'issues − 1, approchée par la moyenne par match des groupes complets
    b_grid = ((s.p_fair - s.won)**2).mean(); b_1x = ((s.p_1xbet - s.won)**2).mean()
    pos = s[s.ev > 0]
    txt = f"   {mk:<16} n={len(s):>6}  Brier grille {b_grid:.4f}  Brier 1xBet(1/cote) {b_1x:.4f}  lignes EV>0 : {len(pos):>5} ({len(pos)/s.fixture.nunique():.2f}/match)"
    if len(pos) >= 60:
        m, l, h = roi_ci(pos); txt += f"  réalisé {m:+.3f} [{l:+.3f} ; {h:+.3f}]  cote moy {pos.odds.mean():.2f}  annoncé {pos.ev.mean():+.3f}"
    print(txt)

print("\n=== Lignes EV>0, par groupe et par tranche d'avantage annoncé")
for grp, s0 in d.groupby("group"):
    print(f"--- {grp} (Pinnacle cote la ligne : direct ; dérivée de la grille : derived)")
    for lo, hi in [(0, .03), (.03, .06), (.06, .10), (.10, .20), (.20, 9)]:
        s = s0[(s0.ev > lo) & (s0.ev <= hi)]
        if len(s) < 60: continue
        m, l, h = roi_ci(s)
        print(f"   EV ]{lo:+.2f};{hi:+.2f}]  n={len(s):>6} matchs={s.fixture.nunique():>5} cote moy {s.odds.mean():6.2f} annoncé {s.ev.mean():+.3f} réalisé {m:+.3f} [{l:+.3f} ; {h:+.3f}] taux {s.won.mean():.3f} vs juste {s.p_fair.mean():.3f}")
    pos = s0[s0.ev > 0]
    if len(pos) >= 60:
        m, l, h = roi_ci(pos); print(f"   → tout EV>0 : n={len(pos)} réalisé {m:+.3f} [{l:+.3f} ; {h:+.3f}]")
        for mo, s in pos.groupby("month"):
            if len(s) >= 60: mm, ll, hh = roi_ci(s); print(f"      {mo}: n={len(s)} réalisé {mm:+.3f} [{ll:+.3f} ; {hh:+.3f}]")

print("\n=== Score exact : calibration de la grille par tranche de probabilité")
cs = d[d.market == "CORRECT_SCORE"]
for lo, hi in [(0, .01), (.01, .03), (.03, .06), (.06, .10), (.10, 1)]:
    s = cs[(cs.p_fair > lo) & (cs.p_fair <= hi)]
    if len(s) > 100: print(f"   p ]{lo:.2f};{hi:.2f}]  n={len(s):>6}  grille {s.p_fair.mean():.4f}  1xBet 1/cote {s.p_1xbet.mean():.4f}  réalisé {s.won.mean():.4f}")
d.to_csv("/tmp/derivatives_priced.csv", index=False)
