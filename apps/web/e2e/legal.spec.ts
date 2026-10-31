import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

/** Les pages légales (11 § 7), dans le style de l'application. */
test.describe("Pages légales", () => {
  for (const [path, title] of [
    ["/cgu", "Conditions d'utilisation"],
    ["/confidentialite", "Politique de confidentialité"],
    ["/jeu-responsable", "Jeu responsable"],
    ["/mentions-legales", "Mentions légales"],
  ] as const) {
    test(`${path} : le titre, la date, le pied commun`, async ({ page }) => {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      await expect(page.getByText(/^Dernière mise à jour :/)).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Pages légales" })
          .getByRole("link"),
      ).toHaveCount(4);
      await expect(
        page.getByText("18+ · Parier comporte des risques de perte"),
      ).toBeVisible();
    });
  }

  test("un champ de l'éditeur manquant se voit, jamais inventé", async ({
    page,
  }) => {
    await page.goto("/mentions-legales");
    await expect(
      page.getByText("À compléter par l'éditeur").first(),
    ).toBeVisible();
  });

  test("un joueur connecté retrouve Aujourd'hui en tête", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "evcore_session",
        value: "player",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/cgu");
    await expect(
      page.getByRole("link", { name: "Aujourd'hui" }),
    ).toHaveAttribute("href", "/today");
    await expect(page.getByRole("link", { name: "Se connecter" })).toHaveCount(
      0,
    );
  });
});
