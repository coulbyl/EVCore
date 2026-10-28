import { expect, test } from "@playwright/test";

/**
 * Décisions sur le faux backend (e2e/support/mock-backend.mjs, MATCH_DECISIONS).
 *
 * Ce que l'écran doit dire depuis le 2026-10-27 : le pari en clair avec le nom
 * des équipes (plus de « Domicile »), la fréquence plutôt que le
 * pourcentage, plus de badge « Fiable », une phrase quand deux lectures du
 * même match ne peuvent pas passer ensemble. Depuis le 2026-10-28, la
 * fréquence est celle du marché, marge retirée, et la note par cote a
 * disparu avec la probabilité du moteur.
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
    // Fréquence du marché, marge retirée : 1 / 1,28 / 1,05 = 74 %, là où
    // le moteur annonçait 79 % (« 8 fois sur 10 ») avant le 2026-10-28.
    await expect(card.getByText("environ 7 fois sur 10")).toBeVisible();
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
    // Plus de note « optimiste à cette cote » : la fréquence affichée est
    // celle du marché, marge retirée (2026-10-28).
    await expect(card.getByTestId("odds-band-note")).toHaveCount(0);
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
