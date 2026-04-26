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
  { name: "fixtures", path: "/dashboard/fixtures" },
  { name: "bankroll", path: "/dashboard/bankroll" },
  { name: "bet-slips", path: "/dashboard/bet-slips" },
  { name: "audit", path: "/dashboard/audit" },
] as const;

for (const { name, path } of PAGES) {
  test(`${name} — pas de scroll horizontal @responsive`, async ({ page }) => {
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
