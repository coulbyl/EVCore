/**
 * Budgets de performance des écrans joueur (docs/refonte-ui/16-performance-et-qualite.md § 2).
 *
 * Lighthouse mobile par défaut : Moto G simulé, « Slow 4G », CPU ×4. Chaque
 * écran est mesuré à froid (cache vidé) puis à chaud (cache du navigateur
 * gardé), BUDGET_RUNS fois chacun ; on garde la médiane.
 *
 * - LCP ≤ 2,5 s à froid, ≤ 1,2 s à chaud.
 * - TBT ≤ 200 ms : l'INP ne se mesure pas sans interaction réelle, le temps de
 *   blocage total est son équivalent de laboratoire (même budget).
 * - CLS ≤ 0,1.
 * - JavaScript transféré à froid ≤ 150 kio (gzip, tel que servi).
 *
 * Le script lance le faux backend des tests e2e et le serveur autonome du
 * build, assemblé comme dans apps/web/Dockerfile (statiques et `public` à côté
 * de server.js). Le build doit avoir été fait contre ce faux backend :
 *
 *   NEXT_PUBLIC_API_URL=http://127.0.0.1:3098 pnpm build && pnpm budgets
 *
 * Code de sortie 1 si un budget est dépassé ou si un écran n'a pas été rendu
 * avec ses données (redirection, aucune lecture de session au faux backend).
 */
import { spawn } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");

const WEB_PORT = Number(process.env.BUDGET_WEB_PORT ?? 3005);
const MOCK_PORT = Number(process.env.BUDGET_MOCK_PORT ?? 3098);
const RUNS = Number(process.env.BUDGET_RUNS ?? 3);
const BASE = `http://localhost:${WEB_PORT}`;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;

const BUDGETS = {
  coldLcpMs: 2500,
  warmLcpMs: 1200,
  tbtMs: 200,
  cls: 0.1,
  scriptKib: 150,
};

// Le joueur, pas l'admin : c'est son bundle qu'on budgète.
const SESSION_COOKIE = { name: "evcore_session", value: "e2e" };
const SCREENS = [
  { name: "Landing", path: "/", signedIn: false },
  { name: "Aujourd'hui", path: "/today", signedIn: true },
  { name: "Matchs", path: "/matches", signedIn: true },
  { name: "Résultats", path: "/results", signedIn: true },
  { name: "Moi", path: "/me", signedIn: true },
];

function start(command, args, env) {
  const child = spawn(command, args, {
    cwd: webRoot,
    env: { ...process.env, ...env },
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
  return child;
}

function stop(child) {
  if (child.exitCode !== null) return;
  try {
    // Le groupe entier : `next start` lance ses propres processus.
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // Pas encore prêt.
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`${url} ne répond pas après ${timeoutMs} ms`);
}

// Le Chromium des tests Playwright quand il est installé, sinon le Chrome que
// chrome-launcher trouve sur la machine (celui des runners GitHub).
function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const bundled = chromium.executablePath();
  return existsSync(bundled) ? bundled : undefined;
}

// Un vrai cookie dans le navigateur : Chrome écarte un en-tête `Cookie` passé
// par les `extraHeaders` de Lighthouse. Lighthouse ne vide pas les cookies
// entre deux mesures, seulement le cache et le stockage.
async function setSessionCookie(port, signedIn) {
  const version = await (
    await fetch(`http://127.0.0.1:${port}/json/version`)
  ).json();
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    socket.onopen = done;
    socket.onerror = fail;
  });
  const reply = new Promise((done, fail) => {
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.error) fail(new Error(message.error.message));
      else done();
    };
  });
  socket.send(
    JSON.stringify(
      signedIn
        ? {
            id: 1,
            method: "Storage.setCookies",
            params: {
              cookies: [{ ...SESSION_COOKIE, domain: "localhost", path: "/" }],
            },
          }
        : { id: 1, method: "Storage.clearCookies" },
    ),
  );
  await reply;
  socket.close();
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function scriptBytes(lhr) {
  const items = lhr.audits["network-requests"]?.details?.items ?? [];
  return items
    .filter((item) => item.resourceType === "Script")
    .reduce((sum, item) => sum + (item.transferSize ?? 0), 0);
}

