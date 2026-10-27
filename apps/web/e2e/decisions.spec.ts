import { expect, test } from "@playwright/test";

/**
 * Décisions sur le faux backend (e2e/support/mock-backend.mjs, MATCH_DECISIONS).
 *
 * Ce que l'écran doit dire depuis le 2026-10-27 : le pari en clair avec le nom
 * des équipes (plus de « Domicile »), la fréquence plutôt que le
 * pourcentage, plus de badge « Fiable », une phrase quand deux lectures du
 * même match ne peuvent pas passer ensemble, et la note par cote quand nos
 * pourcentages ont été optimistes à cette cote.
 */
test.describe("Décisions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/decisions");
    await expect(page.getByText("Victoire Arsenal")).toBeVisible();
  });

  test("Notre sélection se lit avec le nom des équipes et en fréquence", async ({
    page,
  }) => {
    const card = page.locator("[data-slot=fixture-card]").filter({
      hasText: "Arsenal",
    });
    await expect(card.getByText("Notre sélection")).toBeVisible();
    await expect(card.getByText("environ 8 fois sur 10")).toBeVisible();
    await expect(card.getByText(/^Domicile$/)).toHaveCount(0);
    await expect(page.getByText("Fiable", { exact: true })).toHaveCount(0);
  });

  test("les lectures contradictoires d'un match sont expliquées", async ({
    page,
  }) => {
    const card = page.locator("[data-slot=fixture-card]").filter({
      hasText: "Arsenal",
    });
    await card
      .getByRole("button", { name: /autres lectures du match/ })
      .click();
    await expect(
      card.getByText("Arsenal n'encaisse pas", { exact: true }),
    ).toBeVisible();
    await expect(card.getByTestId("contradiction-note")).toHaveText(
      /« Les deux équipes marquent » et « Arsenal n'encaisse pas » ne peuvent pas passer ensemble/,
    );
    // Au-dessus de 1,80, nos pourcentages ont été optimistes sur 90 jours.
    await expect(card.getByTestId("odds-band-note").first()).toContainText(
      "Cote de 1,80 et plus",
    );
  });

  test("Victoire et Nul sur le même match se distinguent par l'issue", async ({
    page,
  }) => {
    const card = page
      .locator("[data-slot=fixture-card]")
      .filter({ hasText: "PSV" });
    await card
      .getByRole("button", { name: /autres lectures du match/ })
      .click();
    await expect(card.getByText("Victoire PSV", { exact: true })).toBeVisible();
    await expect(card.getByText("Match nul", { exact: true })).toBeVisible();
    await expect(card.getByTestId("contradiction-note")).toContainText(
      "ne peuvent pas passer ensemble",
    );
  });
});
