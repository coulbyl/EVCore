import numpy as np, pandas as pd, io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    import combo as C
ref_odds = C.picks.set_index(['fixtureId', 'market', 'pick']).odds
ref_odds = ref_odds[~ref_odds.index.duplicated()]

def leg_stats(k):
    legs = pd.concat(C.rows[k]).copy()
    legs['won'] = legs.won.astype(float)
    legs['ref'] = ref_odds.reindex(list(zip(legs.fixtureId, legs.market, legs.pick))).to_numpy()
    sub = legs.dropna(subset=['fair', 'won'])
    res = sub.won - sub.fair
    se = np.sqrt(((res - res.mean()) ** 2).sum()) / len(sub)
    gap = (legs.odds / legs.ref - 1).dropna()
    return legs, sub, res.mean(), se, gap

for k in 'ABC':
    legs, sub, m, se, gap = leg_stats(k)
    # Coupon au même prix pour tous : la cote d'analyse (evaluatedPicks) de chaque jambe.
    cp = legs.groupby('day').agg(n=('won', 'size'), won=('won', 'min'), fair=('fair', 'prod'), ref=('ref', 'prod'),
                                 has=('fair', lambda s: s.notna().all()))
    cp = cp[(cp.n == 2) & cp.has]
    cost = (cp.fair * cp.ref - 1).mean()
    print(f"{k}: jambes avec proba marché {len(sub)}/{len(legs)} | réalisé {100*sub.won.mean():.1f} vs marché {100*sub.fair.mean():.1f} "
          f"→ écart {100*m:+.1f} ± {196*se:.1f} | cote de la sélection / cote d'analyse : {100*gap.mean():+.1f} % (n={len(gap)}) "
          f"| coût attendu au prix d'analyse {100*cost:+.1f} % sur {len(cp)} coupons")
    if k == 'A':
        ws = legs[legs.market == 'TO_WIN_EITHER_HALF']
        print(f"   A, jambes « gagner une mi-temps » : {len(ws)}, réalisé {100*ws.won.mean():.1f} %, cote moy. {ws.odds.mean():.2f}")
        # Écart au marché par palier de calibration (vert / orange).
        sub = sub.assign(tier=sub.tier)
        for t, g in sub.groupby('tier'):
            print(f"   A, palier {int(t)} : {len(g)} jambes, réalisé {100*g.won.mean():.1f} vs marché {100*g.fair.mean():.1f}")
