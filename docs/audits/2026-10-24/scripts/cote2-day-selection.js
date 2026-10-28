// Coupon cote 2 : la richesse du jour prédit-elle le gain ? (lecture seule)
//
// Usage : PGURL='postgres://postgres:postgres@127.0.0.1:5432/evcore' \
//         REPO=/home/fannancoulibaly/lab/EVCore node day-selection.js [jours=120]
//
// Pour chaque jour (UTC) : vivier = sélections SELECTED des canaux non méta,
// hors VALUE/SAFE/VANTAGE, dernière analyse d'avant coup d'envoi, cote 1,20–1,65,
// réglées WON/LOST, une jambe par rencontre (la plus courte). Trois compositeurs
// de paire (2 rencontres différentes, cote combinée 1,80–2,30) :
//   A. « la plus probable » selon le moteur (probabilité annoncée) ;
//   B. « la plus probable » selon la cellule (marché × tranche de cote), taux
//      de réussite réalisé sur les jours PRÉCÉDANT le jour composé (≥ 50 jambes) ;
//   C. « la moins chère » : marge payée la plus basse (marginPaid, depuis 10-11).
// Sorties : réussite par compositeur, par tercile de richesse (nombre de
// rencontres du vivier), et règle d'abstention « publier si proba B ≥ seuil »,
// évaluée mois par mois.

const path = require("path");
const { Client } = require(require.resolve("pg", {
  paths: [path.join(process.env.REPO || process.cwd(), "node_modules/.pnpm/node_modules")],
}));

const DAYS = Number(process.argv[2] ?? 120);
const BAND = [1.2, 1.65];
const TARGET = [1.8, 2.3];
const META = ["CONSENSUS", "CONTRARIAN", "AVOID", "VALUE", "SAFE", "VANTAGE"];

const SQL = `
SELECT DISTINCT ON (cd.channel, mr."fixtureId", cs.market, cs.pick)
  (f."scheduledAt" AT TIME ZONE 'UTC')::date AS day,
  mr."fixtureId" AS fid,
  c.code AS comp,
  cd.channel::text AS channel, cs.market::text AS market, cs.pick,
  cs.probability::float AS p, cs.odds::float AS odds,
  cs."marginPaid"::float AS margin, cs.result::text AS result
FROM channel_selection cs
JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
JOIN model_run mr ON mr.id = cd."modelRunId"
JOIN fixture f ON f.id = mr."fixtureId"
JOIN season s ON s.id = f."seasonId"
JOIN competition c ON c.id = s."competitionId"
WHERE mr."analyzedAt" < f."scheduledAt"
  AND cd.status = 'SELECTED'
  AND cd.channel::text <> ALL($1)
  AND cs.result IN ('WON','LOST')
  AND cs.odds BETWEEN $2 AND $3
  AND f."scheduledAt" >= now() - ($4 || ' days')::interval
ORDER BY cd.channel, mr."fixtureId", cs.market, cs.pick, mr."analyzedAt" DESC, cs.id DESC`;

const band = (o) => (o < 1.35 ? "a" : o < 1.5 ? "b" : "c");
const cellKey = (r) => `${r.market}|${band(r.odds)}`;

function bestPair(rows, score) {
  let best = null;
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.fid === b.fid) continue;
      const o = a.odds * b.odds;
      if (o < TARGET[0] || o > TARGET[1]) continue;
      const s = score(a, b);
      if (s === null) continue;
      if (!best || s > best.s) best = { s, a, b, won: a.result === "WON" && b.result === "WON" };
    }
  return best;
}

