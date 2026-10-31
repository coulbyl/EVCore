import { expect, test, type Page } from "@playwright/test";

/**
 * Les parcours du joueur (15-todo.md, E3) : des gestes enchaînés d'un écran
 * à l'autre par la navigation elle-même — onglets, lignes, feuilles —
 * là où chaque fichier d'e2e teste un écran à part. Sur le faux backend.
 */
const sheetNamed = (page: Page, name: string) =>
  page
    .getByRole("dialog", { name })
    .or(page.getByRole("complementary", { name }));

/** The tab of the bottom bar (phone) or the rail (wide screen). */
const tab = (page: Page, name: string) =>
  page.getByRole("navigation").getByRole("link", { name, exact: true }).first();

test.describe("Parcours du joueur", () => {
  test("le matin : le coupon du jour, sa feuille, Suivre", async ({ page }) => {
    await page.goto("/today");
    await page
      .getByRole("list", { name: "Autres coupons du jour" })
      .getByRole("link", { name: /Combiné du jour/ })
      .click();
    const sheet = sheetNamed(page, "Combiné du jour");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/today$/);

    const follow = page.waitForRequest(
      (request) =>
        request.url().endsWith("/coupons/cp-today-fav/follow") &&
        request.method() === "POST",
    );
    await page.getByRole("button", { name: "Suivre" }).click();
    await follow;
  });

  test("composer un ticket : Matchs, la fiche, [+], la barre, la feuille", async ({
    page,
  }) => {
    await page.goto("/today");
    await tab(page, "Matchs").click();
    await expect(page).toHaveURL(/\/matches$/);
    await page
      .getByRole("listitem")
      .filter({ hasText: "Arsenal" })
      .getByRole("link")
      .first()
      .click();
    await page
      .getByRole("button", { name: /^Ajouter à mon ticket – / })
      .first()
      .click();
    await page.keyboard.press("Escape");
    const bar = page.getByRole("link", { name: "Ouvrir mon ticket" });
    await expect(bar).toContainText("1 match");
    await bar.click();
    const ticket = sheetNamed(page, "Mon ticket");
    await expect(ticket.getByRole("listitem")).toHaveCount(1);
    await expect(ticket.getByText("Cote totale")).toBeVisible();
  });

  test("le soir : Résultats, une ligne ouverte, puis Moi et Compte", async ({
    page,
  }) => {
    await page.goto("/today");
    await tab(page, "Résultats").click();
    await expect(page).toHaveURL(/\/results$/);
    await page.getByRole("link", { name: /^Favori/ }).click();
    await expect(sheetNamed(page, "Favori du jour")).toBeVisible();
    await expect(sheetNamed(page, "Favori du jour")).toContainText(
      "Jour par jour",
    );
    // A modal sheet (phone) leaves the tabs inert: closed first.
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/results$/);
    await tab(page, "Moi").click();
    await expect(page).toHaveURL(/\/me$/);
    await page.getByRole("link", { name: "Compte" }).click();
    await expect(page).toHaveURL(/\/me\/account$/);
  });
});
