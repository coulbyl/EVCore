import { test, expect } from "@playwright/test";

test.describe("formation — recording", () => {
  test("intro-formation — parcours propre pour vidéo @recording", async ({
    page,
  }) => {
    test.slow();

    // Stabilise la vidéo (moins de variations de rendu).
    await page.emulateMedia({ reducedMotion: "reduce" });

    // 1) Hub formation
    await page.goto("/dashboard/formation");
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForTimeout(400);

    // 2) Ouvrir la catégorie "Les bases"
    const basesLink = page.locator('[data-testid="formation-category-link"]');
    await expect(basesLink.first()).toBeVisible();
    await basesLink.first().scrollIntoViewIfNeeded();
    await basesLink.first().click();

    // 3) Lancer la vidéo d’intro
    const introItem = page.locator('[data-testid="formation-category-item"]');
    await expect(introItem.first()).toBeVisible();
    await introItem.first().scrollIntoViewIfNeeded();
    await introItem.first().click();

    await expect(page.locator("h1").first()).toContainText("Découvrir EVCore");
    await page.waitForTimeout(600);

    // 4) Montrer le player + chapitres (sans lancer/contrôler la lecture)
    await expect(page.locator("iframe, video").first()).toBeVisible();

    const chapters = page.getByRole("button", { name: "Canaux" });
    if (await chapters.count()) {
      await chapters.first().click();
      await page.waitForTimeout(450);
    }

    // 5) Passer sur un article des bases pour montrer la continuité
    const readPickItem = page.locator(
      '[data-testid="formation-category-item"]',
    );
    await expect(readPickItem.nth(1)).toBeVisible();
    await readPickItem.nth(1).click();
    await expect(page.locator("h1").first()).toContainText("Comment lire");

    await page.waitForTimeout(650);
  });
});
