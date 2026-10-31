import { expect, test } from "@playwright/test";

// Un visiteur : aucun cookie de session.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * La landing (11 § 1, maquettes Landing, LandingMobile), rendue côté
 * serveur sur GET /public/today du faux backend.
 */
test.describe("Landing", () => {
  test("la phrase de marque, le héros du jour sans Suivre, le bouton", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Un pari par jour. Compté, daté, pertes comprises.",
      }),
    ).toBeVisible();
    const hero = page.getByRole("region", { name: "Favori du jour" });
    await expect(hero.getByText("Paris SG", { exact: true })).toBeVisible();
    await expect(hero.getByText("1,28")).toBeVisible();
    await expect(hero.getByText("8 sur 10")).toBeVisible();
    await expect(
      hero.getByRole("img", { name: /jours gagnés sur/ }),
    ).toBeVisible();
    // Ni Suivre ni feuille : le visiteur n'a rien à ouvrir.
    await expect(hero.getByRole("button", { name: "Suivre" })).toHaveCount(0);
    await expect(hero.getByRole("link")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Créer mon compte" }),
    ).toHaveAttribute("href", "/auth/register");
    await expect(
      page.getByText("C'est gratuit. On ne prend jamais ta mise."),
    ).toBeVisible();
  });

  test("nos résultats, datés, en comptes et jamais en taux", async ({
    page,
  }) => {
    await page.goto("/");
    const results = page.getByRole("region", {
      name: "Nos résultats, depuis le 13/10",
    });
    await expect(results.getByText("11 jours gagnés sur 14")).toBeVisible();
    await expect(results.getByText("Trop tôt · 1 jour")).toBeVisible();
    await expect(results.getByText("136 avis gagnés sur 207")).toBeVisible();
    await expect(results.getByText(/%/)).toHaveCount(0);
    await expect(
      results.getByRole("link", { name: "Tout voir" }),
    ).toHaveAttribute("href", "/resultats");
  });

  test("le pied : la ligne 18+ et les quatre pages légales", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByText("18+ · Parier comporte des risques de perte"),
    ).toBeVisible();
    const legal = page.getByRole("navigation", { name: "Pages légales" });
    await expect(legal.getByRole("link")).toHaveCount(4);
    await expect(
      page.getByRole("link", { name: "Se connecter" }),
    ).toHaveAttribute("href", "/auth/login");
  });

  test("aucun script client propre à la page", async ({ page }) => {
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(scripts.some((url) => url.includes("page-"))).toBe(false);
  });

  test("l'image de partage est celle du héros du jour", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const src = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(src).toMatch(/\/opengraph-image/);
    const url = new URL(src ?? "");
    const image = await request.get(`${url.pathname}${url.search}`);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
  });
});
