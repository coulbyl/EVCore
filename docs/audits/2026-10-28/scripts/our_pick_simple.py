import numpy as np, pandas as pd, io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    import our_pick as O
c = O.cand.copy()
playable = c.odds.notna() & (c.odds >= O.MIN_ODDS)
cheap = playable & (c.odds < O.MAX_ODDS)
c['tier_simple'] = np.select([cheap, playable], [0, 1], default=2)
simple = c.sort_values(['fixtureId', 'tier_simple', 'probability'], ascending=[True, True, False]).groupby('fixtureId').head(1)
cur = c[c.is_primary]
rows = [O.line('Actuel (avec statut de calibration)', cur), O.line('Sans statut : cote courte, puis proba du moteur', simple)]
cc = cur[cur.tier <= 1]; ss = simple[simple.tier_simple == 0]
rows += [O.line('   actuel, cote 1,20–1,50', cc), O.line('   sans statut, cote 1,20–1,50', ss)]
for per in ['P1', 'P2']:
    f = lambda d: d[np.where(d.day < '2026-09-01', 'P1', 'P2') == per]
    rows += [O.line(f'   actuel 1,20–1,50 {per}', f(cc)), O.line(f'   sans statut 1,20–1,50 {per}', f(ss))]
pd.set_option('display.width', 250)
print(pd.DataFrame(rows).to_string(index=False))
same = len(set(zip(cur.fixtureId, cur.market, cur.pick)) & set(zip(simple.fixtureId, simple.market, simple.pick)))
print(f"\nMême pari choisi sur {same} matchs sur {cur.fixtureId.nunique()} ({100*same/cur.fixtureId.nunique():.0f} %)")
print(f"Matchs avec une sélection à 1,20–1,50 : actuel {cc.fixtureId.nunique()}, sans statut {ss.fixtureId.nunique()}")
