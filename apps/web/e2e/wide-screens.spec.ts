import { expect, test } from "@playwright/test";

/**
 * L'ordinateur (10 § 4) : le même contenu, une autre disposition — les
 * quatre onglets en colonne à gauche avec la cloche et l'initiale en bas,
 * une colonne centrale bornée, les feuilles dans une colonne à droite (par-
 * dessus sur tablette), la barre du ticket dans la colonne centrale.
 */
const SCREENS = [
  "/today",
  "/matches",
  "/results",
  "/me",
  "/me/account",
  "/notifications",
];

test.describe("Grands écrans", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-1280",
      "Disposition des écrans larges : vérifiée à 1280 px.",
    );
  });

  for (const path of SCREENS) {
    test(`${path} : colonne gauche, pas de barre du bas, contenu borné`, async ({
      page,
    }) => {
      await page.goto(path);
      const rail = page.getByRole("navigation", { name: "Onglets" }).first();
      await expect(rail).toBeVisible();
      // The brand, the four tabs, then the bell and the initial at the foot.
      await expect(rail.getByRole("link")).toHaveCount(7);
      await expect(
        page.getByRole("link", { name: /^Notifications/ }).last(),
      ).toBeVisible();
      const main = page.locator("main#contenu");
      const box = await main.boundingBox();
      expect(box?.width ?? 0).toBeLessThanOrEqual(640 + 1);
      // The bottom tabs are for the phone only.
      const bottom = page.locator("nav[aria-label='Onglets'].fixed");
      if (await bottom.count()) await expect(bottom).toBeHidden();
    });
  }

  test("une feuille s'ouvre en colonne à droite, la liste reste lisible", async ({
    page,
  }) => {
    await page.goto("/results");
    await page.getByRole("link", { name: /^Favori/ }).click();
    const sheet = page.getByRole("complementary", { name: "Favori du jour" });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const sheetBox = await sheet.boundingBox();
    const mainBox = await page.locator("main#contenu").boundingBox();
    expect(sheetBox!.x).toBeGreaterThanOrEqual(mainBox!.x + mainBox!.width - 1);
    // The list beside it still answers.
    await expect(
      page.getByRole("link", { name: /^Combiné/ }).first(),
    ).toBeVisible();
  });

  test("la barre du ticket tient dans la colonne centrale", async ({
    page,
  }) => {
    await page.goto("/matches/00000000-0000-4000-8000-617273000000");
    await page
      .getByRole("button", { name: "Ajouter à mon ticket – Victoire Arsenal" })
      .first()
      .click();
    await page.goto("/matches");
    const bar = page.getByRole("link", { name: "Ouvrir mon ticket" });
    await expect(bar).toBeVisible();
    const barBox = await bar.boundingBox();
    const mainBox = await page.locator("main#contenu").boundingBox();
    expect(barBox!.x).toBeGreaterThanOrEqual(mainBox!.x - 1);
    expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(
      mainBox!.x + mainBox!.width + 1,
    );
  });
});

test.describe("Tablette", () => {
  test("une feuille reste par-dessus, comme sur téléphone", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "tablet-768", "Tablette seulement.");
    await page.goto("/results/favourite");
    await expect(
      page.getByRole("dialog", { name: "Favori du jour" }),
    ).toBeVisible();
  });
});
