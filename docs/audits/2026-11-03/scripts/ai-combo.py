import csv, math, collections, sys
rows=[r for r in csv.DictReader(open(sys.argv[1])) if r['result'] in ('WON','LOST') and r['odds']]
for r in rows:
    r['o']=float(r['odds']); r['p']=float(r['probability']); r['m']=float(r['marginPaid']) if r['marginPaid'] else None
    r['day']=r['scheduledAt'][:10]; r['won']=r['result']=='WON'
print('settled plays', len(rows), 'from', min(r['day'] for r in rows), 'to', max(r['day'] for r in rows))
def band(lo,hi,rs):
    s=[r for r in rs if lo<=r['o']<hi]
    if not s: return None
    n=len(s); w=sum(r['won'] for r in s); ann=sum(r['p'] for r in s); imp=sum(1/r['o'] for r in s)
    roi=sum((r['o']-1) if r['won'] else -1 for r in s)/n
    se=math.sqrt((w/n)*(1-w/n)/n)
    return f"n={n:4d} realised={w/n:.3f}±{1.96*se:.3f} announced={ann/n:.3f} implied={imp/n:.3f} ratio={w/ann:.3f} flat={roi:+.3f}"
for v in sorted(set(r['configVersion'] for r in rows)):
    vs=[r for r in rows if r['configVersion']==v]
    print('\n',v)
    for lo,hi in [(1.2,1.45),(1.45,1.8),(1.8,9)]:
        print(f"  {lo}-{hi}", band(lo,hi,vs))
recent=[r for r in rows if r['configVersion'] in ('vantage-v4-gated','vantage-v5-no-tension')]
def combos(rs, lo, hi, key, target=(4,10), maxlegs=4):
    byday=collections.defaultdict(list)
    for r in rs:
        if lo<=r['o']<hi: byday[r['day']].append(r)
    days=sorted(set(r['day'] for r in rs))
    out=[]
    for d in days:
        cands=sorted(byday.get(d,[]), key=key)
        legs=[]; prod=1.0; comps=set()
        for c in cands:
            if c['competitionId'] in comps: continue
            if prod*c['o']>target[1]: continue
            legs.append(c); prod*=c['o']; comps.add(c['competitionId'])
            if prod>=target[0] or len(legs)>=maxlegs: break
        if prod>=target[0] and len(legs)<=maxlegs: out.append((d,legs,prod))
    return days,out
def report(name, rs, lo, hi, key, maxlegs=4):
    days,out=combos(rs,lo,hi,key,maxlegs=maxlegs)
    if not out: print(name,'none'); return
    won=[all(l['won'] for l in legs) for _,legs,_ in out]
    ret=sum(p if w else 0 for (_,_,p),w in zip(out,won))/len(out)
    nlegs=sum(len(l) for _,l,_ in out)/len(out); avg=sum(p for *_,p in out)/len(out)
    exp=sum(math.prod(l2['p'] for l2 in l) for _,l,_ in out)/len(out)
    legs=[l for _,ls,_ in out for l in ls]; w=sum(l['won'] for l in legs); ann=sum(l['p'] for l in legs)
    # worst losing streak
    streak=best=0
    for x in won:
        streak=0 if x else streak+1; best=max(best,streak)
    print(f"{name}: {len(out)}/{len(days)} days, {nlegs:.1f} legs @ {avg:.2f}, won {sum(won)} ({sum(won)/len(out):.1%}), announced joint {exp:.1%}, legs realised/announced {w/ann:.3f} (n={len(legs)}), return/unit {ret:.2f}, worst streak {best}")
print()
for name,lo,hi,key in [
  ('R1 1.45-1.80 cheapest margin', 1.45,1.80, lambda r:(r['m'] if r['m'] is not None else 1, -r['p'])),
  ('R2 1.45-1.80 most probable', 1.45,1.80, lambda r:-r['p']),
  ('R3 1.20-1.80 cheapest margin', 1.20,1.80, lambda r:(r['m'] if r['m'] is not None else 1, -r['p'])),
  ('R4 1.20-1.80 longest first', 1.20,1.80, lambda r:-r['o']),
]:
    report(name, recent, lo, hi, key)
    report(name+' [v3+]', rows, lo, hi, key)
