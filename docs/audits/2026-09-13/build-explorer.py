"""Build a standalone, offline calibration explorer from measured aggregates."""
import json
from pathlib import Path

root=Path(__file__).parent
data=json.loads((root/'metrics.json').read_text())
payload=json.dumps({'priced':data['channels'],'all':data['calibration_including_missing_odds']},ensure_ascii=False).replace('<','\\u003c')
html='''<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EVCore — calibration mesurée</title>
<style>
body{font:16px system-ui,sans-serif;color:#142738;background:#f4f6f8;margin:0;padding:24px}
main{max-width:960px;margin:auto}h1{font-size:28px}p{line-height:1.55}label{display:block;font-weight:600;margin:16px 0 6px}
select{width:100%;padding:12px;border:1px solid #66788a;border-radius:6px;font:inherit;background:white;color:inherit}
.box{background:white;border:1px solid #c6d1dc;border-radius:10px;padding:20px;margin-top:20px}
svg{width:100%;max-height:500px}table{width:100%;border-collapse:collapse}td,th{padding:10px;text-align:right;border-bottom:1px solid #dbe2e9}th:first-child,td:first-child{text-align:left}
.stats{display:flex;gap:24px;flex-wrap:wrap}.stats strong{display:block;font-size:24px}small{color:#42576b}a{color:#075eb5}
</style><main><h1>Probabilités annoncées et résultats observés</h1>
<p>Audit de la base Docker locale. Dernière décision enregistrée avant match, par match et canal.
Les versions déterministes sont inconnues : ces résultats descriptifs ne valident pas un modèle.</p>
<label for="scope">Population</label><select id="scope"><option value="priced">Sélections réglées avec cote — ROI et calibration</option><option value="all">Toutes les sélections WON/LOST — calibration seule</option></select>
<label for="channel">Source / version / canal</label><select id="channel"></select>
<section class="box"><div class="stats" id="stats" aria-live="polite"></div>
<svg id="chart" viewBox="0 0 620 490" role="img" aria-labelledby="chart-title chart-desc"></svg>
<p>La diagonale représente une calibration parfaite. Sous la diagonale : probabilités trop élevées. Au-dessus : probabilités trop faibles. Les petits groupes sont très incertains.</p>
<div style="overflow-x:auto"><table><caption>Valeurs exactes des points de calibration</caption><thead><tr><th>Classe</th><th>Observations</th><th>Probabilité moyenne</th><th>Fréquence observée</th></tr></thead><tbody id="bins"></tbody></table></div></section>
<p id="note"></p><p><a href="AUDIT.md">Rapport et limites de la méthode</a> · <a href="metrics.json">Données agrégées</a></p></main>
<script type="application/json" id="data">__DATA__</script>
<script>
const data=JSON.parse(document.getElementById('data').textContent),scope=document.getElementById('scope'),choice=document.getElementById('channel');
const pct=n=>n==null?'Non mesuré':(100*n).toFixed(1)+' %';
function populate(){const old=choice.value;choice.replaceChildren();Object.keys(data[scope.value]).sort().forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;choice.append(o)});if(data[scope.value][old])choice.value=old;render()}
function render(){const m=data[scope.value][choice.value],curve=m.calibration_curve||m.curve||[],ns='http://www.w3.org/2000/svg',svg=document.getElementById('chart');svg.replaceChildren();
function add(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);if(text!=null)e.textContent=text;svg.append(e);return e}
add('title',{id:'chart-title'},'Calibration de '+choice.value);add('desc',{id:'chart-desc'},'Fréquence observée en fonction de la probabilité annoncée. Les valeurs sont disponibles dans le tableau.');
const x=p=>65+p*490,y=p=>425-p*365;
for(let i=0;i<=10;i++){const p=i/10;add('line',{x1:x(p),y1:y(0),x2:x(p),y2:y(1),stroke:'#dbe2e9'});add('line',{x1:x(0),y1:y(p),x2:x(1),y2:y(p),stroke:'#dbe2e9'});if(i%2===0){add('text',{x:x(p),y:450,'text-anchor':'middle',fill:'#142738'},i*10+'%');add('text',{x:53,y:y(p)+5,'text-anchor':'end',fill:'#142738'},i*10+'%')}}
add('line',{x1:x(0),y1:y(0),x2:x(1),y2:y(1),stroke:'#465b70','stroke-dasharray':'6 5','stroke-width':2});
add('polyline',{points:curve.map(b=>x(b.p)+','+y(b.observed)).join(' '),fill:'none',stroke:'#0069ad','stroke-width':3});
for(const b of curve){const c=add('circle',{cx:x(b.p),cy:y(b.observed),r:5+Math.min(7,Math.sqrt(b.n)/8),fill:'#0069ad',stroke:'white','stroke-width':2});const t=document.createElementNS(ns,'title');t.textContent='n='+b.n+', annoncé '+pct(b.p)+', observé '+pct(b.observed);c.append(t)}
add('text',{x:310,y:480,'text-anchor':'middle',fill:'#142738'},'Probabilité annoncée');add('text',{x:65,y:28,fill:'#142738'},'Fréquence observée');
const stats=document.getElementById('stats');stats.replaceChildren();for(const [label,value] of [['Observations',m.n],['Réussite',pct(m.hit_rate)],['ECE',pct(m.ece)],['ROI',pct(m.roi)]]){const box=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=value;small.textContent=label;box.append(strong,small);stats.append(box)}
const body=document.getElementById('bins');body.replaceChildren();for(const b of curve){const tr=document.createElement('tr');for(const value of [b.bin*10+'–'+(b.bin+1)*10+' %',b.n,pct(b.p),pct(b.observed)]){const td=document.createElement('td');td.textContent=value;tr.append(td)}body.append(tr)}
document.getElementById('note').textContent=scope.value==='priced'?'Le volume affiché inclut les remboursements pour le ROI ; la courbe et la réussite excluent les VOID. Les prix ne constituent pas une preuve de placement réel.':'Aucune cote exigée : ne pas interpréter cette population comme une série de paris rentables. Pour DNB, la calibration WON/LOST est conditionnelle à l’absence de nul.'}
scope.addEventListener('change',populate);choice.addEventListener('change',render);populate();
</script></html>'''
(root/'calibration.html').write_text(html.replace('__DATA__',payload))
print('Created calibration.html (standalone, no network dependencies).')
