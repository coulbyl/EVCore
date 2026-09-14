"""Focused checks for the audit's payout, calibration and population accounting."""
import json
from pathlib import Path
from measure import metrics, read_csv

root=Path(__file__).parent
sample=[{'id':str(i),'time':str(i),'day':str(i),'profit':profit,'odds':odds,'p':.5,'y':y}
        for i,(profit,odds,y) in enumerate([(1,2,1),(-1,2,0),(0,2,None)])]
m=metrics(sample)
assert m['roi']==0 and m['profit_units']==0 and m['max_drawdown_units']==1
assert m['binary_n']==2 and m['brier']==.25 and m['ece']==0
assert metrics([])=={'n':0}
assert 'bootstrap_uninformative' in metrics([dict(r,profit=-1) for r in sample],True)
report=json.loads((root/'metrics.json').read_text())
coupons=read_csv(root/'data/coupons.csv.gz')
assert sum(v['n'] for v in report['coupons'].values())==len(coupons)
assert sum(v['n'] for v in report['coupon_size'].values())==len(coupons)
assert sum(v['n'] for v in report['coupon_implementation'].values())==len(coupons)
assert report['coupon_counts']['before_first_kickoff_payout_reconstructed']==18
assert report['coupon_counts']['after_first_kickoff_payout_reconstructed']==102
assert abs(report['coupons']['before_first_kickoff']['profit_units']+37.109)<1e-8
assert all('/UNVERSIONED/' in k or '/vantage-' in k for k in report['channels'])
assert all(v['binary_n']<=v['n'] for v in report['channels'].values())
print('Audit checks passed: fixed stake, refunds, Brier/ECE, drawdown, no dropped winners, cohort totals.')
