// Capture du premier écran réel (sans agrandir la fenêtre), visiteur anonyme.
//   node e2e/support/first-screen.mjs / 375 dark out.png
import { chromium } from "@playwright/test";
const [route = "/", w = "375", theme = "dark", out = "first-screen.png"] =
  process.argv.slice(2);
const width = Number(w);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width, height: width < 700 ? 812 : 800 },
  locale: "fr-FR",
  colorScheme: theme,
});
const page = await ctx.newPage();
await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
await page.goto(
  `http://localhost:${process.env.E2E_WEB_PORT ?? 3000}${route}`,
  { waitUntil: "networkidle" },
);
await page.waitForTimeout(1000);
await page.screenshot({ path: out });
await browser.close();
