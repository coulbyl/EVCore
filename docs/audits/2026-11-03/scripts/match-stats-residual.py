import csv, sys, math, collections
import numpy as np
D=sys.argv[1]; N=int(sys.argv[2]) if len(sys.argv)>2 else 8
STATS=['shots_on_goal','total_shots','shots_inside_box','corner_kicks','expected_goals','ball_possession','fouls','offsides','yellow_cards']
st=collections.defaultdict(dict)
for r in csv.DictReader(open(f'{D}/stats.csv')):
    st[(r['fixtureId'],r['teamId'])][r['type']]=float(r['value'])
fx=[]
for r in csv.DictReader(open(f'{D}/fixtures.csv')):
    fx.append(r)
fx.sort(key=lambda r:r['scheduledAt'])
hist=collections.defaultdict(list)  # team -> list of dict(for/against)
def fair(*o):
    try: inv=[1/float(x) for x in o]
    except: return None
    s=sum(inv); return [i/s for i in inv]
rows=[]
def roll(team):
    h=hist[team][-N:]
    if len(h)<N: return None
    out={}
    for k in ['gf','ga']+[f'{s}_f' for s in STATS]+[f'{s}_a' for s in STATS]:
        vals=[m[k] for m in h if m.get(k) is not None]
        out[k]=sum(vals)/len(vals) if len(vals)>=N//2 else None
    return out
for r in fx:
    hm,aw=r['homeTeamId'],r['awayTeamId']
    rh,ra=roll(hm),roll(aw)
    hs,as_=int(r['homeScore']),int(r['awayScore'])
    if rh and ra and r['h']:
        p1=fair(r['h'],r['d'],r['a']); po=fair(r['ov'],r['un']) if r['ov'] and r['un'] else None; pb=fair(r['y'],r['n']) if r['y'] and r['n'] else None
        rows.append(dict(t=r['scheduledAt'],comp=r['competitionId'],rh=rh,ra=ra,p1=p1,po=po,pb=pb,
            home=hs>as_,draw=hs==as_,over=hs+as_>2.5,btts=hs>0 and as_>0))
    for team,opp,gf,ga in ((hm,aw,hs,as_),(aw,hm,as_,hs)):
        m={'gf':gf,'ga':ga}
        sf=st.get((r['id'],team),{}); sa=st.get((r['id'],opp),{})
        for s in STATS:
            m[f'{s}_f']=sf.get(s); m[f'{s}_a']=sa.get(s)
        if sf or True: hist[team].append(m)
print('rows with N-match history and Pinnacle 1X2:', len(rows))
def feat(r, kind):
    h,a=r['rh'],r['ra']
    def g(d,k): v=d.get(k); return v
    if kind=='side':
        pairs=[('goals','gf','ga'),('sot','shots_on_goal_f','shots_on_goal_a'),('shots','total_shots_f','total_shots_a'),('box','shots_inside_box_f','shots_inside_box_a'),('corners','corner_kicks_f','corner_kicks_a'),('xg','expected_goals_f','expected_goals_a'),('poss','ball_possession_f','ball_possession_a')]
        out={}
        for name,f,a_ in pairs:
            x=[g(h,f),g(h,a_),g(a,f),g(a,a_)]
            out[name]=None if None in x else (x[0]-x[1])-(x[2]-x[3])
        return out
    else:
        pairs=[('goals','gf','ga'),('sot','shots_on_goal_f','shots_on_goal_a'),('shots','total_shots_f','total_shots_a'),('box','shots_inside_box_f','shots_inside_box_a'),('corners','corner_kicks_f','corner_kicks_a'),('xg','expected_goals_f','expected_goals_a'),('fouls','fouls_f','fouls_a')]
        out={}
        for name,f,a_ in pairs:
            x=[g(h,f),g(h,a_),g(a,f),g(a,a_)]
            out[name]=None if None in x else x[0]+x[1]+x[2]+x[3]
        return out
def logit(p): p=min(max(p,1e-4),1-1e-4); return math.log(p/(1-p))
def fit(X,y,l2=1.0,it=50):
    w=np.zeros(X.shape[1])
    for _ in range(it):
        z=X@w; p=1/(1+np.exp(-z)); W=p*(1-p)
        H=X.T@(X*W[:,None])+l2*np.eye(X.shape[1]); H[0,0]-=l2
        g=X.T@(y-p)-l2*w; g[0]+=l2*w[0]
        w=w+np.linalg.solve(H,g)
    return w
def ll(p,y): p=np.clip(p,1e-6,1-1e-6); return -(y*np.log(p)+(1-y)*np.log(1-p))
SPLIT='2025-07-01'
for target,kind,pk,idx in [('home','side','p1',0),('draw','side','p1',1),('over','total','po',0),('btts','total','pb',0)]:
    data=[]
    for r in rows:
        if r[pk] is None: continue
        f=feat(r,kind)
        data.append((r['t'],r[pk][idx],f,1.0 if r[target] else 0.0))
    for fset in (['goals'],['sot','shots','box','corners'],['xg'],['sot','shots','box','corners','xg','goals']+(['poss'] if kind=='side' else ['fouls'])):
        sub=[(t,p,[f[k] for k in fset],y) for t,p,f,y in data if all(f.get(k) is not None for k in fset)]
        tr=[s for s in sub if s[0]<SPLIT]; te=[s for s in sub if s[0]>=SPLIT]
        if len(tr)<500 or len(te)<300: print(target,fset,'too few',len(tr),len(te)); continue
        Ftr=np.array([s[2] for s in tr]); mu=Ftr.mean(0); sd=Ftr.std(0)+1e-9
        def mat(S,with_f):
            base=np.array([[1.0,logit(s[1])] for s in S])
            if not with_f: return base
            return np.hstack([base,(np.array([s[2] for s in S])-mu)/sd])
        ytr=np.array([s[3] for s in tr]); yte=np.array([s[3] for s in te])
        w0=fit(mat(tr,False),ytr); w1=fit(mat(tr,True),ytr)
        p_m=np.array([s[1] for s in te])
        p0=1/(1+np.exp(-(mat(te,False)@w0))); p1=1/(1+np.exp(-(mat(te,True)@w1)))
        d=ll(p0,yte)-ll(p1,yte)  # >0 = features help
        dm=ll(p_m,yte)-ll(p1,yte)
        se=d.std()/math.sqrt(len(d))
        bri0=np.mean((p0-yte)**2); bri1=np.mean((p1-yte)**2)
        coefs=' '.join(f'{k}={c:+.3f}' for k,c in zip(fset,w1[2:]))
        print(f"{target:5s} {'+'.join(fset):38s} train={len(tr):5d} test={len(te):5d} logloss gain vs recalibrated market {d.mean()*1000:+.2f}±{1.96*se*1000:.2f} (‰) vs raw market {dm.mean()*1000:+.2f}‰ brier {bri0:.5f}->{bri1:.5f} | {coefs}")
