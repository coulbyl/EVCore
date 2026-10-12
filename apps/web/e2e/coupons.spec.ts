import { expect, test } from "@playwright/test";

/**
 * Page Coupons sur le faux backend (e2e/support/mock-backend.mjs) : six
 * coupons du 2026-10-05 — le pari sûr du jour, puis un par issue — et les
 * deux générateurs.
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
    expect(count).toBe(6);
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
    // Ligne de clôture d'une jambe : la cote seule, en couleur neutre ; la
    // valeur signée vit dans le détail (revue UX 2026-10-11, P1-7).
    const closing = card.getByTestId("leg-closing").first();
    await expect(closing).toHaveText(/^(Clôture|Close) @1\.90$/);
    await expect(closing).toHaveAttribute("data-verdict", "unknownMargin");
  });

  test("les deux générateurs et le coupon remboursé sont identifiés", async ({
    page,
  }) => {
    await expect(
      page.getByText("Choisi sur les cotes", { exact: true }),
    ).toHaveCount(2);
    await expect(page.getByText("Analyse IA", { exact: true })).toHaveCount(3);
    await expect(
      page.getByText("Sélections du moteur", { exact: true }),
    ).toHaveCount(1);
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

  test("le pari sûr du jour est affiché en premier, avec une seule jambe", async ({
    page,
  }) => {
    const cards = page.locator("[data-slot=card]").filter({
      has: page.getByTestId("coupon-combined-odds"),
    });
    const first = cards.first();
    await expect(
      first.getByText(/Pari sûr du jour|Safe bet of the day/),
    ).toBeVisible();
    // Historique mesuré à la place de la fréquence annoncée dès qu'il y a
    // assez de jours réglés (24 ici) ; le combiné (3 jours) garde l'annonce.
    await expect(first.getByTestId("coupon-track-record")).toHaveText(
      "19 jours gagnés sur 24 (30 derniers jours)",
    );
    await expect(first.getByTestId("leg-odds")).toHaveCount(1);
    await expect(first.getByTestId("coupon-combined-odds")).toHaveText("@1.22");
  });

  test("le combiné du jour suit le pari sûr, avec trois jambes courtes", async ({
    page,
  }) => {
    const cards = page.locator("[data-slot=card]").filter({
      has: page.getByTestId("coupon-combined-odds"),
    });
    const second = cards.nth(1);
    await expect(second.getByText(/Combiné du jour/)).toBeVisible();
    await expect(
      second.getByText(/3 jours sur 4|3 days out of 4/),
    ).toBeVisible();
    await expect(second.getByTestId("leg-odds")).toHaveCount(3);
  });
});
