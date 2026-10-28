import numpy as np, pandas as pd, io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    import our_pick as O
b = O.band.dropna(subset=['fair', 'won']).copy()
b['cellband'] = pd.cut(b.odds, [1.199, 1.30, 1.40, 1.50], labels=['1,20–1,30', '1,30–1,40', '1,40–1,50']).astype(str)
b['cell'] = b.market + ' · ' + b.cellband
b['res'] = b.won - b.fair
rows = []
for cell, g in b.groupby('cell'):
    a, o = g[g.is_primary], g[~g.is_primary]
    if len(a) >= 40 and len(o) >= 40:
        rows.append({'cell': cell, 'np': len(a), 'no': len(o), 'rp': a.res.mean(), 'ro': o.res.mean()})
t = pd.DataFrame(rows)
w = t.np
d = np.average(t.rp - t.ro, weights=w)
# Erreur-type de la différence pondérée (cellules indépendantes, variance binomiale approchée).
var = (t.np / w.sum()) ** 2 * (0.2 / t.np + 0.2 / t.no)
print(f"Cellules marché × tranche comparables : {len(t)} (principales {int(t.np.sum())}, autres {int(t.no.sum())})")
print(f"À marché et cote égaux : principale {100*np.average(t.rp, weights=w):+.1f}, autres {100*np.average(t.ro, weights=w):+.1f} → écart {100*d:+.1f} ± {196*np.sqrt(var.sum()):.1f} pts")
print("\nComposition (part des sélections principales vs autres, par marché) :")
comp = pd.concat([b[b.is_primary].market.value_counts(normalize=True).rename('principale'),
                  b[~b.is_primary].market.value_counts(normalize=True).rename('autres')], axis=1).fillna(0)
mres = b.groupby('market').res.mean().rename('ecart_marche_du_marche')
print((pd.concat([comp, mres], axis=1).sort_values('principale', ascending=False).head(10) * 100).round(1).to_string())
for per in ['P1', 'P2']:
    sub = b[np.where(b.day < '2026-09-01', 'P1', 'P2') == per]
    rows = []
    for cell, g in sub.groupby('cell'):
        a, o = g[g.is_primary], g[~g.is_primary]
        if len(a) >= 20 and len(o) >= 20:
            rows.append((len(a), a.res.mean() - o.res.mean()))
    if rows:
        n, dd = zip(*rows)
        print(f"{per} : écart à marché et cote égaux {100*np.average(dd, weights=n):+.1f} pts ({len(rows)} cellules)")
