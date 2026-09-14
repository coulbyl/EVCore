"""Offline descriptive audit. No database connection or application imports.

Usage: python3 measure.py data/selections.csv.gz data/coupons.csv.gz data/raw.csv.gz
Fixed stake = 1. Day-cluster bootstrap, seed 20260913, 2000 replicates.
Unknown engine versions are explicitly retained as UNVERSIONED, never inferred.
"""
import csv
import gzip
import hashlib
import json
import math
import random
import sys
from collections import defaultdict
from pathlib import Path


def read_csv(path):
    path = Path(path)
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rt') as handle:
        return list(csv.DictReader(handle))


def metrics(rows, bootstrap=False):
    if not rows:
        return {"n": 0}
    n = len(rows)
    profit = sum(r["profit"] for r in rows)
    equity = peak = drawdown = streak = worst_streak = 0
    days = defaultdict(list)
    bins = defaultdict(list)
    for r in sorted(rows, key=lambda r: (r["time"], r["id"])):
        equity += r["profit"]
        peak = max(peak, equity)
        drawdown = max(drawdown, peak - equity)
        streak = streak + 1 if r["profit"] < 0 else 0
        worst_streak = max(worst_streak, streak)
        days[r["day"]].append(r["profit"])
        if r.get("y") is not None:
            bins[min(9, int(r["p"] * 10))].append(r)
    binary = [r for r in rows if r.get("y") is not None]
    curve = [{"bin": k, "n": len(v), "p": sum(r["p"] for r in v)/len(v),
              "observed": sum(r["y"] for r in v)/len(v)} for k, v in sorted(bins.items())]
    out = {"n": n, "binary_n": len(binary), "profit_units": profit, "roi": profit/n,
           "avg_odds": sum(r["odds"] for r in rows)/n,
           "avg_probability": sum(r["p"] for r in rows)/n,
           "avg_implied_probability": sum(1/r["odds"] for r in rows)/n,
           "avg_announced_ev": sum(r["p"]*r["odds"]-1 for r in rows)/n,
           "max_drawdown_units": drawdown, "worst_loss_streak": worst_streak,
           "active_days": len(days), "first_day": min(days), "last_day": max(days),
           "calibration_curve": curve}
    if binary:
        out.update(hit_rate=sum(r["y"] for r in binary)/len(binary),
                   brier=sum((r["p"]-r["y"])**2 for r in binary)/len(binary),
                   ece=sum(b["n"]*abs(b["p"]-b["observed"]) for b in curve)/len(binary))
    if bootstrap and len({r['profit'] for r in rows}) == 1:
        out['bootstrap_uninformative'] = 'Constant observed returns; empirical bootstrap cannot estimate unobserved rare wins.'
    elif bootstrap and len(days) > 1:
        blocks = [(sum(v), len(v)) for v in days.values()]
        rng = random.Random(20260913)
        samples = []
        for _ in range(2000):
            sample = rng.choices(blocks, k=len(blocks))
            samples.append(sum(v[0] for v in sample)/sum(v[1] for v in sample))
        samples.sort()
        out["roi_day_bootstrap_95"] = [samples[49], samples[1949]]
    return out


def grouped(rows, key, bootstrap=False):
    groups = defaultdict(list)
    for r in rows:
        groups[key(r)].append(r)
    return {k: metrics(v, bootstrap) for k, v in sorted(groups.items())}


