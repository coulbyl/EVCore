import json, collections, statistics as st
fx=json.load(open('fixtures-full.json')); odds=json.load(open('scorer-odds-finished.json'))
print('matches', len(fx), 'leagues', collections.Counter(f['league']['name'] for f in fx).most_common(12))
# --- goals & minutes
goals=[]; first_goal_min=[]; cards_min=[]; first_card_team=collections.Counter(); n_goals=[]
state_at=collections.defaultdict(collections.Counter)  # minute -> 'H'/'D'/'A'
for f in fx:
    ev=[e for e in f['events'] if e['type']=='Goal' and e['detail']!='Missed Penalty']
    cards=[e for e in f['events'] if e['type']=='Card']
    hid=f['teams']['home']['id']
    gm=sorted(((e['time']['elapsed']+(e['time']['extra'] or 0)*0.01, i, e) for i,e in enumerate(ev)), key=lambda x:(x[0],x[1])); gm=[(m,e) for m,_,e in gm]
    n_goals.append(len(ev))
    if gm: first_goal_min.append(gm[0][0])
    for m,e in gm: goals.append(e)
    cm=sorted(e['time']['elapsed'] for e in cards)
    if cm: cards_min.append(cm[0]); 
    if cards:
        c0=min(cards,key=lambda e:e['time']['elapsed']); first_card_team['home' if c0['team']['id']==hid else 'away']+=1
    for t in (10,15,30,45,60,75):
        h=sum(1 for m,e in gm if m<=t+0.5 and e['team']['id']==hid); a=sum(1 for m,e in gm if m<=t+0.5 and e['team']['id']!=hid)
        state_at[t]['H' if h>a else 'A' if a>h else 'D']+=1
N=len(fx)
print('\n== Buts')
print('buts/match', round(sum(n_goals)/N,2), '0 but', round(sum(1 for g in n_goals if g==0)/N,3), 'penalty', round(sum(1 for e in goals if e['detail']=='Penalty')/len(goals),3), 'own goal', round(sum(1 for e in goals if e['detail']=='Own Goal')/len(goals),3))
print('1er but <= 15 min', round(sum(1 for m in first_goal_min if m<=15)/N,3), '<=30', round(sum(1 for m in first_goal_min if m<=30)/N,3), 'avant MT', round(sum(1 for m in first_goal_min if m<=45.99)/N,3), 'jamais', round(1-len(first_goal_min)/N,3))
for t in (10,15,30,60,75): c=state_at[t]; print(f'1X2 a {t} min: H {c["H"]/N:.3f} D {c["D"]/N:.3f} A {c["A"]/N:.3f}')
print('1er carton <= 30 min', round(sum(1 for m in cards_min if m<=30)/N,3), 'aucun carton', round(1-len(cards_min)/N,3), 'premier carton', dict(first_card_team))
# --- scorers
by_player=collections.Counter(); starters=0; scored_starters=0; per_match_scorers=[]
for f in fx:
    scorers=set()
    for e in f['events']:
        if e['type']=='Goal' and e['detail'] not in ('Own Goal','Missed Penalty') and e['player']['id']: by_player[(e['player']['id'],e['player']['name'])]+=1; scorers.add(e['player']['id'])
    per_match_scorers.append(len(scorers))
    for side in f['players']:
        for p in side['players']:
            s=p['statistics'][0]
            if s['games']['minutes'] and not s['games']['substitute']:
                starters+=1; scored_starters+= 1 if (s['goals']['total'] or 0)>0 else 0
print('\n== Buteurs')
print('buteurs distincts/match', round(sum(per_match_scorers)/N,2), 'titulaires ayant marque', round(scored_starters/starters,3), f'({scored_starters}/{starters})')
tot=sum(by_player.values()); top=by_player.most_common(10)
print('top10 joueurs', [(n,c) for (i,n),c in top], 'part des 10 premiers', round(sum(c for _,c in top)/tot,3))
# position-level scoring rates (starters)
pos=collections.defaultdict(lambda:[0,0]); shots=collections.defaultdict(list)
for f in fx:
    for side in f['players']:
        for p in side['players']:
            s=p['statistics'][0]
            if not s['games']['minutes'] or s['games']['substitute']: continue
            P=s['games']['position']; pos[P][0]+=1; pos[P][1]+= 1 if (s['goals']['total'] or 0)>0 else 0
            shots[P].append((s['shots']['total'] or 0, s['shots']['on'] or 0))
for P,(n,k) in pos.items(): 
    sh=shots[P]; print(f'poste {P}: titulaires {n}, marque {k/n:.3f}, tirs moy {sum(a for a,_ in sh)/len(sh):.2f}, >=1 tir {sum(1 for a,_ in sh if a>=1)/len(sh):.3f}, >=1 cadre {sum(1 for _,b in sh if b>=1)/len(sh):.3f}, >=2 tirs {sum(1 for a,_ in sh if a>=2)/len(sh):.3f}')
# --- scorer odds calibration (Bet365 anytime scorer still served on finished fixtures)
print('\n== Calibration buteur (Bet365, matchs finis encore cotes)')
byid={f['fixture']['id']:f for f in fx}
rows=[]
for o in odds:
    f=byid.get(o['id']); 
    if not f: continue
    scored=set(e['player']['name'] for e in f['events'] if e['type']=='Goal' and e['detail'] not in ('Own Goal','Missed Penalty'))
    played=set(p['player']['name'] for side in f['players'] for p in side['players'] if p['statistics'][0]['games']['minutes'])
    for bk in o['r'][0]['bookmakers']:
        for bet in bk['bets']:
            if bet['id']!=92: continue
            for v in bet['values']:
                name=v['value']; od=float(v['odd'])
                rows.append((od, name in scored, name in played))
print('joueurs cotes', len(rows), 'dont ayant joue', sum(1 for r in rows if r[2]))
for lo,hi in ((1,2.5),(2.5,4),(4,6),(6,10),(10,100)):
    sub=[r for r in rows if lo<=r[0]<hi]
    if sub: print(f'cote {lo}-{hi}: n={len(sub)} implied {sum(1/r[0] for r in sub)/len(sub):.3f} realised {sum(r[1] for r in sub)/len(sub):.3f} (joue: {sum(r[1] for r in sub if r[2])/max(1,sum(1 for r in sub if r[2])):.3f} sur {sum(1 for r in sub if r[2])})')
tot_imp=sum(1/r[0] for r in rows); print('somme des implicites par match', round(tot_imp/len(odds),2), 'buteurs distincts reels par match (ces matchs)', round(sum(len(set(e['player']['name'] for e in byid[o['id']]['events'] if e['type']=='Goal' and e['detail'] not in ('Own Goal','Missed Penalty'))) for o in odds)/len(odds),2))
