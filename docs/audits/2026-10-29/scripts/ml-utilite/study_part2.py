"""Partie 2 — un modèle peut-il apprendre le résidu (réalisé − marché) à partir des features du moteur ?
Walk-forward par mois (apprend sur les mois précédents, teste sur le mois), jugé contre le prix de marché sans marge
au même instant. Une ligne = un match (dernière analyse avant le coup d'envoi)."""
import sys, warnings
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
warnings.filterwarnings("ignore")
rng = np.random.default_rng(20261029); B = 500

df = pd.read_csv(sys.argv[1])
inj = pd.read_csv(sys.argv[2]) if len(sys.argv) > 2 else None
if inj is not None: df = df.merge(inj, on="fixtureId", how="left")
df["month"] = pd.to_datetime(df["scheduledAt"]).dt.strftime("%Y-%m")
df["y_home"] = (df.home_score > df.away_score).astype(int)
df["y_draw"] = (df.home_score == df.away_score).astype(int)
df["y_away"] = (df.home_score < df.away_score).astype(int)
df["y_over25"] = (df.home_score + df.away_score > 2).astype(int)
df["y_btts"] = ((df.home_score > 0) & (df.away_score > 0)).astype(int)
df["pm_under25"] = 1 - df.pm_over25
df["pe_under25"] = 1 - df.pe_over25

def logit(p): p = np.clip(p, 1e-4, 1 - 1e-4); return np.log(p / (1 - p))

FEATS = ["lambda_home", "lambda_away", "recent_form", "xg", "perf_dom_ext", "volat_ligue", "home_draw_rate",
         "away_draw_rate", "off_ratio", "congestion", "h2h", "h2h_over25", "h2h_btts", "h2h_n",
         "af_home", "af_draw", "af_away", "hours_before", "inj_home", "inj_away",
         "pm_home", "pm_draw", "pm_away", "pm_over25", "pm_btts"]
FEATS = [f for f in FEATS if f in df.columns]

def design(d, target, engine_col, market_col, kind):
    X = pd.DataFrame({"lm": logit(d[market_col].values)})
    if kind in ("blend", "full"): X["le"] = logit(d[engine_col].values)
    if kind == "full":
        for f in FEATS:
            v = d[f].values.astype(float); X[f] = np.nan_to_num(v, nan=np.nanmedian(v) if np.isfinite(np.nanmedian(v)) else 0.0)
            if np.isnan(v).any(): X[f + "_na"] = np.isnan(v).astype(float)
    return X

def boot_ci(stat_fn, n):
    vals = [stat_fn(rng.integers(0, n, n)) for _ in range(B)]
    return np.percentile(vals, 2.5), np.percentile(vals, 97.5)

def weight(y, pm, p, idx=None):
    if idx is not None: y, pm, p = y[idx], pm[idx], p[idx]
    x = p - pm; d = (x * x).sum()
    return (x * (y - pm)).sum() / d if d > 0 else np.nan

TARGETS = [("home", "pe_home", "pm_home"), ("draw", "pe_draw", "pm_draw"), ("away", "pe_away", "pm_away"),
           ("over25", "pe_over25", "pm_over25"), ("btts", "pe_btts", "pm_btts")]
months = sorted(df.month.unique())

print(f"matchs {len(df)}  mois {months}  avec 1X2 {df.pm_home.notna().sum()}  O/U 2.5 {df.pm_over25.notna().sum()}  BTTS {df.pm_btts.notna().sum()}")
print("heures avant coup d'envoi (médiane) par mois :", df.groupby("month").hours_before.median().round(1).to_dict())
print()

