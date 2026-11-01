import { test, expect } from "@playwright/test";

/**
 * Viewport smoke tests — run on three projects (375 / 768 / 1280).
 * Each test checks:
 *  1. Auth cookie is accepted → no redirect to /auth/login
 *  2. Main content area renders
 *  3. No horizontal overflow
 */

// What is left of /dashboard (12-admin § 0), the admin's only.
const PAGES = [
  { name: "inbox", path: "/dashboard/inbox", adminOnly: true },
  {
    name: "diagnostic",
    path: "/dashboard/decisions/match/fx-m1",
    adminOnly: true,
  },
] as const;

for (const page of PAGES) {
  const { name, path } = page;
  const adminOnly = "adminOnly" in page && page.adminOnly;
  test(`${name} — pas de scroll horizontal @responsive`, async ({ page }) => {
    // Un joueur est renvoyé vers ses onglets : vue admin seulement.
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
