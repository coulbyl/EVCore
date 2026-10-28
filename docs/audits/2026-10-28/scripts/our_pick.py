"""Étude de « Notre sélection » (sélection mise en avant sur chaque match de
Décisions, primaryPick côté web), 116 jours, copie de prod du 24/10.

Rejoue la règle à l'identique, calibration canal × compétition calculée sur
les 90 jours PRÉCÉDENTS. Compare au marché (probabilité sans marge, groupe
d'issues complet, evaluatedPicks) et à deux alternatives classées par le
prix."""
import numpy as np
import pandas as pd

HERE = __file__.rsplit('/', 1)[0]
EXCLUDED = {'VALUE', 'SAFE', 'VANTAGE', 'AVOID', 'CONSENSUS', 'CONTRARIAN'}
MIN_ODDS, MAX_ODDS = 1.20, 1.50

picks = pd.read_pickle(f'{HERE}/picks.pkl')
alerted = set(picks.loc[picks.alerted, 'fixtureId'])
mk = picks.set_index(['fixtureId', 'market', 'pick'])[['fair', 'margin']]
mk = mk[~mk.index.duplicated()]

sel = pd.read_csv(f'{HERE}/engine_sel.csv')
sel['day'] = sel.day.astype(str)
sel['won'] = sel.result.map({'WON': 1.0, 'LOST': 0.0})
sel['selected'] = sel.selected.astype(str).eq('t')
idx = list(zip(sel.fixtureId, sel.market, sel.pick))
m = mk.reindex(idx)
sel['fair'] = m.fair.to_numpy(); sel['margin'] = m.margin.to_numpy()
days = sorted(picks.day.unique())

# Calibration canal × compétition, 90 jours précédents (réel / annoncé, ≥ 30).
status_by_day = {}
settled = sel[sel.won.notna()]
for day in days:
    since = (pd.Timestamp(day) - pd.Timedelta(days=90)).strftime('%Y-%m-%d')
    h = settled[(settled.day >= since) & (settled.day < day)]
    g = h.groupby(['channel', 'competition']).agg(n=('won', 'size'), w=('won', 'sum'), p=('probability', 'sum'))
    g['ratio'] = g.w / g.p
    st = np.where(g.n < 30, 'NA', np.where(g.ratio >= 0.85, 'GREEN', np.where(g.ratio >= 0.70, 'ORANGE', 'RED')))
    status_by_day[day] = dict(zip(g.index, st))

cand = sel[sel.selected & ~sel.channel.isin(EXCLUDED) & sel.day.isin(days)].copy()
cand['status'] = [status_by_day[d].get((c, comp), 'NA') for d, c, comp in zip(cand.day, cand.channel, cand.competition)]
playable = cand.odds.notna() & (cand.odds >= MIN_ODDS)
cheap = playable & (cand.odds < MAX_ODDS)
s = cand.status
cand['tier'] = np.select(
    [(s == 'GREEN') & cheap, (s != 'RED') & cheap, (s == 'GREEN') & playable, (s != 'RED') & playable],
    [0, 1, 2, 3], default=4)
# Notre sélection : palier, puis probabilité du moteur la plus haute.
primary = (cand.sort_values(['fixtureId', 'tier', 'probability'], ascending=[True, True, False])
               .groupby('fixtureId').head(1))
cand['is_primary'] = cand.index.isin(primary.index)


def resid(d, col='fair'):
    d = d.dropna(subset=[col, 'won'])
    if len(d) == 0:
        return '—'
    r = d.won - d[col]
    se = np.sqrt(((r - r.mean()).groupby(d.fixtureId).sum() ** 2).sum()) / len(d)
    return f"{100 * r.mean():+.1f} ± {196 * se:.1f}"


def line(label, d):
    v = d.dropna(subset=['won'])
    f = v.dropna(subset=['fair'])
    return {'groupe': label, 'n': len(v), 'cote_med': round(v.odds.median(), 2) if len(v) else None,
            'moteur': f"{100 * v.probability.mean():.1f}", 'marche': f"{100 * f.fair.mean():.1f}" if len(f) else '—',
            'realise': f"{100 * v.won.mean():.1f}", 'ecart_moteur': resid(v, 'probability'),
            'ecart_marche': resid(f), 'mise_fixe': f"{100 * (v.won * v.odds - 1).mean():+.1f}"}


pd.set_option('display.width', 250); pd.set_option('display.max_columns', 20)
prim = cand[cand.is_primary]
P = lambda d: d.assign(period=np.where(d.day < '2026-09-01', 'P1', 'P2'))