def main():
    sel_path, coupon_path = map(Path, sys.argv[1:3])
    selections = read_csv(sel_path)
    fixture_status = {r['id']: r['status'] for r in read_csv(sys.argv[3])} if len(sys.argv)>3 else {}
    counts = defaultdict(lambda: defaultdict(int))
    calibration = defaultdict(list)
    rows = []
    for s in selections:
        key = '/'.join((s['source'], s['config_version'], s['channel']))
        counts[key]['latest_decisions'] += 1
        counts[key][s['status']] += 1
        if not s['selection_id']:
            continue
        counts[key]['selections'] += 1
        if s['selection_created_at'] >= s['kickoff']:
            counts[key]['late_selection_excluded'] += 1
            continue
        if fixture_status.get(s['fixture_id']) in ('CANCELLED','POSTPONED'):
            counts[key]['cancelled_or_postponed_excluded'] += 1
            continue
        if s['result'] in ('WON','LOST'):
            calibration[key].append((float(s['probability']), int(s['result']=='WON')))
        if s['result'] not in ('WON', 'LOST', 'VOID'):
            counts[key]['unsettled'] += 1
            continue
        if not s['odds'] or float(s['odds']) <= 1:
            counts[key]['missing_or_invalid_odds'] += 1
            continue
        p, odds = float(s['probability']), float(s['odds'])
        if not 0 <= p <= 1:
            counts[key]['invalid_probability'] += 1
            continue
        void = s['result'] == 'VOID'
        rows.append({'group': key, 'id': s['selection_id'], 'fixture': s['fixture_id'],
                     'day': s['kickoff'][:10], 'time': s['settledAt'] or s['kickoff'],
                     'month': s['kickoff'][:7], 'channel': s['channel'], 'league': s['league'],
                     'p': p, 'odds': odds, 'y': None if void else int(s['result']=='WON'),
                     'profit': 0 if void else odds-1 if s['result']=='WON' else -1,
                     'odds_bucket': '<1.5' if odds<1.5 else '1.5-2' if odds<2 else '2-3' if odds<3 else '3+',
                     'ev_bucket': 'negative' if p*odds<1 else '0-10%' if p*odds<1.1 else '10%+',
                     'market': s['market'], 'pick': s['pick']})
    coupons = read_csv(coupon_path)
    diagnostic_counts = {
        'selected_with_alert':sum(s['status']=='SELECTED' and bool(s['calibration_alert'] or (s['calibration_alert_over_under'] and s['calibration_alert_over_under']!='[]')) for s in selections),
        'pre_coupons_negative_announced_ev':sum(float(c['jointProbability'])*float(c['combinedOdds'])<1 for c in coupons if c['generatedAt']<c['first_kickoff']),
        'llm_coupons_negative_announced_ev':sum(float(c['jointProbability'])*float(c['combinedOdds'])<1 for c in coupons if all('llmReasoning' in (l['feature_keys'] or []) for l in json.loads(c['leg_data']))),
    }
    coupon_rows = []
    coupon_counts = defaultdict(int)
    for c in coupons:
        cohort = 'before_first_kickoff' if c['generatedAt'] < c['first_kickoff'] else 'after_first_kickoff'
        coupon_counts[cohort] += 1
        if c['result'] not in ('WON','LOST','VOID','PARTIAL'):
            coupon_counts[cohort+'_unsettled'] += 1
            continue
        legs=json.loads(c['leg_data'])
        payout = float(c['realizedOdds']) if c['realizedOdds'] else None
        if c['result'] in ('WON','PARTIAL') and payout is None:
            coupon_counts[cohort+'_missing_realized_odds'] += 1
            # Legacy clean wins are reconstructible only when every leg is explicitly won
            # and priced; never silently drop winners from the ROI denominator.
            if c['result']=='WON' and all(l['correct'] is True and l['odds'] is not None for l in legs):
                product=math.prod(float(l['odds']) for l in legs)
                if abs(product-float(c['combinedOdds'])) > 0.001:
                    raise ValueError('Legacy payout differs from leg product')
                payout=float(c['combinedOdds'])
                coupon_counts[cohort+'_payout_reconstructed'] += 1
            else:
                raise ValueError('Uninterpretable payout: ROI must remain unavailable')
        odds, p = float(c['combinedOdds']), float(c['jointProbability'])
        profit = -1 if c['result']=='LOST' else 0 if c['result']=='VOID' else payout-1
        # PARTIAL/VOID have different success events; exclude from binary calibration.
        settled_times=[l['settled_at'] for l in legs if l['settled_at']]
        coupon_rows.append({'id':c['id'],'group':cohort,'day':c['forDate'],'month':c['forDate'][:7],
                            'time':max(settled_times) if settled_times else c['last_kickoff'],
                            'odds':odds,'p':p,'profit':profit,'legs':int(c['legs']),
                            'implementation': 'llm_notes_present' if all('llmReasoning' in (l['feature_keys'] or []) for l in legs) else 'legacy_or_unknown',
                            'y':int(c['result']=='WON') if c['result'] in ('WON','LOST') else None})
    calibration_all = {}
    for key, values in calibration.items():
        bins = defaultdict(list)
        for p,y in values:
            bins[min(9,int(p*10))].append((p,y))
        curve=[{'bin':k,'n':len(v),'p':sum(p for p,y in v)/len(v),'observed':sum(y for p,y in v)/len(v)} for k,v in sorted(bins.items())]
        calibration_all[key]={'n':len(values),'avg_probability':sum(p for p,y in values)/len(values),
                              'hit_rate':sum(y for p,y in values)/len(values),
                              'brier':sum((p-y)**2 for p,y in values)/len(values),
                              'ece':sum(c['n']*abs(c['p']-c['observed']) for c in curve)/len(values),'curve':curve}
    report = {'method':__doc__, 'input_sha256':{Path(p).name:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in sys.argv[1:4]},
              'calibration_including_missing_odds':calibration_all,
              'selection_counts':dict(counts), 'channels':grouped(rows,lambda r:r['group'],True),
              'channel_month':grouped(rows,lambda r:r['group']+'/'+r['month']),
              'channel_league':grouped(rows,lambda r:r['group']+'/'+r['league']),
              'channel_odds':grouped(rows,lambda r:r['group']+'/'+r['odds_bucket']),
              'channel_ev':grouped(rows,lambda r:r['group']+'/'+r['ev_bucket']),
              'coupon_counts':dict(coupon_counts), 'coupons':grouped(coupon_rows,lambda r:r['group'],True),
              'coupon_size':grouped(coupon_rows,lambda r:r['group']+'/'+str(r['legs']),True),
              'coupon_implementation':grouped(coupon_rows,lambda r:r['group']+'/'+r['implementation'],True),
              'coupon_month':grouped(coupon_rows,lambda r:r['group']+'/'+r['month'])}
    out=Path(__file__).parent
    (out/'extra-counts.json').write_text(json.dumps(diagnostic_counts,indent=2)+'\n')
    (out/'metrics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    lines=['Mesures descriptives — versions déterministes inconnues, aucune preuve hors échantillon.',
           'ROI inclut les VOID à profit nul ; calibration exclut les VOID/PARTIAL.\n',
           '| Source / version / canal | N réglés cotés | Réussite | P moyenne | ROI | IC95 jours | Brier | ECE | DD unités |',
           '|---|---:|---:|---:|---:|---|---:|---:|---:|']
    for k,m in report['channels'].items():
        lo,hi=m.get('roi_day_bootstrap_95',[float('nan')]*2)
        lines.append(f"| {k} | {m['n']} | {m.get('hit_rate',0):.1%} | {m['avg_probability']:.1%} | {m['roi']:.1%} | [{lo:.1%}, {hi:.1%}] | {m.get('brier',0):.3f} | {m.get('ece',0):.1%} | {m['max_drawdown_units']:.1f} |")
    lines+=['','Coupons (versions du composeur non identifiées) :']
    for k,m in report['coupon_size'].items():
        lines.append(f"- {k}: n={m['n']}, ROI={m['roi']:.1%}, HR={m.get('hit_rate',0):.1%}, cote={m['avg_odds']:.2f}, DD={m['max_drawdown_units']:.1f} u")
    (out/'metrics.md').write_text('\n'.join(lines)+'\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
