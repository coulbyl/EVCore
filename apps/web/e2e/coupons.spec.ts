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
    // Le coupon prix 5–15 n'est plus affiché ; le coupon long 2,5–5 l'est.
    await expect(page.getByText(/cote 5–15/)).toHaveCount(0);
    await expect(
      page.getByText(/Coupon long · cote 2,5–5/).first(),
    ).toBeVisible();
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

  test("aucune carte ne déborde de l'écran, tuiles comprises", async ({
    page,
  }) => {
    // Le 2026-10-19, sur téléphone, le combiné du jour (cote, 1xBet,
    // chances) débordait : la rangée de tuiles était en `shrink-0` et la
    // carte dépassait de l'écran des deux côtés. Le test « pas de scroll
    // horizontal » ne le voyait pas : le conteneur de la page défile en
    // interne. On mesure donc chaque carte contre la fenêtre.
    // Largeur d'un téléphone courant, plus étroite que le projet mobile-375.
    await page.setViewportSize({ width: 360, height: 740 });
    await page.reload();
    await expect(
      page.getByTestId("coupon-combined-odds").first(),
    ).toBeVisible();
    const width = await page.evaluate(() => window.innerWidth);
    const cards = page.locator("[data-slot=card]").filter({
      has: page.getByTestId("coupon-combined-odds"),
    });
    const count = await cards.count();
    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      expect(box, `carte ${i}`).not.toBeNull();
      expect(box!.x, `carte ${i} bord gauche`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `carte ${i} bord droit`).toBeLessThanOrEqual(
        width + 0.5,
      );
      const tiles = card.locator("[data-testid=coupon-combined-odds]");
      const tile = await tiles.first().boundingBox();
      expect(tile!.x + tile!.width).toBeLessThanOrEqual(width + 0.5);
    }
    // Le conteneur qui défile verticalement ne doit rien avoir à faire
    // défiler horizontalement.
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("div")]
        .filter((el) => getComputedStyle(el).overflowY === "auto")
        .map((el) => el.scrollWidth - el.clientWidth)
        .reduce((max, value) => Math.max(max, value), 0),
    );
    expect(overflow).toBeLessThanOrEqual(0);
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
      first.getByText(/Favori du jour/),
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
      second.getByText(/7 jours sur 10|7 days out of 10/),
    ).toBeVisible();
    await expect(second.getByTestId("leg-odds")).toHaveCount(2);
    // La cote chez 1xBet à côté de la nôtre, par jambe et combinée.
    await expect(second.getByTestId("leg-playable-odds")).toHaveCount(2);
    await expect(second.getByTestId("coupon-playable-odds")).toHaveText(
      "@1.42",
    );
  });
});