print('=== 1. Notre sélection telle qu\'affichée, un pari par match ===')
rows = [line('Toutes', prim)]
for t, lab in [(0, 'palier 0 : calibré, 1,20–1,50'), (1, 'palier 1 : non « peu fiable », 1,20–1,50'),
               (2, 'palier 2 : calibré, cote ≥ 1,50'), (3, 'palier 3 : non « peu fiable », ≥ 1,50'), (4, 'palier 4 : < 1,20 ou peu fiable')]:
    rows.append(line(lab, prim[prim.tier == t]))
for per, g in P(prim).groupby('period'):
    rows.append(line(f'période {per}', g))
for per, g in P(prim[prim.tier <= 1]).groupby('period'):
    rows.append(line(f'paliers 0–1, période {per}', g))
print(pd.DataFrame(rows).to_string(index=False))

print('\n=== 2. D\'où viendrait l\'indice ? Toutes nos sélections retenues, cote 1,20–1,50 ===')
band = cand[cheap & ~cand.fixtureId.isin(alerted)]
rows = []
for st in ['GREEN', 'ORANGE', 'NA', 'RED']:
    rows.append(line(f'statut {st}', band[band.status == st]))
    for per, g in P(band[band.status == st]).groupby('period'):
        rows.append(line(f'   {st} {per}', g))
rows.append(line('sélection principale du match', band[band.is_primary]))
rows.append(line('autres sélections du match', band[~band.is_primary]))
base = picks[~picks.alerted & (picks.reason != 'market_suspended') & (picks.odds >= MIN_ODDS) & (picks.odds < MAX_ODDS)].dropna(subset=['fair', 'won'])
base = base.assign(probability=base.model_prob)
rows.append(line('référence : tout ce qui est coté, 1,20–1,50', base))
print(pd.DataFrame(rows).to_string(index=False))

print('\n   Désaccord moteur − marché, paliers 0–1 (Notre sélection) :')
d = prim[prim.tier <= 1].dropna(subset=['fair', 'won']).copy()
d['q'] = pd.qcut(d.probability - d.fair, 4, labels=['Q1 moteur ≪ marché', 'Q2', 'Q3', 'Q4 moteur ≫ marché'])
print(pd.DataFrame([line(f'{q} ({100 * (g.probability - g.fair).min():+.0f} à {100 * (g.probability - g.fair).max():+.0f})', g)
                    for q, g in d.groupby('q', observed=True)]).to_string(index=False))

print('\n=== 3. Trois façons de choisir le pari d\'un match (mêmes matchs, cote 1,20–1,50) ===')
matches = set(prim[prim.tier <= 1].fixtureId)
cur = prim[prim.tier <= 1]
by_price_ours = (band[band.fixtureId.isin(matches)].dropna(subset=['fair'])
                 .sort_values(['fixtureId', 'fair', 'margin'], ascending=[True, False, True]).groupby('fixtureId').head(1))
allp = picks[picks.fixtureId.isin(matches) & (picks.reason != 'market_suspended') & (picks.odds >= MIN_ODDS) & (picks.odds < MAX_ODDS)].dropna(subset=['fair', 'won'])
by_price_all = allp.sort_values(['fixtureId', 'fair', 'margin'], ascending=[True, False, True]).groupby('fixtureId').head(1)
by_price_all = by_price_all.assign(probability=by_price_all.model_prob)
rows = [line('Actuel : palier puis probabilité du moteur', cur),
        line('Nos sélections du match, classées par le prix', by_price_ours),
        line('Tout ce qui est coté sur le match, classé par le prix', by_price_all)]
for lab, g in [('Actuel', cur), ('Nos sélections par le prix', by_price_ours), ('Tout le coté par le prix', by_price_all)]:
    g2 = g.dropna(subset=['fair'])
    rows.append({'groupe': f'   coût attendu, {lab}', 'n': len(g2), 'mise_fixe': f"{100 * (g2.fair * g2.odds - 1).mean():+.1f} (au prix d'analyse)",
                 'marche': f"marge {100 * g2.margin.mean():.1f}"})
print(pd.DataFrame(rows).fillna('').to_string(index=False))
print(f"\nMatchs dont Notre sélection est en palier 0–1 : {len(matches)} sur {prim.fixtureId.nunique()} ({100 * len(matches) / prim.fixtureId.nunique():.0f} %)")
