"""Descriptive comparisons only: no fitted rule, no untouched final test.
Usage: python3 compare.py /tmp/evcore-audit-raw.csv /tmp/evcore-audit-daily.csv
"""
import csv
import datetime as dt
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path
from measure import metrics, grouped, read_csv

out = Path(__file__).parent
raw = read_csv(sys.argv[1])
fixture_status = {r['id']:r['status'] for r in raw}
raw_groups = defaultdict(list)
excluded = Counter()
for r in raw:
    p = json.loads(r['probabilities']) if r['probabilities'] else None
    if r['status'] != 'FINISHED' or not r['homeScore'] or not r['awayScore']:
        excluded['not_finished_or_missing_score'] += 1
        continue
    if not isinstance(p, dict) or any(p.get(k) is None for k in ('home','draw','away')):
        excluded['missing_probabilities'] += 1
        continue
    if not r['homeOdds']:
        excluded['no_complete_odds_recorded_before_analysis'] += 1
        continue
    ps = [p[k] for k in ('home','draw','away')]
    odds = [float(r[k]) for k in ('homeOdds','drawOdds','awayOdds')]
    inv = [1/o for o in odds]
    fair = [v/sum(inv) for v in inv]
    h,a = int(r['homeScore']),int(r['awayScore'])
    y = 0 if h>a else 1 if h==a else 2
    favorite = min(range(3), key=lambda i:odds[i])
    model_pick = max(range(3), key=lambda i:ps[i])
    raw_groups[r['source'] or 'UNKNOWN'].append({
        'model_brier':sum((ps[i]-int(y==i))**2 for i in range(3)),
        'market_brier':sum((fair[i]-int(y==i))**2 for i in range(3)),
        'bookmaker_margin':sum(inv)-1,
        'bookmaker_favorite_roi':odds[favorite]-1 if favorite==y else -1,
        'model_favorite_roi':odds[model_pick]-1 if model_pick==y else -1,
        'probability_sum_error':abs(sum(ps)-1),
        'odds_age_hours':(dt.datetime.fromisoformat(r['analyzedAt'])-dt.datetime.fromisoformat(r['snapshotAt'])).total_seconds()/3600})
raw_result = {k:{'n':len(v),**{f:sum(r[f] for r in v)/len(v) for f in v[0]}} for k,v in raw_groups.items()}
(out/'raw-metrics.json').write_text(json.dumps({'excluded':dict(excluded),'groups':raw_result},indent=2)+'\n')
print('RAW 1X2:',json.dumps(raw_result,indent=2))

# Last decision known at day-start; decision chosen before filtering SELECTED.
# Keep unresolved candidates in ranking, then omit the entire unresolved portfolio.
daily = read_csv(sys.argv[2])
days = defaultdict(list)
excluded_channels = {'VALUE','SAFE','CONSENSUS','AVOID','VANTAGE'}
for r in daily:
    if r['source'] != 'POISSON_MAIN' or r['channel'] in excluded_channels:
        continue
    day = r['kickoff'][:10]
    if day > '2026-09-13':
        continue
    days[day]  # Include known zero-pick days in publication denominator.
    if r['status']!='SELECTED' or not r['odds'] or not r['selection_id']:
        continue
    if r['selection_created_at'] >= day+' 00:00:00':
        continue
    p,odds = float(r['probability']),float(r['odds'])
    if odds<=1 or not 0<=p<=1:
        continue
    days[day].append({**r,'p':p,'o':odds,'edge':p-1/odds})

policies = {'probability':(lambda r:r['p'], None, False),
            'ev_positive':(lambda r:r['p']*r['o']-1, 0, False),
            'edge_5pp':(lambda r:r['edge'], .05, False),
            'edge_5pp_diversified':(lambda r:r['edge'], .05, True)}
portfolios = []
counters = Counter()
for name,(ranking,edge_floor,diversify) in policies.items():
    for n in range(1,6):
        policy = f'{name}/{n}'
        for day,candidates in sorted(days.items()):
            counters[policy+'/eligible_days'] += 1
            selected=[]
            fixture_ids=set()
            channel_markets=set()
            league_counts=Counter()
            for c in sorted(candidates,key=lambda c:(-ranking(c),c['fixture_id'],c['channel'],c['pick'])):
                if edge_floor is not None and c['edge']<=edge_floor:
                    continue
                if c['fixture_id'] in fixture_ids:
                    continue
                cm=(c['channel'],c['market'])
                if diversify and (cm in channel_markets or league_counts[c['league']]>=2):
                    continue
                selected.append(c)
                fixture_ids.add(c['fixture_id']);channel_markets.add(cm);league_counts[c['league']]+=1
                if len(selected)==n:
                    break
            if len(selected)<n:
                counters[policy+'/no_coupon']+=1
                continue
            # Do not remove cancelled matches from the decision-time pool (survivorship).
            # Apply their refund only after the portfolio has been chosen.
            selected=[{**c,'result':'VOID'} if fixture_status.get(c['fixture_id']) in ('CANCELLED','POSTPONED') else c for c in selected]
            if any(c['result'] not in ('WON','LOST','VOID') for c in selected):
                counters[policy+'/unresolved']+=1
                continue
            odds=math.prod(c['o'] for c in selected)
            surviving=[c for c in selected if c['result']!='VOID']
            won=all(c['result']=='WON' for c in surviving)
            profit=math.prod(c['o'] for c in surviving)-1 if won else -1
            portfolios.append({'id':policy+'/'+day,'group':policy,'day':day,'month':day[:7],
                               'time':max(c['settledAt'] or c['kickoff'] for c in selected),
                               'odds':odds,'p':math.prod(c['p'] for c in selected),'profit':profit,
                               'y':int(won) if len(surviving)==len(selected) else None})
result={'warning':'Descriptive fixed policies, mixed unknown engine versions; stored odds lack snapshot linkage. Not a replay of current LLM and not OOS validation.',
        'counters':dict(counters),'policies':grouped(portfolios,lambda r:r['group'],True),
        'monthly':grouped(portfolios,lambda r:r['group']+'/'+r['month']),
        'validated_channels_policy':'No channel currently proven on untouched versioned test; no betting, profit=0, ROI undefined (zero stakes).'}
(out/'policy-metrics.json').write_text(json.dumps(result,indent=2)+'\n')
lines=['Comparaisons descriptives à minuit UTC — aucun réglage appris, aucune validation finale indépendante.',
       'Probabilités/cotes archivées ; exclut VALUE, SAFE, CONSENSUS, AVOID, VANTAGE du vivier ; 1 match maximum par coupon.',
       '| Politique / jambes | Coupons réglés | ROI | IC95 jours | DD unités | Jours sans coupon |',
       '|---|---:|---:|---|---:|---:|']
for k,m in result['policies'].items():
    interval=m.get('roi_day_bootstrap_95')
    label=f'[{interval[0]:.1%}, {interval[1]:.1%}]' if interval else 'Non estimable (rendements constants)'
    lines.append(f"| {k} | {m['n']} | {m['roi']:.1%} | {label} | {m['max_drawdown_units']:.1f} | {counters[k+'/no_coupon']} |")
(out/'policy-metrics.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines))
