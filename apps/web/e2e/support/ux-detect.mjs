// Détecteur déterministe pour la revue UX (« Assessment B ») : ouvre une route
// de l'app servie par le faux backend et relève des faits mesurables, sans
// jugement : titres, cibles tactiles, tailles de texte, contrastes, noms
// accessibles, débordement horizontal. Sortie JSON sur stdout.
//
//   E2E_ROLE=OPERATOR node e2e/support/ux-detect.mjs /dashboard 375 dark
//
// Pré-requis : serveurs déjà lancés par Playwright (web :3000, mock :3099).
import { chromium } from "@playwright/test";

const [route = "/dashboard", widthArg = "375", theme = "dark"] =
  process.argv.slice(2);
const width = Number(widthArg);
const BASE = `http://localhost:${process.env.E2E_WEB_PORT ?? 3000}`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height: width < 700 ? 667 : 800 },
  locale: "fr-FR",
  colorScheme: theme,
});
await context.addCookies([
  {
    name: "evcore_session",
    value: "e2e-session",
    domain: "localhost",
    path: "/",
  },
]);
const page = await context.newPage();
await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
await page.goto(BASE + route, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const report = await page.evaluate(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== "hidden" &&
      s.display !== "none"
    );
  };
  const txt = (el) =>
    (
      el.innerText ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 50);

  // --- couleurs
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = "1"] = m[1].split(",").map((x) => x.trim());
    return { r: +r, g: +g, b: +b, a: +a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const effectiveBg = (el) => {
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const chain = [];
    for (let n = el; n; n = n.parentElement) chain.push(n);
    for (const n of chain.reverse()) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) bg = blend(c, bg);
    }
    return bg;
  };
  const ratio = (a, b) => {
    const l1 = lum(a),
      l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textEls = new Set();
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (
      n.textContent.trim().length > 1 &&
      n.parentElement &&
      vis(n.parentElement)
    )
      textEls.add(n.parentElement);
  }
  const small = [],
    lowContrast = [];
  for (const el of textEls) {
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize);
    const weight = parseInt(s.fontWeight, 10);
    if (size < 12) small.push({ text: txt(el), px: +size.toFixed(1) });
    const fg = parse(s.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    const r = ratio(fg.a < 1 ? blend(fg, bg) : fg, bg);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const min = large ? 3 : 4.5;
    if (r < min)
      lowContrast.push({
        text: txt(el),
        px: +size.toFixed(1),
        ratio: +r.toFixed(2),
        min,
      });
  }

  const interactive = [
    ...document.querySelectorAll(
      "a[href],button,[role=button],input,select,textarea",
    ),
  ].filter(vis);
  const smallTargets = interactive
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: txt(el),
        w: Math.round(r.width),
        h: Math.round(r.height),
        tag: el.tagName.toLowerCase(),
      };
    })
    .filter((t) => t.w < 44 || t.h < 44);
  const unnamed = interactive
    .filter((el) => !txt(el) && !el.querySelector("img[alt]"))
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || "").toString().slice(0, 60),
    }));

  const headings = [...document.querySelectorAll("h1,h2,h3,h4")]
    .filter(vis)
    .map((h) => `${h.tagName.toLowerCase()}: ${txt(h)}`);
  const imgsNoAlt = [...document.querySelectorAll("img")].filter(
    (i) => vis(i) && !i.alt,
  ).length;

  // Mots interdits par les règles de rédaction (plan marketing §5).
  const body = document.body.innerText;
  const banned = [
    "sûr",
    "100 %",
    "100%",
    "garanti",
    "investir",
    "VIP",
    "rentable",
    "gagner de l'argent",
  ];
  const bannedHits = banned
    .map((w) => ({
      word: w,
      count: (
        body.match(
          new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        ) || []
      ).length,
    }))
    .filter((h) => h.count > 0);

  const dedupe = (arr, key) => {
    const seen = new Set();
    return arr.filter((x) => {
      const k = key(x);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  return {
    url: location.href,
    title: document.title,
    lang: document.documentElement.lang,
    headings,
    overflowX:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    textElements: textEls.size,
    smallText: {
      count: small.length,
      samples: dedupe(small, (x) => x.text + x.px).slice(0, 12),
    },
    lowContrast: {
      count: lowContrast.length,
      samples: dedupe(lowContrast, (x) => x.text)
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 15),
    },
    interactive: interactive.length,
    smallTapTargets: {
      count: smallTargets.length,
      samples: dedupe(smallTargets, (x) => x.text + x.w + x.h).slice(0, 15),
    },
    unnamedInteractive: { count: unnamed.length, samples: unnamed.slice(0, 8) },
    imgsNoAlt,
    bannedWords: bannedHits,
  };
});

console.log(JSON.stringify(report, null, 1));
await browser.close();
