import numpy as np, pandas as pd
import composer as C
pd.set_option('display.width', 250)

def run(pool, ranking):
    rates = C.cell_rates(pool) if ranking == 'cell' else None
    legs_out, coupons = [], []
    for day in C.days[1:]:
        t = pool[pool.day == day].copy()
        if t.empty: continue
        t['score'] = [rates.get((c, day)) for c in t.cell] if ranking == 'cell' else t.fair
        t = t.dropna(subset=['score']); t['margin_f'] = t.margin.fillna(0.06)
        t = (t.sort_values(['score', 'margin_f'], ascending=[False, True]).groupby(['fixtureId', 'band']).head(1)
               .sort_values('score', ascending=False).reset_index(drop=True))
        combo = C.best_combo(t, 2)
        if combo is None: combo = C.best_combo(t, 3)
        if combo is None: continue
        coupons.append({'day': day, 'month': day[:7], 'odds': combo.odds.prod(), 'ann': combo.score.prod(), 'won': combo.won.min(),
                        'cost': combo.fair.prod() * combo.odds.prod() - 1 if combo.fair.notna().all() else np.nan})
        legs_out.append(combo.assign(day=day))
    return pd.DataFrame(coupons), pd.concat(legs_out)

wide = C.df[(C.df.reason != 'market_suspended') & ~C.df.alerted]
cur = C.df[C.df.in_pool & ~C.df.alerted]
for label, pool, rk in [('E prix du marché, vivier élargi', wide[wide.fair.notna()], 'fair'),
                        ('B vivier actuel, cellule', cur, 'cell'),
                        ('C vivier élargi, cellule', wide, 'cell')]:
    cp, lg = run(pool, rk)
    print(f'\n##### {label}')
    m = cp.groupby('month').agg(jours=('won', 'size'), annonce=('ann', 'mean'), realise=('won', 'mean'), cout=('cost', 'mean'))
    print((m * [1, 100, 100, 100]).round(1).to_string())
    print('Jambes : n', len(lg), '| annonce par jambe', round(100 * lg.score.mean(), 1), '| marché sans marge', round(100 * lg.fair.mean(), 1),
          '| réalisé', round(100 * lg.won.mean(), 1), '| cote moy.', round(lg.odds.mean(), 2), '| marge moy.', round(100 * lg.margin_f.mean(), 1))
    print('Marchés choisis :', lg.market.value_counts().head(8).to_dict())
    print('Statut moteur des jambes :', lg.reason.value_counts().head(6).to_dict(), '| dans le vivier actuel :', int(lg.in_pool.sum()))
