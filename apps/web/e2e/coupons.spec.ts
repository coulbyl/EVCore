import { expect, test } from "@playwright/test";

/**
 * Page Coupons sur le faux backend (e2e/support/mock-backend.mjs) : quatre
 * coupons du 2026-10-05, un par issue, et les deux générateurs.
 *
 * Ce que l'écran doit dire, et qu'il ne disait pas avant le 2026-10-08 :
 * la cote payée quand elle diffère de la cote proposée (PARTIAL), le
 * remboursement (coupon et jambe), la ligne de clôture d'une jambe, et la
 * cote combinée qui reste le produit exact des jambes affichées.
 */
test.describe("Coupons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/coupons?date=2026-10-05");
    await expect(
      page.getByTestId("coupon-combined-odds").first(),
    ).toBeVisible();
  });

  test("la cote combinée affichée est le produit des cotes des jambes", async ({
    page,
  }) => {
    const cards = page.locator("[data-slot=card]").filter({
      has: page.getByTestId("coupon-combined-odds"),
    });
    const count = await cards.count();
    expect(count).toBe(4);
    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i);
      const combined = Number(
        (await card.getByTestId("coupon-combined-odds").innerText()).replace(
          "@",
          "",
        ),
      );
      const legOdds = await card.getByTestId("leg-odds").allInnerTexts();
      const product = legOdds
        .map((text) => Number(text.replace("@", "")))
        .reduce((acc, odds) => acc * odds, 1);
      expect(Math.abs(combined - product)).toBeLessThan(0.011);
    }
  });

  test("un gain partiel montre la cote payée et la jambe remboursée", async ({
    page,
  }) => {
    const card = page.locator("[data-slot=card]").filter({
      hasText: "jambe remboursée",
    });
    await expect(card.getByTestId("coupon-combined-odds")).toHaveText("@6.91");
    await expect(card.getByTestId("coupon-realized-odds")).toHaveText("@4.32");
    // Draw No Bet sur un nul : « Remboursé », pas « Annulé » — libellé
    // traduit (la session de test peut être en anglais).
    await expect(card.getByText(/^(Remboursé|Refunded)$/)).toBeVisible();
    await expect(card.getByText(/^(Annulé|Void)$/)).toHaveCount(0);
  });

  test("un gain sans remboursement n'affiche pas de seconde cote", async ({
    page,
  }) => {
    const card = page.locator("[data-slot=card]").filter({
      has: page.getByText("✓ Gagné", { exact: true }),
    });
    await expect(card.getByTestId("coupon-realized-odds")).toHaveCount(0);
    // Ligne de clôture d'une jambe : cote et valeur signée.
    await expect(card.getByTestId("leg-closing").first()).toHaveText(
      "Clôture @1.90 · +5.2%",
    );
  });

  test("les deux générateurs et le coupon remboursé sont identifiés", async ({
    page,
  }) => {
    await expect(page.getByText("Prix", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Analyse", { exact: true })).toHaveCount(3);
    // `textContent`, pas `innerText` : le badge est mis en majuscules par le
    // CSS, ce qui n'est pas le texte qu'on vérifie.
    const results = await page.getByTestId("coupon-result").allTextContents();
    expect(results).toEqual(
      expect.arrayContaining([
        "✓ Gagné",
        "✓ Gagné · jambe remboursée",
        "✗ Perdu",
        "Remboursé",
      ]),
    );
  });
});
