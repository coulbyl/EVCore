"""Marge payée chez 1xBet : mesure et rejeu (lot 3, plan-lot-3-2026-10-28.md).

1. Marge 1xBet par marché et par championnat (groupes complets, dernière cote
   d'avant-match), comparée à la marge de référence.
2. Couverture : part du vivier coté dont le groupe est complet chez 1xBet.
3. Rejeu du coupon cote 2 et des chasseurs depuis le 13/09 (début des cotes
   1xBet), avec trois classements : la règle actuelle (marge de référence),
   la marge 1xBet, et pour le coupon cote 2 le retour attendu au prix 1xBet.

Entrées dans DATA : picks.pkl (étude du 28/10), engine_sel.csv,
operator_prices.csv, operator_scores.csv, fixtures.csv (operator-export.sql).
"""
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get('DATA', HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '2026-10-28', 'scripts'))
from prep import GROUP_SIZE, group_key  # noqa: E402

START = '2026-09-13'

fixtures = pd.read_csv(f'{DATA}/fixtures.csv')
fixtures['day'] = fixtures.day.astype(str)
comp_of = dict(zip(fixtures.fixtureId, fixtures.competition))

# ── Prix 1xBet par groupe complet ─────────────────────────────────────────
op = pd.read_csv(f'{DATA}/operator_prices.csv').dropna(subset=['odds'])
op = op[op.odds > 1]
op['gkey'] = op.apply(group_key, axis=1)
op = op.dropna(subset=['gkey'])
op['implied'] = 1 / op.odds
g = op.groupby(['fixtureId', 'gkey']).agg(n=('implied', 'size'), s=('implied', 'sum')).reset_index()
g['base'] = g.gkey.str.split('|').str[0]
g['need'] = g.base.map(lambda b: GROUP_SIZE[b][0])
g['total'] = g.base.map(lambda b: GROUP_SIZE[b][1])
g = g[g.n == g.need]
g['op_margin'] = g.s / g.total - 1
op = op.merge(g[['fixtureId', 'gkey', 'op_margin', 's', 'total']], on=['fixtureId', 'gkey'])
op['op_fair'] = op.implied / (op.s / op.total)
op = op.rename(columns={'odds': 'op_odds'})[['fixtureId', 'market', 'pick', 'op_odds', 'op_margin', 'op_fair']]

# Grille de score exact : marge = somme des implicites − 1.
sc = pd.read_csv(f'{DATA}/operator_scores.csv').dropna(subset=['odds'])
sc = sc[sc.odds > 1]
grid = sc.groupby('fixtureId').agg(scores=('odds', 'size'),
                                   grid_margin=('odds', lambda o: (1 / o).sum() - 1)).reset_index()

print('== 1. Marge 1xBet par marché (groupes complets, médiane) ==')
gm = g.assign(comp=g.fixtureId.map(comp_of))
by_market = gm.groupby('base').op_margin.agg(['size', 'median', lambda x: x.quantile(0.1), lambda x: x.quantile(0.9)])
by_market.columns = ['groupes', 'médiane', 'p10', 'p90']
print((by_market.sort_values('médiane') * [1, 100, 100, 100]).round(1).to_string())
print(f"Score exact : {len(grid)} grilles, {grid.scores.median():.0f} scores en médiane, "
      f"marge médiane {grid.grid_margin.median() * 100:.0f} %")

print('\n== 1b. Marge 1X2 de 1xBet par championnat (≥ 20 matchs) ==')
x = gm[gm.base == 'ONE_X_TWO'].groupby('comp').op_margin.agg(['size', 'median'])
x = x[x['size'] >= 20].sort_values('median')
x['median'] = (x['median'] * 100).round(1)
print('moins chers :', ', '.join(f"{c} {m} %" for c, m in x['median'].head(10).items()))
print('plus chers  :', ', '.join(f"{c} {m} %" for c, m in x['median'].tail(8).items()))

# ── Vivier du coupon cote 2 sur la fenêtre 1xBet ──────────────────────────
picks = pd.read_pickle(f'{DATA}/picks.pkl')
picks = picks[(picks.day >= START) & picks.fair.notna() & picks.won.notna() & ~picks.alerted
              & (picks.market != 'DRAW_NO_BET')]
pool = picks.merge(op, on=['fixtureId', 'market', 'pick'], how='left')
covered = pool.op_odds.notna()
print('\n== 2. Couverture ==')
print(f"vivier coté depuis le {START} : {len(pool)} sélections, {covered.mean():.1%} avec un groupe complet chez 1xBet")
print(pool.assign(c=covered).groupby('market').c.mean().mul(100).round(0).sort_values().to_string())
print(f"marge de référence médiane du vivier couvert {pool[covered].margin.median() * 100:.1f} % "
      f"contre {pool[covered].op_margin.median() * 100:.1f} % chez 1xBet")
pool = pool[covered].copy()
days = sorted(pool.day.unique())


def ci(s: pd.Series) -> str:
    if len(s) < 2:
        return '—'
    return f"{s.mean() * 100:+.1f} ± {1.96 * s.std(ddof=1) / np.sqrt(len(s)) * 100:.1f}"


