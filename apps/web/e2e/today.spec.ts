import { expect, test, type BrowserContext } from "@playwright/test";

async function playAs(context: BrowserContext, session: string) {
  await context.addCookies([
    { name: "evcore_session", value: session, domain: "localhost", path: "/" },
  ]);
}

/**
 * « Aujourd'hui » (02 § 1, 04, maquette Main), rendu côté serveur sur la
 * réponse de GET /today du faux backend : la ligne Hier, le héros désigné
 * par le serveur, les autres coupons, l'absent et sa raison.
 */
test.describe("Aujourd'hui", () => {
  test("le héros : produit, match, pari, cote, chance, forme, Suivre", async ({
    page,
  }) => {
    await page.goto("/today");
    const hero = page.getByRole("region", { name: "Favori du jour" });
    await expect(hero).toBeVisible();
    await expect(hero.getByText("Paris SG", { exact: true })).toBeVisible();
    await expect(hero.getByText("Lens", { exact: true })).toBeVisible();
    await expect(hero.getByText("Victoire Paris SG")).toBeVisible();
    await expect(hero.getByText("1,28")).toBeVisible();
    await expect(hero.getByText("8 sur 10")).toBeVisible();
    await expect(
      hero.getByText("Le PSG a gagné ses 9 derniers matchs à domicile"),
    ).toBeVisible();
    await expect(
      hero.getByRole("img", { name: /jours gagnés sur/ }),
    ).toBeVisible();
    await expect(hero.getByRole("button", { name: "Suivre" })).toBeVisible();
  });

  test("la ligne Hier mène à Résultats", async ({ page }) => {
    await page.goto("/today");
    const line = page.getByRole("link", {
      name: "Hier Favori : gagné Combiné : gagné Coupon cote 2 : perdu",
    });
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute("href", "/results");
    await expect(line.getByText("FAV", { exact: true })).toBeVisible();
  });

  test("les autres coupons en lignes, l'absent en gris avec sa raison", async ({
    page,
  }) => {
    await page.goto("/today");
    const rows = page.getByRole("list", { name: "Autres coupons du jour" });
    await expect(rows.getByText("Combiné du jour")).toBeVisible();
    await expect(rows.getByText("3 matchs")).toBeVisible();
    await expect(rows.getByText("1,41")).toBeVisible();
    await expect(rows.getByText("Chasseur Nul")).toBeVisible();
    await expect(rows.getByText("Lazio – Torino")).toBeVisible();
    await expect(
      rows.getByText("Pas de Chasseur Corners aujourd'hui"),
    ).toBeVisible();
    await expect(
      rows.getByText(
        "aucun championnat dont les stats de corners arrivent à coup sûr",
      ),
    ).toBeVisible();
  });

  test("Suivre passe par l'API puis recharge l'écran", async ({ page }) => {
    await page.goto("/today");
    const follow = page.waitForRequest(
      (request) =>
        request.url().endsWith("/coupons/cp-today-fav/follow") &&
        request.method() === "POST",
    );
    await page.getByRole("button", { name: "Suivre" }).click();
    await follow;
  });
});

test.describe("Aujourd'hui, ses états (04 § 2, § 5)", () => {
  test("le soir : ✓ à la place de la cote, scores, Suivi, plus de bouton", async ({
    page,
    context,
  }) => {
    await playAs(context, "today-evening");
    await page.goto("/today");
    const hero = page.getByRole("region", { name: "Favori du jour" });
    await expect(hero.getByText(/Terminé/)).toBeVisible();
    await expect(
      hero.getByRole("img", { name: "Gagné", exact: true }),
    ).toBeVisible();
    await expect(hero.getByText("2", { exact: true })).toBeVisible();
    await expect(hero.getByText("Suivi", { exact: true })).toBeVisible();
    await expect(hero.getByRole("button", { name: "Suivre" })).toHaveCount(0);

    const rows = page.getByRole("list", { name: "Autres coupons du jour" });
    await expect(
      rows.getByRole("img", { name: "Perdu", exact: true }),
    ).toBeVisible();
    await expect(rows.getByText("Remboursé")).toBeVisible();
  });

  test("rien à jouer : chaque produit dit pourquoi, lien vers Matchs", async ({
    page,
    context,
  }) => {
    await playAs(context, "today-nothing");
    await page.goto("/today");
    const card = page.getByRole("region", { name: "Rien à jouer aujourd'hui" });
    await expect(card).toBeVisible();
    await expect(
      card.getByText("aucun favori à domicile entre 1,20 et 1,35"),
    ).toBeVisible();
    await expect(
      card.getByRole("link", { name: "Voir les matchs du jour" }),
    ).toHaveAttribute("href", "/matches");
    // La ligne Hier reste.
    await expect(page.getByRole("link", { name: /^Hier/ })).toBeVisible();
  });

  test("panne : une ligne, sans heure", async ({ page, context }) => {
    await playAs(context, "today-outage");
    await page.goto("/today");
    await expect(
      page.getByText("Pas de coupon pour l'instant · réessaie plus tard"),
    ).toBeVisible();
    await expect(page.getByRole("region")).toHaveCount(0);
  });

  test("pause : ni coupon ni ligne Hier", async ({ page, context }) => {
    await playAs(context, "today-paused");
    await page.goto("/today");
    await expect(page.getByText(/En pause jusqu'au/)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Hier/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Suivre" })).toHaveCount(0);
  });

  test("hors ligne : Suivre grisé", async ({ page, context }) => {
    await page.goto("/today");
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "Suivre" })).toBeDisabled();
    await context.setOffline(false);
  });
});
