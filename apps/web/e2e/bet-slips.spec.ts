import { expect, test } from "@playwright/test";

/**
 * Mes coupons et Suivi de mise sur le faux backend (BET_SLIPS, avec un
 * combiné à jambe remboursée, et BANKROLL_TRANSACTIONS). Ce que les deux
 * écrans doivent dire depuis le 2026-10-27 : un résultat daté et compté, une
 * jambe remboursée qui rend sa mise au lieu de faire perdre le combiné, les
 * paris écrits avec les équipes, aucun EV, aucun « ROI », des francs CFA
 * sans centimes.
 */
test.describe("Mes coupons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/bet-slips");
    await expect(
      page.getByRole("heading", { level: 1, name: "Mes coupons" }),
    ).toBeVisible();
  });

  test("le résultat est daté, compté, sans centimes", async ({ page }) => {
    const result = page.getByTestId("bet-slips-result").filter({
      visible: true,
    });
    await expect(result).toContainText("3 coupons réglés, 1 en cours");
    // Espaces insécables du format français : \s les couvre.
    await expect(result).toContainText(
      /Misé 4\s000\sF, rendu 4\s198\sF\s: \+198\sF\./,
    );
    await expect(result).toContainText("Depuis ton premier coupon");
  });

  test("un combiné à jambe remboursée est gagné, la jambe remboursée", async ({
    page,
  }) => {
    const card = page
      .getByTestId("bet-slip-card")
      .filter({ visible: true })
      .filter({ hasText: "Real Madrid" });
    await expect(card).toContainText("Gagné");
    await expect(card).toContainText(/Rendu\s*2\s660\sF/);
    await card.click();
    const detail = page.getByTestId("bet-slip-detail").filter({
      visible: true,
    });
    await expect(detail.getByText("Remboursé", { exact: true })).toBeVisible();
    await expect(detail).toContainText("compte pour une cote de 1");
    await expect(detail).not.toContainText("EV");
  });

  test("les paris sont écrits avec les équipes", async ({ page }) => {
    await expect(
      page.getByText("Victoire Arsenal").filter({ visible: true }).first(),
    ).toBeVisible();
  });
});

test.describe("Suivi de mise", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/bankroll");
    await expect(
      page.getByRole("heading", { level: 1, name: "Suivi de mise" }),
    ).toBeVisible();
  });

  test("plus de ROI, un résultat de paris daté et un dépôt déclaré", async ({
    page,
  }) => {
    await expect(page.locator("main").first()).not.toContainText("ROI");
    await expect(page.getByTestId("bankroll-result")).toContainText(
      /3 coupons réglés, misé 4\s000\sF, rendu 4\s198\sF/,
    );
    await expect(
      page.getByRole("button", { name: "Déclarer un dépôt" }),
    ).toBeVisible();
  });

  test("un combiné est nommé comme tel dans l'historique", async ({ page }) => {
    await expect(
      page
        .getByText("Combiné · 2 sélections")
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
  });
});
