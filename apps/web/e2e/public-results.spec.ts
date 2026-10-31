import { expect, test } from "@playwright/test";

// Un visiteur : aucun cookie de session.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * /resultats (11 § 1) : l'onglet Résultats en lecture seule, sans compte,
 * sur les routes publiques du faux backend.
 */
test.describe("/resultats, sans compte", () => {
  test("les mêmes lignes que l'onglet, en comptes, jamais en taux", async ({
    page,
  }) => {
    await page.goto("/resultats");
    await expect(page).toHaveURL(/\/resultats$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Résultats" }),
    ).toBeVisible();
    const rows = page.getByRole("listitem");
    await expect(rows.filter({ hasText: /^Favori/ })).toContainText(
      "15 jours gagnés sur 18",
    );
    await expect(rows.filter({ hasText: /^Cote 2/ })).toContainText(
      "Trop tôt · 1 jour",
    );
    await expect(rows.filter({ hasText: /^Avis IA/ })).toContainText(
      "136 avis gagnés sur 207",
    );
    await expect(page.getByText(/%/)).toHaveCount(0);
    await expect(
      page.getByText("18+ · Parier comporte des risques de perte"),
    ).toBeVisible();
  });

  test("les puces de période restent sur /resultats", async ({ page }) => {
    await page.goto("/resultats");
    await page.getByRole("link", { name: "30 j" }).click();
    await expect(page).toHaveURL(/\/resultats\?period=30$/);
  });

  test("une ligne ouverte : le détail en page, sans coupon ni aide", async ({
    page,
  }) => {
    await page.goto("/resultats");
    await page.getByRole("link", { name: /^Favori/ }).click();
    await expect(page).toHaveURL(/\/resultats\/favourite$/, {
      timeout: 15_000,
    });
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: "Favori du jour" }),
    ).toBeVisible();
    await expect(main).toContainText(
      "15 jours gagnés sur 18 · 1 jour sans Favori",
    );
    await expect(main).toContainText("Annoncé8 sur 10");
    await expect(main).toContainText("Paris SG – Lens · Victoire Paris SG");
    // Le coupon d'un jour et la fiche d'aide demandent un compte.
    await expect(
      main.getByRole("link", { name: /Paris SG – Lens/ }),
    ).toHaveCount(0);
    await expect(main.getByRole("link", { name: /Aide/ })).toHaveCount(0);
    await main.getByRole("link", { name: "Résultats" }).click();
    await expect(page).toHaveURL(/\/resultats$/);
  });

  test("l'Avis IA ouvert, et une ligne de joueur introuvable", async ({
    page,
  }) => {
    await page.goto("/resultats/ai");
    await expect(
      page.getByRole("heading", { level: 1, name: "Avis IA" }),
    ).toBeVisible();
    const response = await page.goto("/resultats/yesterday");
    expect(response?.status()).toBe(404);
  });
});
