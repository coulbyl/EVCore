"""Chasseurs BTTS et Nul : rejeu des deux classements sur 116 jours (copie de
prod du 24/10), avant l'ombre prospective.

Une sélection par jour et par chasseur, ou l'abstention, dans la bande du
marché (cote d'analyse) :
- prix, le moins cher (retenu, composeHunterByMarket) : tout ce qui est coté
  sur le marché, la marge la plus basse, puis la probabilité du marché ;
- prix, le plus probable (règle d'abord écrite, abandonnée) : probabilité du
  marché sans marge la plus haute, puis la marge ;
- moteur : les sélections retenues du canal, probabilité du canal recalée sur
  sa calibration canal × compétition des 90 jours PRÉCÉDENTS (≥ 30 réglées),
  sans les cellules « peu fiables » (< 0,70) (composeHunterByEngine).

Jugé jambe par jambe : réalisé − probabilité du marché, réalisé ÷ annoncé,
coût au prix d'analyse, pire série. Matchs « Données suspectes » exclus.

Entrées : picks.pkl (prep.py) et engine_sel.csv (export.sql), dans DATA
(par défaut à côté du script)."""
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get('DATA', HERE)

HUNTERS = {
    'BTTS (oui)': dict(market='BTTS', pick='YES', channel='BTTS', band=(1.45, 1.90)),
    'Nul': dict(market='ONE_X_TWO', pick='DRAW', channel='DRAW', band=(2.90, 3.60)),
}

picks = pd.read_pickle(f'{DATA}/picks.pkl')
alerted = set(picks.loc[picks.alerted, 'fixtureId'])
market_prob = picks.set_index(['fixtureId', 'market', 'pick'])['fair']
market_prob = market_prob[~market_prob.index.duplicated()]
days = sorted(picks.day.unique())

sel = pd.read_csv(f'{DATA}/engine_sel.csv')
sel['day'] = sel.day.astype(str)
sel['won'] = sel.result.map({'WON': 1.0, 'LOST': 0.0})
sel['selected'] = sel.selected.astype(str).eq('t')
settled_sel = sel[sel.won.notna()]


def ratios_before(day: str) -> dict:
    since = (pd.Timestamp(day) - pd.Timedelta(days=90)).strftime('%Y-%m-%d')
    h = settled_sel[(settled_sel.day >= since) & (settled_sel.day < day)]
    g = h.groupby(['channel', 'competition']).agg(
        n=('won', 'size'), w=('won', 'sum'), p=('probability', 'sum'))
    g = g[g.n >= 30]
    return (g.w / g.p).to_dict()


def market_pick(day: str, spec: dict):
    lo, hi = spec['band']
    c = picks[(picks.day == day) & (picks.market == spec['market'])
              & (picks.pick == spec['pick']) & picks.fair.notna()
              & picks.won.notna() & (picks.odds >= lo) & (picks.odds <= hi)
              & ~picks.fixtureId.isin(alerted)]
    if c.empty:
        return None
    best = c.sort_values(['fair', 'margin'], ascending=[False, True]).iloc[0]
    return dict(day=day, odds=best.odds, announced=best.fair,
                market=best.fair, won=best.won)


def margin_pick(day: str, spec: dict):
    """Le moins cher : la marge la plus basse d'abord (règle retenue)."""
    lo, hi = spec['band']
    c = picks[(picks.day == day) & (picks.market == spec['market'])
              & (picks.pick == spec['pick']) & picks.fair.notna()
              & picks.won.notna() & (picks.odds >= lo) & (picks.odds <= hi)
              & ~picks.fixtureId.isin(alerted)]
    if c.empty:
        return None
    best = c.sort_values(['margin', 'fair'], ascending=[True, False]).iloc[0]
    return dict(day=day, odds=best.odds, announced=best.fair,
                market=best.fair, won=best.won)


def engine_pick(day: str, spec: dict, ratios: dict):
    lo, hi = spec['band']
    c = sel[(sel.day == day) & sel.selected & (sel.channel == spec['channel'])
            & (sel.market == spec['market']) & (sel.pick == spec['pick'])
            & sel.won.notna() & (sel.odds >= lo) & (sel.odds <= hi)
            & ~sel.fixtureId.isin(alerted)].copy()
    if c.empty:
        return None
    r = [ratios.get((spec['channel'], comp)) for comp in c.competition]
    c['ratio'] = [1.0 if x is None else x for x in r]
    c = c[c.ratio >= 0.70]
    if c.empty:
        return None
    c['calibrated'] = c.probability * c.ratio
    best = c.sort_values(['calibrated', 'odds'], ascending=[False, True]).iloc[0]
    fair = market_prob.get((best.fixtureId, best.market, best.pick), np.nan)
    return dict(day=day, odds=best.odds, announced=best.probability,
                market=fair, won=best.won)


def worst_streak(won: pd.Series) -> int:
    worst = run = 0
    for w in won:
        run = run + 1 if w == 0 else 0
        worst = max(worst, run)
    return worst


def summary(rows: pd.DataFrame) -> str:
    if rows.empty:
        return 'aucune jambe'
    m = rows.dropna(subset=['market'])
    gap = m.won - m.market
    se = gap.std(ddof=1) / np.sqrt(len(m)) if len(m) > 1 else np.nan
    return (f"{len(rows):3d} jambes · cote méd. {rows.odds.median():.2f} · "
            f"annoncé {rows.announced.mean():.1%} · marché {m.market.mean():.1%} · "
            f"réalisé {rows.won.mean():.1%} · écart au marché "
            f"{gap.mean() * 100:+.1f} ± {1.96 * se * 100:.1f} pts · "
            f"réalisé/annoncé {rows.won.mean() / rows.announced.mean():.2f} · "
            f"coût {(rows.won * rows.odds).mean() - 1:+.1%} · "
            f"pire série {worst_streak(rows.won)}")


ratios_by_day = {day: ratios_before(day) for day in days}
for name, spec in HUNTERS.items():
    for ranking in ('prix, le moins cher', 'prix, le plus probable', 'moteur'):
        rows = []
        for day in days:
            pick = (margin_pick(day, spec) if ranking == 'prix, le moins cher'
                    else market_pick(day, spec) if ranking == 'prix, le plus probable'
                    else engine_pick(day, spec, ratios_by_day[day]))
            if pick:
                rows.append(pick)
        df = pd.DataFrame(rows)
        print(f"{name} · {ranking} · {len(df)} jours sur {len(days)}")
        print(f"  tout       : {summary(df)}")
        if not df.empty:
            first = df[df.day < '2026-09-01']
            second = df[df.day >= '2026-09-01']
            print(f"  juil.–août : {summary(first)}")
            print(f"  sept.–oct. : {summary(second)}")

# Référence : tout ce qui est coté dans la bande, sans classement. Si le
# premier du jour ne fait pas mieux, le classement n'apporte rien.
for name, spec in HUNTERS.items():
    lo, hi = spec['band']
    ref = picks[(picks.market == spec['market']) & (picks.pick == spec['pick'])
                & picks.fair.notna() & picks.won.notna()
                & (picks.odds >= lo) & (picks.odds <= hi)
                & ~picks.fixtureId.isin(alerted)]
    ref = ref.assign(announced=ref.fair, market=ref.fair).sort_values('day')
    print(f"{name} · référence, tout le coté de la bande")
    print(f"  tout       : {summary(ref[['day', 'odds', 'announced', 'market', 'won']])}")
