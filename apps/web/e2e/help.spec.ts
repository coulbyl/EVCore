import { expect, test, type Page } from "@playwright/test";

/**
 * « Aide » (09 § 3, maquette Aide) : l'index des huit fiches, chacune en
 * feuille ; le « ? » contextuel ouvre la même fiche par-dessus l'écran.
 */
const sheetNamed = (page: Page, name: string) =>
  page
    .getByRole("dialog", { name })
    .or(page.getByRole("complementary", { name }));

test.describe("Aide", () => {
  test("l'index : huit fiches, puis « Une question ? Écris-nous »", async ({
    page,
  }) => {
    await page.goto("/me/help");
    await expect(page.getByRole("heading", { name: "Aide" })).toBeVisible();
    const sheets = page.getByRole("list", { name: "Les fiches" });
    await expect(sheets.getByRole("listitem")).toHaveCount(8);
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

  test("le « ? » à côté de l'annoncé ouvre la fiche par-dessus Résultats", async ({
    page,
  }) => {
    await page.goto("/results/favourite");
    await page
      .getByRole("link", { name: "Aide : « 8 sur 10 », ça veut dire quoi" })
      .click();
    await expect(page).toHaveURL(/\/me\/help\/chances$/, { timeout: 15_000 });
    await expect(
      sheetNamed(page, "« 8 sur 10 », ça veut dire quoi"),
    ).toContainText("11 jours gagnés sur 14");
  });
});
