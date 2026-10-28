import { expect, test } from "@playwright/test";

/**
 * Avis IA sur le faux backend (MATCH_DECISIONS, avis VANTAGE). Ce que l'écran
 * doit dire depuis le 2026-10-27 : son bilan daté avec la phrase sur la cote
 * du bookmaker, le compte du jour, l'avis écrit comme un pari de Décisions,
 * ce que dit Notre sélection sur le même match, un refus par le plafond de
 * cote distinct d'une abstention, et les matchs terminés à part.
 */
test.describe("Avis IA", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/arbitrage");
    await expect(page.getByTestId("ai-track-record")).toBeVisible();
  });

  test("le bilan et le compte du jour sont en tête", async ({ page }) => {
    await expect(page.getByTestId("ai-track-record")).toContainText(
      "sur 300 avis réglés",
    );
    await expect(page.getByTestId("ai-track-record")).toContainText(
      "ne bat pas la cote du bookmaker",
    );
    await expect(page.getByTestId("ai-track-record")).toContainText(
      "Écart au marché : +2,6 points, à ± 5,4 points près.",
    );
    await expect(page.getByTestId("ai-track-record")).toContainText(
      "v5 du 27/10/26 au 28/10/26 (60 avis)",
    );
    await expect(page.getByTestId("ai-today-count")).toHaveText(
      "Aujourd'hui : 2 avis proposés sur 3 matchs lus, 1 sans avis.",
    );
  });

  test("l'avis se lit comme un pari, à côté de Notre sélection", async ({
    page,
  }) => {
    const card = page
      .locator("[data-slot=fixture-card]")
      .filter({ hasText: "Burnley" });
    await expect(
      card.getByText("Plus de 1,5 but", { exact: true }),
    ).toBeVisible();
    await expect(card.getByText("environ 8 fois sur 10").first()).toBeVisible();
    await expect(card.getByTestId("ai-vs-our-pick")).toContainText(
      "Victoire Arsenal",
    );
    await expect(card.getByTestId("ai-vs-our-pick")).toContainText(
      "pari différent",
    );
  });

  test("un refus par le plafond de cote n'est pas une simple abstention", async ({
    page,
  }) => {
    await page.goto("/dashboard/arbitrage?filter=all");
    const card = page
      .locator("[data-slot=fixture-card]")
      .filter({ hasText: "PSV" });
    await expect(card.getByTestId("ai-verdict")).toContainText(
      "cote au-dessus de 1,80",
    );
    await expect(
      card.getByText(/PSV a gagné ses quatre derniers/),
    ).toBeVisible();
    await expect(
      card.getByText(/Lecture retenue mais non proposée/),
    ).toHaveCount(0);
  });

  test("les matchs terminés sont repliés à part", async ({ page }) => {
    const finished = page
      .locator("[data-slot=fixture-card]")
      .filter({ hasText: "Africa Sports" });
    await expect(finished).toHaveCount(0);
    await page.getByRole("button", { name: /Match terminé/ }).click();
    await expect(finished).toBeVisible();
  });
});