async function measure(port, screen, warm) {
  const result = await lighthouse(`${BASE}${screen.path}`, {
    port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance"],
    disableStorageReset: warm,
  });
  const lhr = result?.lhr;
  if (!lhr) throw new Error(`${screen.path} : aucun rapport Lighthouse`);
  if (lhr.runtimeError) {
    throw new Error(`${screen.path} : ${lhr.runtimeError.message}`);
  }
  const landedOn = new URL(lhr.finalDisplayedUrl).pathname;
  if (landedOn !== screen.path) {
    throw new Error(`${screen.path} redirige vers ${landedOn}`);
  }
  if (process.env.LCP_EXPLAIN && !warm) explainLcp(screen, lhr);
  return {
    lcpMs: lhr.audits["largest-contentful-paint"].numericValue,
    tbtMs: lhr.audits["total-blocking-time"].numericValue,
    cls: lhr.audits["cumulative-layout-shift"].numericValue,
    scriptKib: scriptBytes(lhr) / 1024,
  };
}

// LCP_EXPLAIN=1 : l'élément du LCP froid et ses phases observées (hors
// simulation du réseau lent), pour trouver ce qui le retarde.
function explainLcp(screen, lhr) {
  const items = lhr.audits["lcp-breakdown-insight"]?.details?.items ?? [];
  const phases = (items.find((item) => item.type === "table")?.items ?? [])
    .map((phase) => `${phase.label} ${Math.round(phase.duration)} ms`)
    .join(", ");
  const node = items.find((item) => item.type === "node");
  console.log(`${screen.path} : ${node?.snippet ?? "?"} — ${phases}`);
  if (process.env.LCP_EXPLAIN === "requests") {
    for (const r of lhr.audits["network-requests"]?.details?.items ?? []) {
      console.log(
        `  ${Math.round(r.networkRequestTime)}→${Math.round(r.networkEndTime)} ms ${(r.transferSize / 1024).toFixed(1)} kio ${r.priority} ${r.resourceType} ${r.url.slice(-60)}`,
      );
    }
  }
}

async function measureScreen(port, screen) {
  const cold = [];
  const warm = [];
  for (let run = 0; run < RUNS; run += 1) {
    cold.push(await measure(port, screen, false));
    // Juste après une mesure à froid : le cache est celui de cet écran.
    warm.push(await measure(port, screen, true));
  }
  const pick = (runs, key) => median(runs.map((r) => r[key]));
  return {
    screen,
    coldLcpMs: pick(cold, "lcpMs"),
    warmLcpMs: pick(warm, "lcpMs"),
    tbtMs: Math.max(pick(cold, "tbtMs"), pick(warm, "tbtMs")),
    cls: Math.max(pick(cold, "cls"), pick(warm, "cls")),
    scriptKib: pick(cold, "scriptKib"),
  };
}

function verdicts(row) {
  return [
    [
      "LCP froid",
      row.coldLcpMs,
      BUDGETS.coldLcpMs,
      (v) => `${Math.round(v)} ms`,
    ],
    [
      "LCP chaud",
      row.warmLcpMs,
      BUDGETS.warmLcpMs,
      (v) => `${Math.round(v)} ms`,
    ],
    ["TBT", row.tbtMs, BUDGETS.tbtMs, (v) => `${Math.round(v)} ms`],
    ["CLS", row.cls, BUDGETS.cls, (v) => v.toFixed(3)],
    ["JS", row.scriptKib, BUDGETS.scriptKib, (v) => `${v.toFixed(1)} kio`],
  ].map(([label, value, budget, format]) => ({
    label,
    ok: value <= budget,
    text: format(value),
    budget: format(budget),
  }));
}

function report(rows) {
  const header = `| Écran | ${verdicts(rows[0])
    .map((v) => `${v.label} (≤ ${v.budget})`)
    .join(" | ")} |`;
  const rule = `|---|${verdicts(rows[0])
    .map(() => "---")
    .join("|")}|`;
  const lines = rows.map(
    (row) =>
      `| ${row.screen.name} | ${verdicts(row)
        .map((v) => `${v.ok ? "" : "❌ "}${v.text}`)
        .join(" | ")} |`,
  );
  return [header, rule, ...lines].join("\n");
}

