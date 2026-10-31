import { expect, test, type Page } from "@playwright/test";

/**
 * « Aide » (09 § 3, maquette Aide) : l'index des neuf fiches, chacune en
 * feuille ; le « ? » contextuel ouvre la même fiche par-dessus l'écran.
 */
const sheetNamed = (page: Page, name: string) =>
  page
    .getByRole("dialog", { name })
    .or(page.getByRole("complementary", { name }));

test.describe("Aide", () => {
  test("l'index : neuf fiches, puis « Une question ? Écris-nous »", async ({
    page,
  }) => {
    await page.goto("/me/help");
    await expect(page.getByRole("heading", { name: "Aide" })).toBeVisible();
    const sheets = page.getByRole("list", { name: "Les fiches" });
    await expect(sheets.getByRole("listitem")).toHaveCount(9);
    await expect(
      page.getByRole("link", { name: "Une question ? Écris-nous" }),
    ).toHaveAttribute("href", "/me/messages");
  });

  test("une fiche s'ouvre en feuille : quelques lignes, un exemple chiffré, un lien", async ({
    page,
  }) => {
    await page.goto("/me/help");
    await page
      .getByRole("link", { name: "« 8 sur 10 », ça veut dire quoi" })
      .click();
    await expect(page).toHaveURL(/\/me\/help\/chances$/, { timeout: 15_000 });
    const sheet = sheetNamed(page, "« 8 sur 10 », ça veut dire quoi");
    await expect(sheet.getByText("Exemple")).toBeVisible();
    await expect(sheet).toContainText("11 jours gagnés sur 14");
    await expect(
      sheet.getByRole("link", { name: /Voir nos résultats/ }),
    ).toHaveAttribute("href", "/results");
  });

  test("le « ? » à côté de « 1xBet garde » ouvre la fiche par-dessus le coupon", async ({
    page,
  }) => {
    await page.goto("/today/coupon/cp-today-fav");
    await page.getByRole("link", { name: "Aide : Ce que 1xBet garde" }).click();
    await expect(page).toHaveURL(/\/me\/help\/what-1xbet-keeps$/, {
      timeout: 15_000,
    });
    await expect(sheetNamed(page, "Ce que 1xBet garde")).toContainText(
      "1xBet garde 44 %",
    );
  });
});
