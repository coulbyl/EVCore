import { test, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";

/**
 * Captures page par page pour la revue UX (chantier A du plan produit du
 * 2026-10-23). Chaque route est photographiée en pleine hauteur, en clair et
 * en sombre, sur chaque projet de viewport (375 / 768 / 1280). Le faux backend
 * fournit des données déterministes : aucune donnée personnelle, rejouable.
 *
 *   E2E_ROLE=OPERATOR CAPTURE_DIR=../../docs/audits/2026-10-24/captures \
 *   pnpm --filter web exec playwright test e2e/captures.spec.ts
 *
 * `CAPTURE_ROUTES` (noms séparés par des virgules) limite la passe à quelques
 * routes ; sinon toutes celles de la liste sont capturées.
 */

const ALL_ROUTES: readonly { name: string; path: string }[] = [
  { name: "accueil", path: "/dashboard" },
  { name: "coupons", path: "/dashboard/coupons" },
  { name: "decisions", path: "/dashboard/decisions" },
  { name: "avis-ia", path: "/dashboard/arbitrage" },
  { name: "matchs", path: "/dashboard/fixtures" },
  { name: "track-record", path: "/dashboard/track-record" },
  { name: "bankroll", path: "/dashboard/bankroll" },
  { name: "mes-coupons", path: "/dashboard/bet-slips" },
  { name: "formation", path: "/dashboard/formation" },
  { name: "glossaire", path: "/dashboard/glossaire" },
  { name: "aide", path: "/dashboard/help" },
  { name: "notifications", path: "/dashboard/notifications" },
  { name: "compte", path: "/dashboard/params/account/profil" },
];

/** Pages publiques, capturées sans session (visiteur anonyme). */
const PUBLIC_ROUTES: readonly { name: string; path: string }[] = [
  { name: "landing", path: "/" },
  { name: "inscription", path: "/auth/register" },
  { name: "connexion", path: "/auth/login" },
  { name: "mot-de-passe-oublie", path: "/auth/forgot-password" },
  { name: "cgu", path: "/cgu" },
  { name: "confidentialite", path: "/confidentialite" },
  { name: "jeu-responsable", path: "/jeu-responsable" },
  { name: "mentions-legales", path: "/mentions-legales" },
  { name: "page-inexistante", path: "/page-inexistante" },
];

const selected = process.env.CAPTURE_ROUTES?.split(",").map((s) => s.trim());
const ROUTES = selected
  ? ALL_ROUTES.filter((r) => selected.includes(r.name))
  : ALL_ROUTES;
const PUBLIC = selected
  ? PUBLIC_ROUTES.filter((r) => selected.includes(r.name))
  : PUBLIC_ROUTES;

const OUT = path.resolve(
  process.cwd(),
  process.env.CAPTURE_DIR ?? "../../docs/audits/captures",
);

/** Hauteur maximale d'une capture : au-delà, la page est tronquée. */
const MAX_HEIGHT = 6000;

// Le produit est français d'abord : le proxy lit Accept-Language.
test.use({ locale: "fr-FR" });

async function capture(
  page: Page,
  testInfo: TestInfo,
  route: { name: string; path: string },
  theme: "dark" | "light",
): Promise<void> {
  // next-themes lit sa clé `theme` dans localStorage avant le premier rendu.
  await page.addInitScript((value) => {
    window.localStorage.setItem("theme", value);
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(route.path, { waitUntil: "networkidle" });
  // Laisse finir les squelettes et les transitions d'entrée.
  await page.waitForTimeout(1200);

  // Le contenu défile dans un conteneur interne, pas dans la fenêtre :
  // `fullPage` ne verrait que le premier écran. On agrandit la fenêtre à
  // la hauteur du plus grand conteneur défilant, puis on photographie.
  const original = page.viewportSize() ?? { width: 1280, height: 800 };
  const contentHeight = await page.evaluate(() => {
    let max = document.documentElement.scrollHeight;
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const style = getComputedStyle(el);
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight
      ) {
        const extra = el.scrollHeight - el.clientHeight;
        max = Math.max(max, window.innerHeight + extra);
      }
    }
    return max;
  });
  await page.setViewportSize({
    width: original.width,
    height: Math.min(MAX_HEIGHT, Math.max(original.height, contentHeight)),
  });
  await page.waitForTimeout(400);

  const file = path.join(OUT, `${route.name}__${original.width}__${theme}.png`);
  await page.screenshot({ path: file, fullPage: true });
  testInfo.annotations.push({ type: "capture", description: file });
  await page.setViewportSize(original);
}

for (const route of ROUTES) {
  for (const theme of ["dark", "light"] as const) {
    test(`capture ${route.name} ${theme} @captures`, async ({
      page,
    }, testInfo) => {
      await capture(page, testInfo, route, theme);
    });
  }
}

test.describe("pages publiques", () => {
  // Visiteur anonyme : aucune session, sinon la landing redirige.
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const route of PUBLIC) {
    for (const theme of ["dark", "light"] as const) {
      test(`capture ${route.name} ${theme} @captures`, async ({
        page,
      }, testInfo) => {
        await capture(page, testInfo, route, theme);
      });
    }
  }
});
