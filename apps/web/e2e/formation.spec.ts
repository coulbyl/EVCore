import { test, expect } from "@playwright/test";

const STORAGE_KEY = "evcore:formation:progress:v1";

test("formation — ouvrir un article et marquer comme terminé @responsive", async ({
  page,
}) => {
  await page.goto("/dashboard/formation");
  await expect(page).toHaveURL(/\/dashboard\/formation/);

  const firstCategory = page
    .locator('[data-testid="formation-category-link"]')
    .first();
  await expect(firstCategory).toBeVisible();
  await firstCategory.click();

  const firstItem = page
    .locator('[data-testid="formation-category-item"]')
    .first();
  await expect(firstItem).toBeVisible();
  await firstItem.click();

  await expect(page.locator("h1").first()).toBeVisible();

  const button = page.locator('[data-testid="formation-completion-button"]');
  await expect(button).toBeVisible();
  await button.click();

  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY,
  );
  expect(raw).toContain("read");
});

test("formation — ouvrir une vidéo et afficher le player @responsive", async ({
  page,
}) => {
  await page.goto("/dashboard/formation/bases/intro-formation");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("iframe, video").first()).toBeVisible();
});
