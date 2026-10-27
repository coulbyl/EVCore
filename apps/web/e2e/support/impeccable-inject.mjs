import { chromium } from "@playwright/test";
const [route = "/dashboard", widthArg = "375", theme = "dark"] =
  process.argv.slice(2);
const width = Number(widthArg);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width, height: width < 700 ? 667 : 800 },
  locale: "fr-FR",
  colorScheme: theme,
});
// ANONYMOUS=1 : visiteur sans session (pages publiques ; sinon la landing
// redirige vers le tableau de bord).
if (!process.env.ANONYMOUS) {
  await ctx.addCookies([
    {
      name: "evcore_session",
      value: "e2e-session",
      domain: "localhost",
      path: "/",
    },
  ]);
}
const page = await ctx.newPage();
const logs = [];
let injected = false;
page.on("console", (m) => {
  const t = m.text();
  if (injected || /impeccable/i.test(t)) logs.push(`${m.type()}: ${t}`);
});
await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
await page.goto(
  `http://localhost:${process.env.E2E_WEB_PORT ?? 3000}` + route,
  { waitUntil: "networkidle" },
);
await page.waitForTimeout(1200);
// preflight mutation
await page.evaluate(() => {
  document.title = "impeccable-preflight";
});
injected = true;
await page.addScriptTag({ url: "http://localhost:8400/detect.js" });
await page.waitForTimeout(3000);
let scan = null;
try {
  scan = await page.evaluate(async () => {
    const r =
      typeof window.impeccableScan === "function"
        ? await window.impeccableScan()
        : null;
    const desc = (el) => {
      if (!(el instanceof Element)) return null;
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 80),
        text: (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 60),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    const ser = (v, depth = 0) => {
      if (v instanceof Element) return desc(v);
      if (v == null || typeof v !== "object") return v;
      if (depth > 4) return "[deep]";
      if (Array.isArray(v))
        return v.slice(0, 400).map((x) => ser(x, depth + 1));
      const o = {};
      for (const [k, x] of Object.entries(v)) {
        if (k.startsWith("__react")) continue;
        o[k] = ser(x, depth + 1);
      }
      return o;
    };
    return ser(r);
  });
} catch (e) {
  scan = { error: String(e) };
}
console.log(
  JSON.stringify(
    { route, width, theme, title: await page.title(), logs, scan },
    null,
    1,
  ),
);
await browser.close();