def coupon_double(day_pool: pd.DataFrame, rule: str):
    c = day_pool[(day_pool.op_odds >= 1.2) & (day_pool.op_odds <= 1.8)]
    # Une jambe par match et par dixième de cote, la meilleure pour la règle.
    key = {'actuelle': ['fair', 'margin'], 'marge 1xBet': ['fair', 'op_margin'],
           'retour 1xBet': ['ret', 'op_margin']}[rule]
    c = c.assign(ret=c.fair * c.op_odds, bucket=(c.op_odds * 10).astype(int))
    c = (c.sort_values([key[0], key[1]], ascending=[False, True])
          .groupby(['fixtureId', 'bucket']).head(1)).to_dict('records')
    best, best_key = None, None
    for i in range(len(c)):
        for j in range(i + 1, len(c)):
            a, b = c[i], c[j]
            if a['fixtureId'] == b['fixtureId']:
                continue
            odds = a['op_odds'] * b['op_odds']
            if odds < 2 or odds > 3:
                continue
            if rule == 'actuelle':
                k = (a['fair'] * b['fair'], -(a['margin'] + b['margin']))
            elif rule == 'marge 1xBet':
                k = (a['fair'] * b['fair'], -(a['op_margin'] + b['op_margin']))
            else:
                k = (a['ret'] * b['ret'], a['fair'] * b['fair'])
            if best_key is None or k > best_key:
                best, best_key = (a, b), k
    return best


print('\n== 3. Coupon cote 2, rejoué au prix 1xBet ==')
for rule in ('actuelle', 'marge 1xBet', 'retour 1xBet'):
    rows = []
    for day in days:
        pair = coupon_double(pool[pool.day == day], rule)
        if pair:
            a, b = pair
            rows.append(dict(day=day, won=a['won'] * b['won'], ann=a['fair'] * b['fair'],
                             odds=a['op_odds'] * b['op_odds'],
                             cost=a['fair'] * a['op_odds'] * b['fair'] * b['op_odds'] - 1,
                             margin=(a['op_margin'] + b['op_margin']) / 2,
                             legs=[(a['won'], a['fair']), (b['won'], b['fair'])]))
    d = pd.DataFrame(rows)
    legs = pd.DataFrame([leg for r in rows for leg in r['legs']], columns=['won', 'fair'])
    print(f"{rule:13s}: {len(d)} jours sur {len(days)} · cote 1xBet méd. {d.odds.median():.2f} · "
          f"annoncé {d.ann.mean():.1%} · réalisé {d.won.mean():.1%} · marge 1xBet moy. {d.margin.mean() * 100:.1f} % · "
          f"coût attendu {d.cost.mean() * 100:+.1f} % · réalisé à mise fixe {(d.won * d.odds).mean() - 1:+.1%} · "
          f"écart par jambe {ci(legs.won - legs.fair)} pts")

# ── Chasseurs ─────────────────────────────────────────────────────────────
print('\n== 4. Chasseurs, rejoués au prix 1xBet ==')
HUNTERS = {'BTTS (oui)': ('BTTS', 'YES', (1.45, 1.90)), 'Nul': ('ONE_X_TWO', 'DRAW', (2.90, 3.60))}
for name, (market, pick, (lo, hi)) in HUNTERS.items():
    c = pool[(pool.market == market) & (pool.pick == pick) & (pool.op_odds >= lo) & (pool.op_odds <= hi)]
    for rule, keys in (('marge de référence', ['margin', 'fair']), ('marge 1xBet', ['op_margin', 'fair'])):
        best = (c.sort_values(['day'] + keys, ascending=[True, True, False]).groupby('day').head(1))
        print(f"{name:11s} · {rule:18s}: {len(best)} jours · cote 1xBet méd. {best.op_odds.median():.2f} · "
              f"marge 1xBet moy. {best.op_margin.mean() * 100:.1f} % · marché {best.fair.mean():.1%} · "
              f"réalisé {best.won.mean():.1%} · écart {ci(best.won - best.fair)} pts · "
              f"à mise fixe 1xBet {(best.won * best.op_odds).mean() - 1:+.1%}")

sel = pd.read_csv(f'{DATA}/engine_sel.csv')
sel['day'] = sel.day.astype(str)
cs = sel[(sel.market == 'CORRECT_SCORE') & sel.selected.astype(str).eq('t') & (sel.day >= START)
         & sel.result.isin(['WON', 'LOST'])].copy()
cs['won'] = cs.result.eq('WON').astype(float)
sco = sc.rename(columns={'odds': 'op_odds'})
cs = cs.merge(sco, on=['fixtureId', 'pick'], how='inner').merge(grid, on='fixtureId')
cs = cs[(cs.op_odds >= 5) & (cs.op_odds <= 12)]
cs['market_prob'] = 1 / cs.odds / 1.27
for rule, keys, asc in (('cote la plus basse', ['op_odds'], [True]),
                        ('grille 1xBet la moins chère', ['grid_margin', 'op_odds'], [True, True])):
    best = cs.sort_values(['day'] + keys, ascending=[True] + asc).groupby('day').head(1)
    print(f"Score exact · {rule:27s}: {len(best)} jours · cote 1xBet méd. {best.op_odds.median():.2f} · "
          f"marge de grille moy. {best.grid_margin.mean() * 100:.0f} % · marché {best.market_prob.mean():.1%} · "
          f"réalisé {best.won.mean():.1%} · à mise fixe 1xBet {(best.won * best.op_odds).mean() - 1:+.1%}")
