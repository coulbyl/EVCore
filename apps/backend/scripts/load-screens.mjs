// Usage: FIXTURE=<a fixture id> BASE=http://127.0.0.1:3201 node scripts/load-screens.mjs
// against a backend on the prod copy (docs/refonte-ui/16 § 2: p95 ≤ 150 ms).
// Light load on the screen endpoints (16 § 2): N requests per route,
// C in parallel, p50/p95 in ms. A throwaway account, deleted at the end.
const BASE = process.env.BASE ?? "http://127.0.0.1:3201";
const N = Number(process.env.N ?? 60);
const C = Number(process.env.C ?? 6);
const fixture = process.env.FIXTURE;
const email = `charge-${Date.now()}@exemple.com`;
const password = "une phrase longue pour la charge";

const reg = await fetch(`${BASE}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ firstName: "Charge", email, password, confirmAge: true, acceptTerms: true }),
});
const cookie = (reg.headers.get("set-cookie") ?? "").split(";")[0];
if (!cookie) throw new Error(`register ${reg.status}`);

const routes = [
  ["GET", "/today"],
  ["GET", "/matches?day=today"],
  ["GET", "/matches?day=yesterday"],
  ["GET", `/matches/${fixture}/sheet`],
  ["GET", "/results/products?period=90"],
  ["GET", "/results/products?period=all"],
  ["GET", "/results/ai?period=90"],
  ["GET", "/results/yesterday"],
  ["GET", "/me"],
  ["GET", "/public/today"],
  ["GET", "/public/results/products?period=90"],
  ["POST", "/ticket/quote", { legs: [{ fixtureId: fixture, market: "ONE_X_TWO", pick: "HOME" }] }],
];

async function one([method, path, body]) {
  const t = performance.now();
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  await r.arrayBuffer();
  return { ms: performance.now() - t, status: r.status };
}

const pct = (xs, p) => xs[Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))];
console.log("| Route | p50 | p95 | statuts |");
console.log("|---|---|---|---|");
for (const route of routes) {
  await one(route); // warm-up
  const results = [];
  for (let i = 0; i < N; i += C) {
    results.push(...(await Promise.all(Array.from({ length: Math.min(C, N - i) }, () => one(route)))));
  }
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const statuses = [...new Set(results.map((r) => r.status))].join(",");
  console.log(`| ${route[0]} ${route[1].replace(fixture, ":id")} | ${pct(ms, 50).toFixed(0)} | ${pct(ms, 95).toFixed(0)} | ${statuses} |`);
}
const del = await fetch(`${BASE}/auth/me/delete`, {
  method: "POST",
  headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
console.log(`compte jetable supprimé : ${del.status}`);