// Ce que fait l'image de production : le serveur autonome ne sert ses
// statiques et `public` que copiés à côté de lui.
function standaloneServer() {
  const standalone = resolve(webRoot, ".next/standalone/apps/web");
  if (!existsSync(join(standalone, "server.js"))) {
    throw new Error(
      `Aucun build : NEXT_PUBLIC_API_URL=${MOCK} pnpm build, puis relancer.`,
    );
  }
  cpSync(resolve(webRoot, ".next/static"), join(standalone, ".next/static"), {
    recursive: true,
  });
  cpSync(resolve(webRoot, "public"), join(standalone, "public"), {
    recursive: true,
  });
  return join(standalone, "server.js");
}

// Un serveur oublié sur un des deux ports répondrait à la place du build
// mesuré : le nouveau serveur ne s'y attache pas, et la mesure porte sur
// l'ancien code, avec des feuilles de style qui n'existent plus (vécu le
// 30/10 : CLS 0,126 sur Aujourd'hui, des chiffres de Matchs périmés).
async function assertPortsFree() {
  for (const url of [BASE, MOCK]) {
    const answered = await fetch(url, { signal: AbortSignal.timeout(1000) })
      .then(() => true)
      .catch(() => false);
    if (answered) {
      throw new Error(
        `${url} répond déjà : arrêter ce serveur, puis relancer.`,
      );
    }
  }
}

async function main() {
  await assertPortsFree();
  const server = standaloneServer();

  const mock = start("node", ["e2e/support/mock-backend.mjs"], {
    E2E_MOCK_PORT: String(MOCK_PORT),
    E2E_ROLE: "OPERATOR",
  });
  const web = start("node", [server], {
    PORT: String(WEB_PORT),
    HOSTNAME: "127.0.0.1",
    NEXT_PUBLIC_API_URL: MOCK,
  });
  // Un profil à nous, passé aussi en drapeau (Chrome garde la dernière valeur) :
  // sous WSL, chrome-launcher traduit son dossier en chemin Windows, que le
  // Chromium Linux créait tel quel dans le répertoire courant.
  const userDataDir = mkdtempSync(join(tmpdir(), "evcore-lighthouse-"));
  let chrome;
  try {
    await waitFor(`${MOCK}/health`, 10_000);
    await waitFor(`http://127.0.0.1:${WEB_PORT}/`, 60_000);
    chrome = await chromeLauncher.launch({
      chromePath: chromePath(),
      userDataDir,
      chromeFlags: [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        `--user-data-dir=${userDataDir}`,
      ],
    });

    const rows = [];
    for (const screen of SCREENS) {
      // Une première visite hors mesure : rendu et caches du serveur chauds.
      await fetch(`${BASE}${screen.path}`, {
        headers: screen.signedIn
          ? { Cookie: `${SESSION_COOKIE.name}=${SESSION_COOKIE.value}` }
          : {},
      });
      await setSessionCookie(chrome.port, screen.signedIn);
      await fetch(`${MOCK}/__e2e/reset`);
      rows.push(await measureScreen(chrome.port, screen));
      const { authMeReads } = await (await fetch(`${MOCK}/__e2e/stats`)).json();
      if (screen.signedIn && authMeReads === 0) {
        throw new Error(
          `${screen.path} n'a jamais lu la session au faux backend : le build vise-t-il ${MOCK} ?`,
        );
      }
    }

    const table = report(rows);
    console.log(
      `\nBudgets Lighthouse, médiane de ${RUNS} mesures\n\n${table}\n`,
    );
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## Budgets Lighthouse (médiane de ${RUNS})\n\n${table}\n`,
      );
    }
    const failed = rows.flatMap((row) =>
      verdicts(row)
        .filter((v) => !v.ok)
        .map((v) => `${row.screen.name} : ${v.label} ${v.text} > ${v.budget}`),
    );
    if (failed.length > 0) {
      console.error(`Budgets dépassés :\n- ${failed.join("\n- ")}`);
      process.exitCode = 1;
    }
  } finally {
    await chrome?.kill();
    stop(web);
    stop(mock);
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
