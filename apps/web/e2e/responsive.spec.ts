import { test, expect } from "@playwright/test";

/**
 * Viewport smoke tests — run on three projects (375 / 768 / 1280).
 * Each test checks:
 *  1. Auth cookie is accepted → no redirect to /auth/login
 *  2. Main content area renders
 *  3. No horizontal overflow
 */

const PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "fixtures", path: "/dashboard/fixtures", adminOnly: true },
  { name: "formation", path: "/dashboard/formation" },
  { name: "bankroll", path: "/dashboard/bankroll" },
  { name: "bet-slips", path: "/dashboard/bet-slips" },
  { name: "decisions", path: "/dashboard/decisions" },
  { name: "account", path: "/dashboard/params/account" },
  { name: "audit", path: "/dashboard/audit", adminOnly: true },
] as const;

for (const page of PAGES) {
  const { name, path } = page;
  const adminOnly = "adminOnly" in page && page.adminOnly;
  test(`${name} — pas de scroll horizontal @responsive`, async ({ page }) => {
    // Matchs et Audit renvoient un joueur ailleurs : vue admin seulement.
    test.skip(
      adminOnly && process.env.E2E_ROLE === "OPERATOR",
      "page réservée à l'admin",
    );
    await page.goto(path);

    // Confirm auth worked — no redirect to login
    await expect(page).toHaveURL(new RegExp(path.replace("/", "\\/") + ".*"));

    // Main content must be visible (not a blank screen)
    await expect(page.locator("main").first()).toBeVisible();

    // No horizontal overflow
    const overflows = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      windowInnerWidth: window.innerWidth,
    }));
    expect(overflows.bodyScrollWidth).toBeLessThanOrEqual(
      overflows.windowInnerWidth,
    );
  });
}

/**
 * La recherche dans la page vit dans l'en-tête à toutes les largeurs. Elle
 * avait été cachée sous `md` le 2026-10-11 (P1-8) et avait donc disparu des
 * téléphones au lieu d'y changer de place (remarqué le 2026-10-19).
 */
test("recherche dans la page — visible dans l'en-tête et fonctionnelle @responsive", async ({
  page,
}) => {
  await page.goto("/dashboard/coupons?date=2026-10-05");
  await expect(page.locator("main").first()).toBeVisible();

  const button = page.getByRole("button", { name: "Rechercher dans la page" });
  const original = page.viewportSize()!;
  // Deux largeurs de téléphone courantes, puis celle du projet : à chacune
  // le bouton est dans la fenêtre et l'en-tête n'a rien à faire défiler,
  // avec le solde à neuf chiffres du faux backend.
  for (const width of [360, 412, original.width]) {
    await page.setViewportSize({ width, height: original.height });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box, `${width}px`).not.toBeNull();
    expect(box!.x, `${width}px`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${width}px`).toBeLessThanOrEqual(width + 0.5);
    const headerOverflow = await page.evaluate(() => {
      const header = document.querySelector("header");
      return header ? header.scrollWidth - header.clientWidth : 0;
    });
    expect(headerOverflow, `${width}px`).toBeLessThanOrEqual(0);
  }

  await button.click();
  const input = page.getByRole("textbox").first();
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill("Braga");
  await page.keyboard.press("Escape");
  await expect(input).toBeHidden();
});