(async () => {
  const client = new Client({ connectionString: process.env.PGURL });
  await client.connect();
  const { rows } = await client.query(SQL, [META, BAND[0], BAND[1], String(DAYS + 90)]);
  await client.end();

  const byDay = new Map();
  for (const r of rows) {
    r.day = r.day.toISOString().slice(0, 10);
    const d = byDay.get(r.day) ?? new Map();
    const held = d.get(r.fid);
    if (!held || r.odds < held.odds) d.set(r.fid, r);
    byDay.set(r.day, d);
  }
  const days = [...byDay.keys()].sort();
  const cutoff = days[Math.max(0, days.length - 1 - DAYS)];

  const cellHist = new Map();
  const cellRate = (key, day) => {
    const h = (cellHist.get(key) ?? []).filter((x) => x.day < day);
    if (h.length < 50) return null;
    return h.filter((x) => x.won).length / h.length;
  };

  const out = [];
  for (const day of days) {
    const pool = [...byDay.get(day).values()];
    if (day >= cutoff) {
      const A = bestPair(pool, (a, b) => a.p * b.p);
      const B = bestPair(pool, (a, b) => {
        const ra = cellRate(cellKey(a), day), rb = cellRate(cellKey(b), day);
        return ra === null || rb === null ? null : ra * rb;
      });
      const C = bestPair(pool, (a, b) =>
        a.margin == null || b.margin == null ? null : -(a.margin + b.margin));
      out.push({ day, month: day.slice(0, 7), n: pool.length, comps: new Set(pool.map((r) => r.comp)).size, A, B, C });
    }
    for (const r of pool) {
      const k = cellKey(r);
      cellHist.set(k, [...(cellHist.get(k) ?? []), { day, won: r.result === "WON" }]);
    }
  }

  const pct = (x) => (x * 100).toFixed(1) + " %";
  const summary = (label, rows, pick) => {
    const s = rows.map(pick).filter(Boolean);
    const w = s.filter((x) => x.won).length;
    const est = s.reduce((acc, x) => acc + x.s, 0) / Math.max(1, s.length);
    return { regle: label, jours: s.length, gagnes: w, reussite: s.length ? pct(w / s.length) : "—", estimee: label.startsWith("C") ? "—" : pct(est) };
  };
  console.log(`\nJambes : ${rows.length} ; jours composés : ${out.length} (${cutoff} → ${days[days.length - 1]})`);
  console.table([
    summary("A moteur, la plus probable", out, (d) => d.A),
    summary("B cellule glissante, la plus probable", out, (d) => d.B),
    summary("C marge la plus basse", out, (d) => d.C),
  ]);

  const sorted = [...out].sort((x, y) => x.n - y.n);
  const t = Math.ceil(sorted.length / 3);
  const terciles = [sorted.slice(0, t), sorted.slice(t, 2 * t), sorted.slice(2 * t)];
  console.log("\nPar tercile de richesse (nombre de rencontres du vivier) :");
  console.table(terciles.map((rows, i) => ({
    tercile: ["pauvre", "moyen", "riche"][i], jours: rows.length,
    n_min: rows[0]?.n, n_max: rows[rows.length - 1]?.n,
    A: summary("A", rows, (d) => d.A).reussite, A_annonce: summary("A", rows, (d) => d.A).estimee,
    B: summary("B", rows, (d) => d.B).reussite, B_annonce: summary("B", rows, (d) => d.B).estimee,
    C: summary("C", rows, (d) => d.C).reussite,
  })));

  console.log("\nAbstention « publier si proba B ≥ seuil », par mois :");
  const months = [...new Set(out.map((d) => d.month))].sort();
  const table = [];
  for (const seuil of [0, 0.48, 0.5, 0.52, 0.55]) {
    const row = { seuil };
    for (const m of months) {
      const rows = out.filter((d) => d.month === m && d.B && d.B.s >= seuil);
      const w = rows.filter((d) => d.B.won).length;
      row[m] = `${w}/${rows.length}${rows.length ? " (" + pct(w / rows.length) + ")" : ""}`;
    }
    table.push(row);
  }
  console.table(table);

  console.log("\nMême règle sur A (proba moteur) — pour voir la malédiction du vainqueur :");
  const tableA = [];
  for (const seuil of [0, 0.5, 0.55, 0.6, 0.65]) {
    const row = { seuil };
    for (const m of months) {
      const rows = out.filter((d) => d.month === m && d.A && d.A.s >= seuil);
      const w = rows.filter((d) => d.A.won).length;
      row[m] = `${w}/${rows.length}${rows.length ? " (" + pct(w / rows.length) + ")" : ""}`;
    }
    tableA.push(row);
  }
  console.table(tableA);
})().catch((e) => { console.error(e.message); process.exit(1); });
