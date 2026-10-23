(() => {
const D = window.__d; const days = Object.keys(D).sort();
const META = new Set(['CONSENSUS','CONTRARIAN','AVOID']);
const EXCL = new Set(['VANTAGE','VALUE','SAFE']);
const cal = new Map((window.__cal||[]).map(r => [r.channel+'|'+r.competitionCode, r.status]));
const fx = new Map();
const prim = [], allSel = [], vant = [], reasons = {}, perDay = {};
for (const d of days) {
  const pd = perDay[d] = {fix:0, primary:0, rejected:0, selectedDec:0, alertFix:0, avoidFix:0, unsettledFinished:0};
  for (const g of D[d].m) {
    pd.fix++;
    const alert = g.decisions.some(x => x.calibrationAlert);
    const avoidDec = g.decisions.find(x => x.channel === 'AVOID');
    const avoid = !!(avoidDec && avoidDec.status === 'SELECTED');
    if (alert) pd.alertFix++; if (avoid) pd.avoidFix++;
    fx.set(g.fixtureId, {d, comp:g.competition, alert, avoid, status:g.fixtureStatus});
    for (const x of g.decisions) {
      if (x.status === 'REJECTED') { pd.rejected++; reasons[x.reasonCode||'null'] = (reasons[x.reasonCode||'null']||0)+1; }
      if (x.status === 'SELECTED') pd.selectedDec++;
      const s = x.selections[0];
      if (!s) continue;
      if (g.fixtureStatus === 'FINISHED' && s.result === null && x.status === 'SELECTED' && !META.has(x.channel)) pd.unsettledFinished++;
      const row = {d, fid:g.fixtureId, comp:g.competition, ch:x.channel, st:x.status, mk:s.market, pk:s.pick, p:s.probability, o:s.odds, pl:s.playableOdds, r:s.result, clv:s.closingLineValue, co:s.closingOdds, alert, avoid, imp:s.impliedProbability};
      if (x.channel === 'VANTAGE' && x.status === 'SELECTED') vant.push(row);
      if (!META.has(x.channel) && !EXCL.has(x.channel) && x.status === 'SELECTED') allSel.push(row);
    }
    // replicate primaryPick
    const picks = g.decisions.filter(x => !META.has(x.channel) && !EXCL.has(x.channel) && x.status === 'SELECTED' && x.selections.length > 0);
    if (!picks.length) continue;
    const tier = x => { const st = cal.get(x.channel+'|'+g.competition); const o = x.selections[0].odds; const playable = o !== null && o >= 1.2; const cheap = playable && o < 1.5;
      if (st === 'GREEN' && cheap) return 0; if (st !== 'RED' && cheap) return 1; if (st === 'GREEN' && playable) return 2; if (st !== 'RED' && playable) return 3; return 4; };
    const best = picks.slice().sort((a,b) => tier(a)-tier(b) || (b.selections[0].probability - a.selections[0].probability))[0];
    const s = best.selections[0];
    pd.primary++;
    prim.push({d, fid:g.fixtureId, comp:g.competition, ch:best.channel, mk:s.market, pk:s.pick, p:s.probability, o:s.odds, pl:s.playableOdds, r:s.result, clv:s.closingLineValue, co:s.closingOdds, alert, avoid, tier:tier(best), calst:cal.get(best.channel+'|'+g.competition)||'NONE'});
  }
}
// coupons
const legKey = l => l.fixtureId+'|'+l.market+'|'+l.pick;
const couponLegKeys = new Set(), couponFix = new Set();
const coupons = [];
for (const d of days) for (const c of D[d].c) {
  let play = 1, playOk = true, w=0, l=0, v=0, flagged=0, minPlay=99;
  for (const leg of c.legs) {
    couponLegKeys.add(legKey(leg)); couponFix.add(leg.fixtureId);
    const po = leg.playableOdds ?? leg.oddsSnapshot; if (po == null) playOk = false; else { play *= po; minPlay = Math.min(minPlay, po); }
    if (leg.isCorrect === true) w++; else if (leg.isCorrect === false) l++;
    const fi = fx.get(leg.fixtureId); if (fi && (fi.alert || fi.avoid)) flagged++;
  }
  coupons.push([d, c.couponClass, c.source, c.batch, c.status, c.result, +c.combinedOdds.toFixed(2), c.realizedOdds?+c.realizedOdds.toFixed(2):null, +c.jointProbability.toFixed(3), playOk?+play.toFixed(2):null, c.legs.length, w, l, flagged, minPlay===99?null:minPlay, c.playerCount, c.viewerCount]);
}
for (const r of prim) r.inC = couponLegKeys.has(r.fid+'|'+r.mk+'|'+r.pk) ? 1 : (couponFix.has(r.fid) ? 2 : 0);
for (const r of allSel) r.inC = couponLegKeys.has(r.fid+'|'+r.mk+'|'+r.pk) ? 1 : 0;
const agg = rows => { const s = rows.filter(r => r.r === 'WON' || r.r === 'LOST'); const won = s.filter(r => r.r === 'WON');
  const prof = (k) => { const ss = s.filter(r => (k==='pl' ? (r.pl ?? r.o) : r.o) != null); return ss.length ? +(ss.reduce((a,r)=> a + (r.r==='WON' ? ((k==='pl'?(r.pl??r.o):r.o)-1) : -1),0)/ss.length*100).toFixed(1) : null; };
  const clvs = s.filter(r=>r.clv!=null);
  return {n:rows.length, s:s.length, w:won.length, hit:s.length?+(won.length/s.length*100).toFixed(1):null, pAnn:s.length?+(s.reduce((a,r)=>a+r.p,0)/s.length*100).toFixed(1):null,
    oMean:s.length?+(s.filter(r=>r.o!=null).reduce((a,r)=>a+r.o,0)/Math.max(1,s.filter(r=>r.o!=null).length)).toFixed(2):null, roiO:prof('o'), roiP:prof('pl'), clv:clvs.length?+(clvs.reduce((a,r)=>a+r.clv,0)/clvs.length*100).toFixed(2):null, noOdds:rows.filter(r=>r.o==null).length}; };
const by = (rows, fn) => { const m = {}; for (const r of rows) { const k = fn(r); (m[k] = m[k] || []).push(r); } return Object.fromEntries(Object.entries(m).map(([k,v]) => [k, agg(v)])); };
const band = o => o==null?'none':o<1.2?'a<1.20':o<1.35?'b1.20-1.35':o<1.5?'c1.35-1.50':o<1.8?'d1.50-1.80':o<2.5?'e1.80-2.50':'f>2.50';
window.__res = {
  coupons,
  perDay,
  reasons,
  primAll: agg(prim),
  primByDay: by(prim, r => r.d),
  primByBand: by(prim, r => band(r.o)),
  primByMarket: by(prim, r => r.mk),
  primByChannel: by(prim, r => r.ch),
  primByAlert: by(prim, r => (r.alert?'alert':'')+(r.avoid?'avoid':'')||'clean'),
  primByCal: by(prim, r => r.calst),
  primByInCoupon: by(prim, r => ['hors coupon','dans coupon','match en coupon autre pick'][r.inC]),
  primByPlayGap: by(prim.filter(r=>r.pl!=null&&r.o!=null), r => r.pl/r.o < 0.95 ? 'gap>5%' : 'gap<=5%'),
  selAll: agg(allSel),
  selByBand: by(allSel, r => band(r.o)),
  selByMarket: by(allSel, r => r.mk),
  selByChannel: by(allSel, r => r.ch),
  selByClv: by(allSel.filter(r=>r.clv!=null), r => r.clv > 0.02 ? 'clv>+2%' : r.clv > 0 ? 'clv0..2%' : r.clv > -0.02 ? 'clv-2..0%' : 'clv<-2%'),
  selByAlert: by(allSel, r => (r.alert?'alert':'')+(r.avoid?'avoid':'')||'clean'),
  selByProb: by(allSel, r => 'p'+Math.min(9,Math.floor(r.p*10))),
  selByInCoupon: by(allSel, r => r.inC ? 'in' : 'out'),
  vant: agg(vant), vantByBand: by(vant, r => band(r.o)),
};
window.__rows = {prim, allSel, vant};
window.__out = JSON.stringify(window.__res);
return window.__out.length + ' chars; prim=' + prim.length + ' sel=' + allSel.length + ' coupons=' + coupons.length + ' vant=' + vant.length;
})()
