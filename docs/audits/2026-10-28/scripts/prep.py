"""Préparation commune : marge retirée par groupe exhaustif, colonnes dérivées."""
import re
import numpy as np
import pandas as pd

HERE = __file__.rsplit('/', 1)[0]


def line_of(pick: str) -> str:
    m = re.search(r'_(\d+)_(\d+)$', pick)
    return f"{m.group(1)}.{m.group(2)}" if m else "2.5"


def group_key(row) -> str | None:
    m, p = row.market, row.pick
    if m in ('ONE_X_TWO', 'FIRST_HALF_WINNER', 'BTTS', 'CLEAN_SHEET_HOME',
             'CLEAN_SHEET_AWAY', 'WIN_TO_NIL_HOME', 'WIN_TO_NIL_AWAY',
             'DRAW_NO_BET', 'DOUBLE_CHANCE', 'HALF_TIME_FULL_TIME', 'RESULT_BTTS'):
        return m
    if m in ('OVER_UNDER', 'OVER_UNDER_HT', 'TEAM_TOTAL_HOME', 'TEAM_TOTAL_AWAY'):
        return f"{m}|{line_of(p)}"
    if m == 'RESULT_TOTAL_GOALS':
        return f"{m}|{line_of(p)}"
    return None  # TO_WIN_EITHER_HALF : issues non exclusives


# Nombre d'issues d'un groupe complet, et somme des vraies probabilités.
GROUP_SIZE = {
    'ONE_X_TWO': (3, 1), 'FIRST_HALF_WINNER': (3, 1), 'BTTS': (2, 1),
    'CLEAN_SHEET_HOME': (2, 1), 'CLEAN_SHEET_AWAY': (2, 1),
    'WIN_TO_NIL_HOME': (2, 1), 'WIN_TO_NIL_AWAY': (2, 1),
    'DRAW_NO_BET': (2, 1), 'DOUBLE_CHANCE': (3, 2),
    'HALF_TIME_FULL_TIME': (9, 1), 'RESULT_BTTS': (6, 1),
    'OVER_UNDER': (2, 1), 'OVER_UNDER_HT': (2, 1),
    'TEAM_TOTAL_HOME': (2, 1), 'TEAM_TOTAL_AWAY': (2, 1),
    'RESULT_TOTAL_GOALS': (6, 1),
}


def load() -> pd.DataFrame:
    df = pd.read_csv(f'{HERE}/picks.csv')
    df['won'] = df.won.map({'t': 1.0, 'f': 0.0})
    df['in_pool'] = df.in_pool.eq('t')
    df['alerted'] = df.alerted.eq('t')
    df['reason'] = df.rejection_reason.fillna('viable')
    df['implied'] = 1 / df.odds
    df['gkey'] = df.apply(group_key, axis=1)
    g = df.dropna(subset=['gkey']).groupby(['fixtureId', 'gkey'])
    agg = g.agg(n=('implied', 'size'), s=('implied', 'sum')).reset_index()
    agg['base'] = agg.gkey.str.split('|').str[0]
    agg['need'] = agg.base.map(lambda b: GROUP_SIZE[b][0])
    agg['total'] = agg.base.map(lambda b: GROUP_SIZE[b][1])
    agg = agg[agg.n == agg.need]
    agg['overround'] = agg.s / agg.total
    df = df.merge(agg[['fixtureId', 'gkey', 'overround']],
                  on=['fixtureId', 'gkey'], how='left')
    df['fair'] = df.implied / df.overround
    df['margin'] = df.overround - 1
    df['month'] = df.day.str[:7]
    df['period'] = np.where(df.day < '2026-09-01', 'P1 juil.-août', 'P2 sept.-oct.')
    return df


def clustered(df: pd.DataFrame, col: str) -> tuple[float, float]:
    """Moyenne de `col` et demi-largeur d'IC 95 % groupée par match."""
    d = df.dropna(subset=[col])
    n = len(d)
    if n == 0:
        return float('nan'), float('nan')
    mean = d[col].mean()
    resid = (d[col] - mean).groupby(d.fixtureId).sum()
    se = np.sqrt((resid ** 2).sum()) / n
    return mean, 1.96 * se


def summarize(df: pd.DataFrame) -> dict:
    d = df.dropna(subset=['won'])
    d = d.assign(res_model=d.won - d.model_prob, res_fair=d.won - d.fair,
                 ret=d.won * d.odds - 1)
    out = {'jambes': len(d), 'matchs': d.fixtureId.nunique(),
           'cote_med': round(d.odds.median(), 2)}
    out['annonce_moteur'] = round(100 * d.model_prob.mean(), 1)
    out['marche_sans_marge'] = round(100 * d.fair.mean(), 1)
    out['realise'] = round(100 * d.won.mean(), 1)
    m, h = clustered(d, 'res_model')
    out['ecart_moteur'] = f"{100*m:+.1f} ± {100*h:.1f}"
    m, h = clustered(d, 'res_fair')
    out['ecart_marche'] = f"{100*m:+.1f} ± {100*h:.1f}" if not np.isnan(m) else '—'
    m, h = clustered(d, 'ret')
    out['mise_fixe'] = f"{100*m:+.1f} ± {100*h:.1f}"
    return out