summary = []
for name, ecol, mcol in TARGETS:
    d = df[df[mcol].notna() & df[ecol].notna()].reset_index(drop=True)
    y_all = d[f"y_{name}"].values
    print(f"=== {name.upper()}  n={len(d)}  réalisé {y_all.mean():.3f}  marché annoncé {d[mcol].mean():.3f}  moteur annoncé {d[ecol].mean():.3f}")
    bm = ((d[mcol] - y_all) ** 2).mean(); be = ((d[ecol] - y_all) ** 2).mean()
    print(f"   Brier tout l'historique : marché {bm:.4f}  moteur {be:.4f}  (moteur − marché {be-bm:+.4f})")
    preds = {k: np.full(len(d), np.nan) for k in ("mkt_recal", "blend", "full_lr", "full_gb")}
    for i, m in enumerate(months[1:], start=1):
        tr = d[d.month < m]; te_idx = np.where(d.month == m)[0]
        if len(tr) < 300 or len(te_idx) < 100: continue
        te = d.iloc[te_idx]
        for key, kind, model in (("mkt_recal", "market", None), ("blend", "blend", None), ("full_lr", "full", None), ("full_gb", "full", "gb")):
            Xtr, Xte = design(tr, name, ecol, mcol, kind), design(te, name, ecol, mcol, kind)
            Xte = Xte.reindex(columns=Xtr.columns, fill_value=0.0)
            if model == "gb":
                clf = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.04, max_leaf_nodes=15, min_samples_leaf=40,
                                                     l2_regularization=1.0, early_stopping=True, validation_fraction=0.2, random_state=1)
            else:
                clf = make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=2000))
            clf.fit(Xtr, tr[f"y_{name}"].values)
            preds[key][te_idx] = clf.predict_proba(Xte)[:, 1]
    ok = ~np.isnan(preds["full_lr"])
    yt, pmt = y_all[ok], d[mcol].values[ok]; pet = d[ecol].values[ok]
    n = ok.sum(); months_tested = sorted(d.month[ok].unique())
    print(f"   hors échantillon (walk-forward) : n={n}  mois testés {months_tested}")
    bmk = ((pmt - yt) ** 2).mean()
    rows = [("marché", pmt), ("moteur seul", pet)] + [(k, preds[k][ok]) for k in preds]
    for label, p in rows:
        b = ((p - yt) ** 2).mean(); delta = b - bmk
        lo, hi = boot_ci(lambda i: ((p[i] - yt[i]) ** 2).mean() - ((pmt[i] - yt[i]) ** 2).mean(), n)
        w = weight(yt, pmt, p); wlo, whi = boot_ci(lambda i: weight(yt, pmt, p, i), n)
        per_month = " ".join(f"{m}:{(((p - yt) ** 2)[d.month[ok].values == m].mean() - ((pmt - yt) ** 2)[d.month[ok].values == m].mean()):+.4f}" for m in months_tested)
        wtxt = "" if label == "marché" else f"  poids optimal {w:+.2f} [{wlo:+.2f}, {whi:+.2f}]"
        print(f"   {label:<11} Brier {b:.4f}  Δ marché {delta:+.4f} [{lo:+.4f}, {hi:+.4f}]{wtxt}   par mois {per_month}")
        summary.append((name, label, n, delta, lo, hi, w if label != "marché" else np.nan))
    # calibration du marché lui-même (pente de y sur pm, par tranche)
    print()

print("=== Corrélation univariée de chaque feature avec le résidu (réalisé − marché), tout l'historique ===")
print("   |r| > 0.035 ≈ p < 0.01 à n≈6 000. Rien au-delà de 0.05 = aucune feature ne porte un signal exploitable seule.")
for name, ecol, mcol in TARGETS:
    d = df[df[mcol].notna() & df[ecol].notna()]
    r = d[f"y_{name}"].values - d[mcol].values
    out = []
    for f in FEATS + [ecol]:
        v = d[f].values.astype(float); m = np.isfinite(v)
        if m.sum() < 500: continue
        c = np.corrcoef(v[m], r[m])[0, 1]
        out.append((abs(c), f, c, m.sum()))
    out.sort(reverse=True)
    print(f"   {name:<7} " + "  ".join(f"{f}:{c:+.3f}(n={k})" for _, f, c, k in out[:6]))
