import json, unicodedata, collections
fx=json.load(open('fixtures-full.json')); odds=json.load(open('scorer-odds-finished.json'))
def norm(s): return unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace('-',' ').replace('.','')
def key(name): t=norm(name).split(); return t[-1] if t else ''
byid={f['fixture']['id']:f for f in fx}
rows=[]; unmatched=0
for o in odds:
    f=byid[o['id']]
    scored=collections.Counter(key(e['player']['name']) for e in f['events'] if e['type']=='Goal' and e['detail'] not in ('Own Goal','Missed Penalty'))
    played={}
    for side in f['players']:
        for p in side['players']:
            s=p['statistics'][0]
            played[key(p['player']['name'])]=(s['games']['minutes'] or 0, s['games']['position'])
    for bk in o['r'][0]['bookmakers']:
        for bet in bk['bets']:
            if bet['id']!=92: continue
            for v in bet['values']:
                k=key(v['value']); od=float(v['odd'])
                if k not in played: unmatched+=1; continue
                mins,pos=played[k]
                rows.append((od, scored[k]>0, mins, pos))
print('matchs', len(odds), 'joueurs cotes apparies', len(rows), 'non apparies', unmatched)
for lo,hi in ((1,2.5),(2.5,4),(4,6),(6,10),(10,100)):
    sub=[r for r in rows if lo<=r[0]<hi]; pl=[r for r in sub if r[2]>0]
    if sub: print(f'cote {lo}-{hi}: cotes n={len(sub)} implied {sum(1/r[0] for r in sub)/len(sub):.3f} realised {sum(r[1] for r in sub)/len(sub):.3f} | ayant joue n={len(pl)} realised {sum(r[1] for r in pl)/max(1,len(pl)):.3f}')
pl=[r for r in rows if r[2]>0]
print('tous cotes: implied', round(sum(1/r[0] for r in rows)/len(rows),3), 'realised', round(sum(r[1] for r in rows)/len(rows),3), '| ayant joue: implied', round(sum(1/r[0] for r in pl)/len(pl),3), 'realised', round(sum(r[1] for r in pl)/len(pl),3), 'n', len(pl))
print('part des cotes sur des joueurs qui ne jouent pas:', round(1-len(pl)/len(rows),3))
