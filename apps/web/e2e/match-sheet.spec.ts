import { expect, test } from "@playwright/test";

/**
 * Fiche de match (depuis le 2026-10-27) : ouverte depuis une carte de
 * Décisions, elle remplace l'écran Matchs côté joueur. Buts attendus avec le
 * nom des équipes, facteurs en mots, lectures écartées avec leur motif ; pas
 * d'EV ni de panier. L'écran Matchs renvoie le joueur vers Décisions.
 */
test.describe("Fiche de match", () => {
  test("s'ouvre depuis Décisions et se lit sans jargon", async ({ page }) => {
    await page.goto("/dashboard/decisions");
    const card = page
      .locator("[data-slot=fixture-card]")
      .filter({ hasText: "Burnley" });
    await card.getByTestId("open-match-sheet").click();

    await expect(page).toHaveURL(/\/dashboard\/decisions\/match\/fx-m1$/);
    await expect(page.locator("h1")).toHaveText("Arsenal – Burnley");
    await expect(page.getByTestId("sheet-expected")).toHaveText(
      "Arsenal environ 1,6 but, Burnley environ 0,9 but : 2,6 buts en moyenne.",
    );
    await expect(page.getByText("avantage Arsenal").first()).toBeVisible();

    const group = page.getByTestId("sheet-rejected-group").first();
    await group.locator("summary").click();
    await expect(
      group.getByText("Les deux équipes marquent", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/\bEV\b/)).toHaveCount(0);
    await expect(page.getByText("Viable")).toHaveCount(0);
  });

  test("l'écran Matchs renvoie le joueur vers Décisions", async ({ page }) => {
    test.skip(
      process.env.E2E_ROLE !== "OPERATOR",
      "vue joueur : lancer avec E2E_ROLE=OPERATOR",
    );
    await page.goto("/dashboard/fixtures");
    await expect(page).toHaveURL(/\/dashboard\/decisions/);
  });
});
