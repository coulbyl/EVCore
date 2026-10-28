"""Rejeu du compositeur cote 2–3 sur plusieurs viviers. Taux de cellule
(marché × tranche de cote) calculés uniquement sur les jours PRÉCÉDENTS."""
import numpy as np
import pandas as pd

df = pd.read_pickle(__file__.rsplit('/', 1)[0] + '/picks.pkl')
df = df[(df.odds >= 1.20) & (df.odds <= 1.80)].dropna(subset=['won']).copy()
df['band'] = pd.cut(df.odds, [1.199, 1.35, 1.5, 1.65, 1.801], labels=['a', 'b', 'c', 'd']).astype(str)
df['cell'] = df.market + '|' + df.band
WINDOW = (2.10, 3.15)  # ≈ 2,00–3,00 chez 1xBet
days = sorted(df.day.unique())


def cell_rates(pool: pd.DataFrame) -> dict:
    """{(cell, day): taux réalisé de la cellule avant ce jour, si ≥ 50 jambes}."""
    daily = pool.groupby(['cell', 'day']).won.agg(['sum', 'size']).reset_index().sort_values('day')
    out = {}
    for cell, g in daily.groupby('cell'):
        w = n = 0
        for _, r in g.iterrows():
            if n >= 50:
                out[(cell, r.day)] = w / n
            w += r['sum']; n += r['size']
        out[(cell, '__last__')] = (w, n)
    return out


def rate_for(rates, cell, day, hist_days):
    v = rates.get((cell, day))
    if v is not None:
        return v
    return None


def best_combo(legs: pd.DataFrame, k: int):
    """Combinaison de k jambes (matchs distincts) dans la fenêtre, de score
    maximal, à égalité la marge totale la plus basse."""
    if len(legs) < k:
        return None
    o = legs.odds.to_numpy(); sc = legs.score.to_numpy(); fx = legs.fixtureId.to_numpy()
    mg = legs.margin_f.to_numpy()
    best = None
    if k == 2:
        for i in range(len(o)):
            prod = o[i] * o
            ok = (prod >= WINDOW[0]) & (prod <= WINDOW[1]) & (fx != fx[i])
            ok[:i + 1] = False
            if not ok.any():
                continue
            s = sc[i] * sc
            s = np.where(ok, s - 1e-6 * (mg[i] + mg), -1)
            j = int(s.argmax())
            if best is None or s[j] > best[0]:
                best = (s[j], (i, j))
    else:
        cand = legs[legs.odds <= 1.47].head(90)
        o = cand.odds.to_numpy(); sc = cand.score.to_numpy(); fx = cand.fixtureId.to_numpy(); mg = cand.margin_f.to_numpy()
        idx = cand.index.to_numpy()
        for i in range(len(o)):
            for j in range(i + 1, len(o)):
                if fx[i] == fx[j]:
                    continue
                prod = o[i] * o[j] * o
                ok = (prod >= WINDOW[0]) & (prod <= WINDOW[1]) & (fx != fx[i]) & (fx != fx[j])
                ok[:j + 1] = False
                if not ok.any():
                    continue
                s = np.where(ok, sc[i] * sc[j] * sc - 1e-6 * (mg[i] + mg[j] + mg), -1)
                l = int(s.argmax())
                if best is None or s[l] > best[0]:
                    best = (s[l], (i, j, l))
        if best is None:
            return None
        return cand.iloc[list(best[1])]
    if best is None:
        return None
    return legs.iloc[list(best[1])]


def replay(pool: pd.DataFrame, ranking: str, legs_rule: str, label: str) -> dict:
    rates = cell_rates(pool) if ranking == 'cell' else None
    rows = []
    for day in days[1:]:
        today = pool[pool.day == day].copy()
        if today.empty:
            continue
        if ranking == 'cell':
            today['score'] = [rates.get((c, day)) for c in today.cell]
        else:
            today['score'] = today.fair
        today = today.dropna(subset=['score'])
        today['margin_f'] = today.margin.fillna(0.06)
        # Par match, la meilleure jambe de chaque tranche : assez pour composer.
        today = (today.sort_values(['score', 'margin_f'], ascending=[False, True])
                      .groupby(['fixtureId', 'band']).head(1)
                      .sort_values('score', ascending=False).reset_index(drop=True))
        if legs_rule == '2puis3':
            combo = best_combo(today, 2)
            if combo is None:
                combo = best_combo(today, 3)
        else:  # meilleur des deux
            c2, c3 = best_combo(today, 2), best_combo(today, 3)
            cands = [c for c in (c2, c3) if c is not None]
            combo = max(cands, key=lambda c: c.score.prod()) if cands else None
        if combo is None:
            continue
        rows.append({'day': day, 'legs': len(combo), 'odds': combo.odds.prod(),
                     'announced': combo.score.prod(), 'won': combo.won.min(),
                     'fair': combo.fair.prod() if combo.fair.notna().all() else np.nan,
                     'margin': combo.margin_f.sum()})
    r = pd.DataFrame(rows)
    n = len(r); w = r.won.mean()
    se = np.sqrt(w * (1 - w) / n)
    exp_ret = (r.fair * r.odds - 1).mean()
    return {'variante': label, 'jours': f'{n}/{len(days) - 1}', 'jambes_moy': round(r.legs.mean(), 2),
            'cote_moy': round(r.odds.mean(), 2), 'annonce': f'{100 * r.announced.mean():.1f} %',
            'realise': f'{100 * w:.1f} ± {196 * se:.0f}',
            'cout_attendu': f'{100 * exp_ret:+.1f} %', 'marge_moy': f'{100 * r.margin.mean():.1f} %',
            'mise_fixe_realisee': f'{100 * (r.won * r.odds - 1).mean():+.1f} %'}


current = df[df.in_pool & ~df.alerted]
wide = df[(df.reason != 'market_suspended') & ~df.alerted]
wide_alert = df[df.reason != 'market_suspended']
out = [
    replay(current, 'cell', 'best', 'A. Vivier actuel, cellule, 2 ou 3 (proposé hier)'),
    replay(current, 'cell', '2puis3', 'B. Vivier actuel, cellule, 2 puis 3'),
    replay(wide, 'cell', '2puis3', 'C. Vivier élargi, cellule, 2 puis 3'),
    replay(wide_alert, 'cell', '2puis3', 'D. Élargi + Données suspectes, cellule, 2 puis 3'),
    replay(wide[wide.fair.notna()], 'fair', '2puis3', 'E. Vivier élargi, prix du marché, 2 puis 3'),
    replay(wide_alert[wide_alert.fair.notna()], 'fair', '2puis3', 'F. Élargi + Données suspectes, prix du marché, 2 puis 3'),
]
pd.set_option('display.width', 250)
print(pd.DataFrame(out).to_string(index=False))
