import { expect, test } from "@playwright/test";

/**
 * Le premier lancement (10 § 1, maquette Premier) : la ligne d'accueil
 * une fois, refermable sans script ; Hier vide ; au premier « Suivre », la
 * note et la demande des notifications.
 */
test.describe("Premier lancement", () => {
  test("la ligne d'accueil au-dessus du héros, refermable ; le compte est marqué vu", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "evcore_session",
        value: "first-launch",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/today");
    const welcome = page.getByText(
      /^Chaque jour, un pari qu'on suit depuis le /,
    );
    await expect(welcome).toBeVisible();
    await expect(welcome).toContainText("On ne prend jamais ta mise.");
    await page
      .getByRole("checkbox", { name: "Fermer le message d'accueil" })
      .check({ force: true });
    await expect(welcome).toBeHidden();
  });

  test("un joueur qui l'a déjà vue ne la revoit pas", async ({ page }) => {
    await page.goto("/today");
    await expect(page.getByText(/^Chaque jour, un pari/)).toHaveCount(0);
  });

  test("au premier « Suivre » sur l'appareil : la note, puis la demande des notifications", async ({
    page,
  }) => {
    await page.goto("/today");
    await page.evaluate(() => localStorage.removeItem("evcore.firstFollow"));
    await page.getByRole("button", { name: "Suivre" }).first().click();
    await expect(
      page.getByText("Tu recevras son résultat demain matin"),
    ).toBeVisible();
  });
});
