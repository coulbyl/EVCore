"""Piste « prix mou contre prix dur » : parier chez un book mou quand sa cote dépasse la cote juste de Pinnacle.
Jugé par le rendement réalisé à mise fixe, par tranche d'avantage annoncé, avec bootstrap par match."""
import sys, numpy as np, pandas as pd
rng = np.random.default_rng(7); B = 600

METHOD = "power"

def _power(ps):
    # p_i^k normalisés, k tel que la somme fasse 1 : retire plus de marge aux outsiders (biais favori-outsider)
    ps = np.asarray(ps, float); lo, hi = 0.5, 3.0
    for _ in range(60):
        k = (lo + hi) / 2
        if (ps ** k).sum() > 1: lo = k
        else: hi = k
    return ps ** k

def _shin(ps):
    # Shin (1993) : part z d'initiés ; p_i = (sqrt(z^2 + 4(1-z) q_i^2/B) - z) / (2(1-z)), B = somme des q
    q = np.asarray(ps, float); Bsum = q.sum()
    def probs(z): return (np.sqrt(z*z + 4*(1-z)*q*q/Bsum) - z) / (2*(1-z))
    lo, hi = 0.0, 0.5
    for _ in range(60):
        z = (lo + hi) / 2
        if probs(z).sum() > 1: lo = z
        else: hi = z
    return probs(z)

def devig(odds):
    q = 1/np.asarray(odds, float)
    if METHOD == "proportional": return q / q.sum()
    if METHOD == "power": return _power(q)
    return _shin(q)

def devig_3(h, d, a): return tuple(devig([h, d, a]))
def devig_2(y, n): return devig([y, n])[0]

def rows_1x2(df):
    out = []
    for r in df.itertuples():
        ph, pd_, pa = devig_3(r.sharp_h, r.sharp_d, r.sharp_a)
        res = "H" if r.hs > r.as_ else ("A" if r.hs < r.as_ else "D")
        for side, p, o in (("H", ph, r.soft_h), ("D", pd_, r.soft_d), ("A", pa, r.soft_a)):
            out.append(dict(fixture=r.fixture, book=getattr(r, "bookmaker", "1xBet"), market="1X2", side=side, p_fair=p, odds=o,
                            ev=p*o-1, won=int(res == side), h_before=r.h_before_soft, month=str(r.scheduledAt)[:7]))
    return pd.DataFrame(out)

def rows_2way(df):
    out = []
    for r in df.itertuples():
        py = devig_2(r.sharp_yes, r.sharp_no)
        y = int(r.hs + r.as_ > 2) if r.market == "OU25" else int(r.hs > 0 and r.as_ > 0)
        for side, p, o, w in (("YES", py, r.soft_yes, y), ("NO", 1-py, r.soft_no, 1-y)):
            out.append(dict(fixture=r.fixture, book=r.bookmaker, market=r.market, side=side, p_fair=p, odds=o, ev=p*o-1, won=w,
                            h_before=r.h_before_soft, month=str(r.scheduledAt)[:7]))
    return pd.DataFrame(out)

def roi_ci(d):
    ret = d.won.values * d.odds.values - 1
    fix = d.fixture.values; groups = pd.Series(range(len(d))).groupby(fix).apply(list).tolist()
    vals = []
    for _ in range(B):
        pick = rng.integers(0, len(groups), len(groups))
        idx = np.concatenate([groups[j] for j in pick]); vals.append(ret[idx].mean())
    return ret.mean(), np.percentile(vals, 2.5), np.percentile(vals, 97.5)

def report(title, d):
    print(f"\n=== {title}  (lignes {len(d)}, matchs {d.fixture.nunique()}, annoncé moyen {d.ev.mean():+.3f})")
    bins = [(-1, -0.05), (-0.05, 0), (0, 0.02), (0.02, 0.05), (0.05, 0.10), (0.10, 9)]
    for lo, hi in bins:
        s = d[(d.ev > lo) & (d.ev <= hi)]
        if len(s) < 40: continue
        m, l, h = roi_ci(s)
        print(f"   EV ]{lo:+.2f} ; {hi:+.2f}]  n={len(s):>5}  cote moy {s.odds.mean():5.2f}  annoncé {s.ev.mean():+.3f}  réalisé {m:+.3f} [{l:+.3f} ; {h:+.3f}]  taux {s.won.mean():.3f} vs juste {s.p_fair.mean():.3f}")
    pos = d[d.ev > 0]
    if len(pos) > 40:
        m, l, h = roi_ci(pos)
        print(f"   → toutes les lignes à avantage annoncé > 0 : n={len(pos)} ({len(pos)/d.fixture.nunique():.2f} par match)  réalisé {m:+.3f} [{l:+.3f} ; {h:+.3f}]")
        for mo, s in pos.groupby("month"):
            if len(s) >= 40: mm, ll, hh = roi_ci(s); print(f"      {mo}: n={len(s)} réalisé {mm:+.3f} [{ll:+.3f} ; {hh:+.3f}]")
        for lo, hi in [(1, 6), (6, 24), (24, 1000)]:
            s = pos[(pos.h_before >= lo) & (pos.h_before < hi)]
            if len(s) >= 40: mm, ll, hh = roi_ci(s); print(f"      relevé {lo}–{hi} h avant : n={len(s)} réalisé {mm:+.3f} [{ll:+.3f} ; {hh:+.3f}]")

METHOD = sys.argv[-1] if sys.argv[-1] in ("proportional","power","shin") else "power"
args = [a for a in sys.argv[1:] if a not in ("proportional","power","shin")]; sys.argv = [sys.argv[0]] + args
print("retrait de marge :", METHOD)
f1 = pd.read_csv(sys.argv[1]).rename(columns={"as": "as_"})
d1 = rows_1x2(f1)
report("1xBet contre Pinnacle — 1X2", d1[d1.book == "1xBet"])
if len(sys.argv) > 2 and sys.argv[2] != "-":
    f2 = pd.read_csv(sys.argv[2]).rename(columns={"as": "as_"}); d2 = rows_2way(f2)
    report("1xBet contre Pinnacle — plus/moins de 2,5", d2[(d2.book == "1xBet") & (d2.market == "OU25")])
    report("1xBet contre Pinnacle — les deux marquent", d2[(d2.book == "1xBet") & (d2.market == "BTTS")])
if len(sys.argv) > 3:
    f3 = pd.read_csv(sys.argv[3]).rename(columns={"as": "as_"}); d3 = rows_1x2(f3)
    print("\n=== Tous les books mous contre Pinnacle — 1X2, lignes à avantage annoncé > 0, par book")
    for bk, s in d3[d3.ev > 0].groupby("book"):
        if len(s) >= 80: m, l, h = roi_ci(s); print(f"   {bk:<12} n={len(s):>5} matchs={s.fixture.nunique():>5} cote moy {s.odds.mean():5.2f} annoncé {s.ev.mean():+.3f} réalisé {m:+.3f} [{l:+.3f} ; {h:+.3f}]")
    allsoft = d3[(d3.ev > 0)]
    m, l, h = roi_ci(allsoft); print(f"   {'TOUS':<12} n={len(allsoft)} matchs={allsoft.fixture.nunique()} réalisé {m:+.3f} [{l:+.3f} ; {h:+.3f}]")
    report("Tous les books mous — 1X2", d3)
