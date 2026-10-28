"""Rejeu du combiné du jour (classe COMBO, source ENGINE) sur 116 jours.

A. Règle actuelle, à l'identique de composeEngineCombo : sélections SELECTED
   des canaux mis en avant, calibration canal × compétition sur les 90 jours
   PRÉCÉDENTS (réel / annoncé, ≥ 30 paris, ≥ 0,85 « fiable », ≥ 0,70 « non
   peu fiable »), sélection principale de chaque match (palier, proba moteur,
   cote), palier ≤ 1, cote croissante, une par championnat, deux jambes.
B. Tout ce qui est coté (evaluatedPicks), classé par la probabilité du
   marché sans marge, deux jambes de championnats différents.
C. Vivier de A, classé par la probabilité du marché.
Tous : cote de jambe 1,20 ≤ cote < 1,50, hors Données suspectes, hors types
suspendus, jamais de « remboursé si nul »."""
import numpy as np
import pandas as pd

HERE = __file__.rsplit('/', 1)[0]
EXCLUDED = {'VALUE', 'SAFE', 'VANTAGE', 'AVOID', 'CONSENSUS', 'CONTRARIAN'}
LO, HI = 1.20, 1.50

picks = pd.read_pickle(f'{HERE}/picks.pkl')
alerted = set(picks.loc[picks.alerted, 'fixtureId'])
fair_of = picks.set_index(['fixtureId', 'market', 'pick'])[['fair', 'margin', 'won']]
fair_of = fair_of[~fair_of.index.duplicated()]

sel = pd.read_csv(f'{HERE}/engine_sel.csv')
sel['day'] = sel.day.astype(str)
sel['won'] = sel.result.map({'WON': 1.0, 'LOST': 0.0})
sel['selected'] = sel.selected.astype(str).eq('t')
days = sorted(d for d in picks.day.unique())


def calibration(day: str) -> dict:
    since = (pd.Timestamp(day) - pd.Timedelta(days=90)).strftime('%Y-%m-%d')
    h = sel[(sel.day >= since) & (sel.day < day) & sel.won.notna()]
    g = h.groupby(['channel', 'competition']).agg(n=('won', 'size'), w=('won', 'sum'), p=('probability', 'sum'))
    g['ratio'] = g.w / g.p
    return {k: (r.n, r.ratio) for k, r in g.iterrows()}


def tier(cell, odds):
    n, ratio = cell if cell else (0, None)
    status = 'NA' if n < 30 or ratio is None or np.isnan(ratio) else ('GREEN' if ratio >= 0.85 else 'ORANGE' if ratio >= 0.70 else 'RED')
    cheap = odds < HI
    if status == 'GREEN' and cheap: return 0
    if status != 'RED' and cheap: return 1
    if status == 'GREEN': return 2
    if status != 'RED': return 3
    return 4


def eligible_current(day: str) -> pd.DataFrame:
    cal = calibration(day)
    d = sel[(sel.day == day) & sel.selected & ~sel.channel.isin(EXCLUDED) & (sel.market != 'DRAW_NO_BET')
            & sel.odds.notna() & (sel.odds >= LO) & ~sel.fixtureId.isin(alerted)].copy()
    if d.empty:
        return d
    d['tier'] = [tier(cal.get((c, comp)), o) for c, comp, o in zip(d.channel, d.competition, d.odds)]
    d = d.sort_values(['tier', 'probability', 'odds'], ascending=[True, False, True]).groupby('fixtureId').head(1)
    return d[d.tier <= 1]


def attach_market(d: pd.DataFrame) -> pd.DataFrame:
    idx = list(zip(d.fixtureId, d.market, d.pick))
    m = fair_of.reindex(idx)
    return d.assign(fair=m.fair.to_numpy(), margin=m.margin.to_numpy())


def take_two(d: pd.DataFrame, order) -> pd.DataFrame | None:
    legs, comps, fixtures = [], set(), set()
    for _, r in order(d).iterrows():
        if r.competition in comps or r.fixtureId in fixtures:
            continue
        legs.append(r); comps.add(r.competition); fixtures.add(r.fixtureId)
        if len(legs) == 2:
            return pd.DataFrame(legs)
    return None


rows = {k: [] for k in 'ABC'}
for day in days:
    cur = eligible_current(day)
    if not cur.empty:
        cur = attach_market(cur)
        a = take_two(cur, lambda x: x.sort_values(['odds', 'probability'], ascending=[True, False]))
        if a is not None: rows['A'].append(a.assign(day=day))
        cm = cur.dropna(subset=['fair'])
        c = take_two(cm, lambda x: x.sort_values(['fair', 'margin'], ascending=[False, True]))
        if c is not None: rows['C'].append(c.assign(day=day))
    wide = picks[(picks.day == day) & ~picks.alerted & (picks.reason != 'market_suspended') & (picks.market != 'DRAW_NO_BET')
                 & (picks.odds >= LO) & (picks.odds < HI)].dropna(subset=['fair', 'won'])
    b = take_two(wide, lambda x: x.sort_values(['fair', 'margin'], ascending=[False, True]))
    if b is not None: rows['B'].append(b.assign(day=day))


def worst_streak(won: list) -> int:
    best = run = 0
    for w in won:
        run = run + 1 if not w else 0
        best = max(best, run)
    return best


labels = {'A': 'A. Règle actuelle (nos sélections calibrées, cote la plus basse)',
          'B': 'B. Tout ce qui est coté, classé par le prix',
          'C': 'C. Nos sélections calibrées, classées par le prix'}
out = []
for k in 'ABC':
    legs = pd.concat(rows[k])
    legs['won'] = legs.won.astype(float)
    cp = legs.groupby('day').agg(odds=('odds', 'prod'), won=('won', 'min'), fair=('fair', 'prod'),
                                 margin=('margin', 'sum'), eng=('probability', 'prod') if 'probability' in legs else ('fair', 'prod'),
                                 n=('won', 'size'))
    cp = cp[cp.n == 2].dropna(subset=['won'])
    n = len(cp); w = cp.won.mean(); se = np.sqrt(w * (1 - w) / n)
    valid = cp.dropna(subset=['fair'])
    out.append({'composition': labels[k], 'jours': f'{n}/{len(days)}', 'cote_moy': round(cp.odds.mean(), 2),
                'annonce_marche': f'{100 * valid.fair.mean():.1f} %',
                'annonce_moteur': f'{100 * cp.eng.mean():.1f} %' if k != 'B' else '—',
                'realise': f'{100 * w:.1f} ± {196 * se:.0f}', 'pire_serie': worst_streak(cp.won.tolist()),
                'cout_attendu': f'{100 * (valid.fair * valid.odds - 1).mean():+.1f} %',
                'marge_moy': f'{100 * valid.margin.mean():.1f} %',
                'mise_fixe_realisee': f'{100 * (cp.won * cp.odds - 1).mean():+.1f} %',
                'jambes_reel_vs_marche': f'{100 * legs.won.mean():.1f} / {100 * legs.fair.mean():.1f}'})
pd.set_option('display.width', 260)
print(pd.DataFrame(out).to_string(index=False))
for k in 'ABC':
    legs = pd.concat(rows[k])
    print(f'\n{k} — marchés :', legs.market.value_counts().head(6).to_dict(), '| cote médiane', round(legs.odds.median(), 2))
    cp = legs.groupby('day').agg(won=('won', 'min'), month=('day', lambda s: s.iloc[0][:7]))
    print('   par mois :', cp.groupby('month').won.agg(lambda x: f'{int(x.sum())}/{len(x)}').to_dict())
