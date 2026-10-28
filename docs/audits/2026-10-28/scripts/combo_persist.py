import numpy as np, pandas as pd, io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    import combo as C

def resid(sub):
    r = sub.won - sub.fair
    se = np.sqrt(((r - r.mean()) ** 2).sum()) / len(sub) if len(sub) else np.nan
    return f"{100*r.mean():+.1f} ± {196*se:.1f} (n={len(sub)})"

P = C.picks
base = P[~P.alerted & (P.reason != 'market_suspended') & (P.market != 'DRAW_NO_BET')].dropna(subset=['fair', 'won'])
print("Référence, tout ce qui est coté, même cote :")
for lo, hi in [(1.20, 1.25), (1.25, 1.35), (1.35, 1.50)]:
    print(f"  {lo:.2f}–{hi:.2f} : {resid(base[(base.odds >= lo) & (base.odds < hi)])}")

for k in 'AB':
    legs = pd.concat(C.rows[k]).copy(); legs['won'] = legs.won.astype(float)
    sub = legs.dropna(subset=['fair', 'won'])
    sub = sub.assign(period=np.where(sub.day < '2026-09-01', 'P1 juil.-août', 'P2 sept.-oct.'))
    print(f"\n{k} : global {resid(sub)}")
    for p, g in sub.groupby('period'): print(f"   {p} : {resid(g)}")
    for lo, hi in [(1.20, 1.25), (1.25, 1.50)]:
        print(f"   cote {lo:.2f}–{hi:.2f} : {resid(sub[(sub.odds >= lo) & (sub.odds < hi)])}")
    for m, g in sub.groupby('market'):
        if len(g) >= 15: print(f"   {m} : {resid(g)}")

# Le vivier de A (toutes ses jambes éligibles, pas seulement les deux retenues) contre le reste coté, même jour, même tranche.
elig = []
for day in C.days:
    e = C.eligible_current(day)
    if not e.empty: elig.append(C.attach_market(e).assign(day=day))
E = pd.concat(elig).dropna(subset=['fair', 'won'])
E = E[(E.odds >= 1.20) & (E.odds < 1.50)]
print(f"\nToutes les jambes éligibles de A (pas seulement les 2 retenues) : {resid(E)}")
keys = set(zip(E.fixtureId, E.market, E.pick))
rest = base[(base.odds >= 1.20) & (base.odds < 1.50)]
rest = rest[[k not in keys for k in zip(rest.fixtureId, rest.market, rest.pick)]]
print(f"Le reste coté, même tranche 1,20–1,50 : {resid(rest)}")
E2 = E.assign(period=np.where(E.day < '2026-09-01', 'P1', 'P2'))
for p, g in E2.groupby('period'): print(f"   éligibles {p} : {resid(g)}")
