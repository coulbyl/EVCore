import numpy as np
import pandas as pd
from prep import clustered, summarize

pd.set_option('display.width', 250)
pd.set_option('display.max_columns', 20)
pd.set_option('display.max_rows', 200)
df = pd.read_pickle(__file__.rsplit('/', 1)[0] + '/picks.pkl')
s = df.dropna(subset=['won'])
LEG = s[(s.odds >= 1.20) & (s.odds <= 1.80)]


def table(groups):
    return pd.DataFrame([{'groupe': k, **summarize(g)} for k, g in groups]).to_string(index=False)


print('=== 0. Qui est bien calibré, sur la tranche 1,20–1,80 ? ===')
for col, label in [('fair', 'marché sans marge'), ('model_prob', 'moteur')]:
    d = LEG.dropna(subset=[col]).copy()
    d['bin'] = pd.cut(d[col], [0, .5, .55, .6, .65, .7, .75, .8, .85, 1])
    t = d.groupby('bin', observed=True).agg(n=('won', 'size'), annonce=(col, 'mean'), realise=('won', 'mean'))
    t['ecart'] = t.realise - t.annonce
    print(f'\n-- {label}'); print((t.assign(annonce=lambda x: (100*x.annonce).round(1), realise=lambda x: (100*x.realise).round(1), ecart=lambda x: (100*x.ecart).round(1))).to_string())

print('\n=== 1. Ce qu\'on garde et ce qu\'on laisse, cotes 1,20–1,80 ===')
clean = LEG[~LEG.alerted]
groups = [('Vivier actuel du coupon', clean[clean.in_pool])]
for reason in ['viable', 'ev_below_threshold', 'probability_too_low', 'under_high_lambda',
               'odds_below_floor', 'quality_score_below_threshold', 'market_suspended']:
    g = clean[(~clean.in_pool) & (clean.reason == reason)]
    if len(g) > 200:
        groups.append((f'Laissé · {reason}', g))
groups.append(('Matchs « Données suspectes » (tout)', LEG[LEG.alerted]))
print(table(groups))

print('\n=== 2. À même marché et même tranche de cote : le vivier fait-il mieux que ce qu\'on laisse ? ===')
c = clean[clean.reason != 'market_suspended'].copy()
c['band'] = pd.cut(c.odds, [1.199, 1.35, 1.5, 1.65, 1.801], labels=['1,20–1,35', '1,35–1,50', '1,50–1,65', '1,65–1,80'])
c['cell'] = c.market + ' · ' + c.band.astype(str)
rows = []
for cell, g in c.groupby('cell'):
    a, b = g[g.in_pool], g[~g.in_pool]
    if len(a) >= 30 and len(b) >= 30:
        rows.append({'cellule': cell, 'n_vivier': len(a), 'n_laisse': len(b),
                     'vivier': a.won.mean(), 'laisse': b.won.mean(),
                     'res_vivier': (a.won - a.fair).mean(), 'res_laisse': (b.won - b.fair).mean()})
t = pd.DataFrame(rows)
t['diff'] = t.vivier - t.laisse
w = t.n_vivier
print(f"Cellules comparables : {len(t)} ; vivier {int(t.n_vivier.sum())} jambes, laissé {int(t.n_laisse.sum())}")
print(f"Réussite, pondérée par le vivier : vivier {100*np.average(t.vivier, weights=w):.1f} %, laissé {100*np.average(t.laisse, weights=w):.1f} % (écart {100*np.average(t['diff'], weights=w):+.1f} pts)")
print(f"Écart au marché sans marge : vivier {100*np.average(t.res_vivier.fillna(0), weights=w):+.1f} pts, laissé {100*np.average(t.res_laisse.fillna(0), weights=w):+.1f} pts")
print(t.sort_values('n_vivier', ascending=False).head(25).assign(**{k: lambda x, k=k: (100*x[k]).round(1) for k in ['vivier', 'laisse', 'res_vivier', 'res_laisse', 'diff']}).to_string(index=False))

print('\n=== 3. Par marché, tout ce qui est jouable (cotes 1,20–1,80, hors suspendus et Données suspectes) ===')
print(table(sorted(((m, g) for m, g in c.groupby('market') if len(g) > 300), key=lambda x: -len(x[1]))))

print('\n=== 4. Le désaccord du moteur avec le marché apporte-t-il quelque chose ? ===')
d = c.dropna(subset=['fair']).copy()
d['desaccord'] = d.model_prob - d.fair
d['q'] = pd.qcut(d.desaccord, 5, labels=['Q1 moteur bien plus bas', 'Q2', 'Q3', 'Q4', 'Q5 moteur bien plus haut'])
print(table([(f"{q} ({100*g.desaccord.min():+.0f} à {100*g.desaccord.max():+.0f} pts)", g) for q, g in d.groupby('q', observed=True)]))

print('\n=== 5. Favoris et outsiders : le marché sous-estime-t-il les cotes courtes ? (tous marchés, hors suspendus) ===')
a = s[(~s.alerted) & (s.reason != 'market_suspended')].dropna(subset=['fair']).copy()
a['band'] = pd.cut(a.odds, [1.0, 1.2, 1.35, 1.5, 1.65, 1.8, 2.1, 2.6, 3.5, 6, 1000])
print(table([(str(b), g) for b, g in a.groupby('band', observed=True)]))

print('\n=== 6. Ça tient d\'une période à l\'autre ? (cellule marché × tranche × gardé/laissé) ===')
c['keep'] = np.where(c.in_pool, 'vivier', 'laissé')
c['res'] = c.won - c.fair
p = c.dropna(subset=['res']).groupby(['market', 'band', 'keep', 'period'], observed=True).res.agg(['mean', 'size']).reset_index()
p = p[p['size'] >= 100].pivot_table(index=['market', 'band', 'keep'], columns='period', values='mean', observed=True).dropna()
print(f"Cellules présentes sur les deux périodes (≥ 100 jambes chacune) : {len(p)}")
print(f"Corrélation de l'écart au marché P1 → P2 : {p.corr().iloc[0, 1]:+.3f}")
top = p.sort_values(p.columns[0], ascending=False)
k = max(1, len(p) // 4)
print(f"Le quart des cellules les meilleures en P1 : {100*top.iloc[:k, 0].mean():+.1f} pts en P1 → {100*top.iloc[:k, 1].mean():+.1f} pts en P2")
print(f"Le quart des cellules les pires en P1 : {100*top.iloc[-k:, 0].mean():+.1f} pts en P1 → {100*top.iloc[-k:, 1].mean():+.1f} pts en P2")

print('\n=== 7. Ce que nos garde-fous écartent : avaient-ils raison ? (cotes 1,20–1,80) ===')
print(table([
    ('Types de pari suspendus', LEG[(LEG.reason == 'market_suspended') & ~LEG.alerted]),
    ('Matchs « Données suspectes »', LEG[LEG.alerted]),
    ('Matchs « Données suspectes », cotes < 1,45', LEG[LEG.alerted & (LEG.odds < 1.45)]),
    ('Matchs « Données suspectes », cotes ≥ 1,45', LEG[LEG.alerted & (LEG.odds >= 1.45)]),
    ('Tout le reste', LEG[(LEG.reason != 'market_suspended') & ~LEG.alerted]),
]))
