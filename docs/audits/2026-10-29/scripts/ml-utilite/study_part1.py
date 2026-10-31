import csv, sys, collections
import numpy as np

rows = list(csv.DictReader(open(sys.argv[1])))
rng = np.random.default_rng(20261029)
B = 1000

def arr(rs, k): return np.array([float(r[k]) for r in rs])

def cluster_boot(rs, stat):
    """Bootstrap par match : les lignes d'un même match bougent ensemble."""
    by_fix = collections.defaultdict(list)
    for i, r in enumerate(rs): by_fix[r['fixtureId']].append(i)
    groups = list(by_fix.values())
    out = []
    for _ in range(B):
        pick = rng.integers(0, len(groups), len(groups))
        idx = np.concatenate([groups[j] for j in pick])
        out.append(stat(idx))
    out = np.array(out)
    return np.percentile(out, 2.5), np.percentile(out, 97.5)

def slope(y, x, idx=None):
    """Pente sans constante de (y - p_mkt) sur (p_x - p_mkt) = poids optimal du signal sur le marché."""
    if idx is not None: y, x = y[idx], x[idx]
    d = (x * x).sum()
    return (x * y).sum() / d if d > 0 else np.nan

def report(name, rs):
    if len(rs) < 150: return
    y = arr(rs, 'won'); pe = arr(rs, 'p_engine'); pm = arr(rs, 'p_ml')
    has_mkt = all(r['p_fair'] for r in rs)
    nfix = len({r['fixtureId'] for r in rs})
    line = f"{name:<28} n={len(rs):>5} matchs={nfix:>5}"
    be, bm = ((pe - y) ** 2).mean(), ((pm - y) ** 2).mean()
    line += f" | Brier moteur {be:.4f} ML {bm:.4f}"
    line += f" | annoncé moteur {pe.mean():.3f} ML {pm.mean():.3f} réalisé {y.mean():.3f}"
    if has_mkt:
        pk = arr(rs, 'p_fair'); r_ = y - pk
        bk = ((pk - y) ** 2).mean()
        d_ml = lambda i: ((pm[i] - y[i]) ** 2).mean() - ((pk[i] - y[i]) ** 2).mean()
        d_en = lambda i: ((pe[i] - y[i]) ** 2).mean() - ((pk[i] - y[i]) ** 2).mean()
        all_i = np.arange(len(rs))
        lo_m, hi_m = cluster_boot(rs, d_ml); lo_e, hi_e = cluster_boot(rs, d_en)
        w_ml = slope(r_, pm - pk); w_en = slope(r_, pe - pk)
        wl_ml = cluster_boot(rs, lambda i: slope(r_, pm - pk, i))
        wl_en = cluster_boot(rs, lambda i: slope(r_, pe - pk, i))
        corr = np.corrcoef(pm - pk, pe - pk)[0, 1]
        line += f"\n{'':<28} marché {bk:.4f} (annoncé {pk.mean():.3f})"
        line += f"\n{'':<28} écart au marché  moteur {d_en(all_i):+.4f} [{lo_e:+.4f}, {hi_e:+.4f}]   ML {d_ml(all_i):+.4f} [{lo_m:+.4f}, {hi_m:+.4f}]"
        line += f"\n{'':<28} poids optimal sur le marché  moteur {w_en:+.2f} [{wl_en[0]:+.2f}, {wl_en[1]:+.2f}]   ML {w_ml:+.2f} [{wl_ml[0]:+.2f}, {wl_ml[1]:+.2f}]"
        line += f"\n{'':<28} corrélation des écarts au marché (ML, moteur) {corr:+.2f} ; écart moyen |ML−marché| {np.abs(pm-pk).mean():.3f} |moteur−marché| {np.abs(pe-pk).mean():.3f}"
    print(line)

print("=== Par canal, tout l'historique (juillet → 29 octobre) ===")
by_ch = collections.defaultdict(list)
for r in rows: by_ch[r['channel']].append(r)
for ch, rs in sorted(by_ch.items(), key=lambda kv: -len(kv[1])):
    report(ch, rs if ch != 'VALUE' else [r for r in rs if r['p_fair']])

print("\n=== Tous canaux avec prix de marché ===")
report("TOUS", [r for r in rows if r['p_fair']])

print("\n=== Par période (avant / après le 16/09, où l'identifiant de modèle apparaît) ===")
for ch in ['GOALS', 'BTTS', 'DOMINANT', 'TEAM_TOTAL', 'CLEAN_SHEET', 'WIN_EITHER_HALF']:
    rs = by_ch[ch]
    report(f"{ch} < 16/09", [r for r in rs if r['analyzedAt'] < '2026-09-16'])
    report(f"{ch} ≥ 16/09", [r for r in rs if r['analyzedAt'] >= '2026-09-16'])

print("\n=== Calibration de la correction ML par tranche de proba annoncée (canaux avec marché) ===")
mk = [r for r in rows if r['p_fair']]
pm = arr(mk, 'p_ml'); y = arr(mk, 'won'); pe = arr(mk, 'p_engine'); pk = arr(mk, 'p_fair')
for lo, hi in [(0, .4), (.4, .5), (.5, .6), (.6, .7), (.7, .8), (.8, 1.01)]:
    m = (pm >= lo) & (pm < hi)
    if m.sum() > 50:
        print(f"ML {lo:.1f}–{hi:.1f}: n={m.sum():>5}  annoncé ML {pm[m].mean():.3f}  marché {pk[m].mean():.3f}  moteur {pe[m].mean():.3f}  réalisé {y[m].mean():.3f}")
