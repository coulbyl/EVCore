// Monte Carlo : plafond de réussite d'un coupon à cote ~2 (2 jambes) selon la
// richesse du jour (N candidats), avec et sans erreur d'estimation.
//
//   node cote2-simulate.js
//
// Hypothèses (toutes paramétrées ci-dessous, aucune donnée réelle) :
//  - chaque jambe a une cote tirée dans [1,20 ; 1,65] ;
//  - sa vraie probabilité est 1/cote × (1 − marge), la marge de la cellule
//    (marché × tranche) étant tirée dans {3,0 % ; 4,5 % ; 6,0 %} ;
//  - le compositeur connaît la probabilité à une erreur gaussienne d'écart-type
//    SIGMA près (0 = calibration parfaite ; 0,02 ≈ SE d'une cellule à 500 sél.) ;
//  - il choisit la paire (deux rencontres différentes) de cote combinée dans
//    [1,80 ; 2,30] maximisant la probabilité jointe *estimée* ;
//  - règle d'abstention : il ne publie que si cette estimation ≥ SEUIL.
//
// Sorties : par N, probabilité jointe estimée de la paire retenue, probabilité
// vraie (ce que verrait le joueur), taux de publication avec abstention.

const DAYS = 20000;
const MARGINS = [0.03, 0.045, 0.06];
const TARGET = [1.8, 2.3];
const SEUIL = 0.5;

function randn() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simulate(N, sigma) {
  let sumEst = 0,
    sumTrue = 0,
    sumWin = 0,
    published = 0,
    truePub = 0;
  for (let d = 0; d < DAYS; d++) {
    const legs = [];
    for (let i = 0; i < N; i++) {
      const odds = 1.2 + Math.random() * 0.45;
      const margin = MARGINS[Math.floor(Math.random() * MARGINS.length)];
      const p = (1 / odds) * (1 - margin);
      const est = Math.min(0.99, Math.max(0.01, p + sigma * randn()));
      legs.push({ odds, p, est });
    }
    let best = null;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const o = legs[i].odds * legs[j].odds;
        if (o < TARGET[0] || o > TARGET[1]) continue;
        const est = legs[i].est * legs[j].est;
        if (!best || est > best.est) best = { est, p: legs[i].p * legs[j].p };
      }
    }
    if (!best) continue;
    const won = Math.random() < best.p ? 1 : 0;
    sumEst += best.est;
    sumTrue += best.p;
    sumWin += won;
    if (best.est >= SEUIL) {
      published++;
      truePub += best.p;
    }
  }
  return {
    N,
    sigma,
    estimee: (sumEst / DAYS).toFixed(3),
    vraie: (sumTrue / DAYS).toFixed(3),
    gagne: (sumWin / DAYS).toFixed(3),
    publie_pct: ((published / DAYS) * 100).toFixed(0),
    vraie_si_publie: published ? (truePub / published).toFixed(3) : "—",
  };
}

const rows = [];
for (const sigma of [0, 0.02, 0.04]) {
  for (const N of [6, 12, 25, 50, 100, 150]) rows.push(simulate(N, sigma));
}
console.table(rows);
