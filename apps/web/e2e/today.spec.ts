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

/**
 * La feuille du coupon (04 § 1, maquette Coupon) : elle s'ouvre au toucher
 * du héros ou d'une ligne, et la même s'affiche sur un lien partagé.
 * Modale sous 1024 px, colonne de droite au-delà.
 */
test.describe("Feuille du coupon", () => {
  const sheetNamed = (
    page: import("@playwright/test").Page,
    name: string | RegExp,
  ) =>
    page
      .getByRole("dialog", { name })
      .or(page.getByRole("complementary", { name }));

  test("le héros l'ouvre : matchs, fait, forme, pire série, marge 1xBet, Suivre", async ({
    page,
  }) => {
    await page.goto("/today");
    await page.getByRole("link", { name: "Ouvrir Favori du jour" }).click();
    // En dev, la première ouverture compile la route interceptée.
    await expect(page).toHaveURL(/\/today\/coupon\/cp-today-fav$/, {
      timeout: 15_000,
    });
    const sheet = sheetNamed(page, "Favori du jour");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Paris SG", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Victoire Paris SG")).toBeVisible();
    await expect(
      sheet.getByText("Le PSG a gagné ses 9 derniers matchs à domicile"),
    ).toBeVisible();
    await expect(sheet.getByText("Forme sur 30 jours")).toBeVisible();
    await expect(
      sheet.getByText("21 jours gagnés sur 24", { exact: true }),
    ).toBeVisible();
    await expect(sheet.getByText("· pire série 1")).toBeVisible();
    await expect(
      sheet.getByText(/^1xBet garde 6\s%\ssur ce pari\?$/),
    ).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Suivre" })).toBeVisible();
  });

  test("une ligne l'ouvre ; un combiné dit « sur ce coupon »", async ({
    page,
  }) => {
    await page.goto("/today");
    await page
      .getByRole("list", { name: "Autres coupons du jour" })
      .getByRole("link", { name: /Combiné du jour/ })
      .click();
    const sheet = sheetNamed(page, "Combiné du jour");
    await expect(sheet).toBeVisible();
    for (const team of ["Arsenal", "Inter", "Benfica"]) {
      await expect(sheet.getByText(team, { exact: true })).toBeVisible();
    }
    await expect(
      sheet.getByText(/^1xBet garde 9\s%\ssur ce coupon\?$/),
    ).toBeVisible();
  });

  test("sur un lien partagé : la même feuille, la bande du chasseur au titre", async ({
    page,
  }) => {
    await page.goto("/today/coupon/cp-today-nul");
    const sheet = sheetNamed(page, "Chasseur Nul · 2,90 à 3,60");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Lazio", { exact: true })).toBeVisible();
    // L'écran Aujourd'hui reste dessous.
    await expect(
      page.getByRole("region", { name: "Favori du jour" }),
    ).toBeAttached();
  });

  // Le chargement de l'onglet a déjà ouvert le flux : Next garde 200 et
  // ajoute noindex (docs Next, streaming, « Status codes »).
  test("un coupon inconnu : page introuvable, non indexée", async ({
    page,
  }) => {
    await page.goto("/today/coupon/nope");
    await expect(page.getByText("Page introuvable")).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      "noindex",
    );
  });
});

/** Le geste signature (13-style.md § 5) : le seul mouvement de l'application. */
test.describe("Les diodes du héros", () => {
  test("s'allument de gauche à droite à l'ouverture, une fois", async ({
    page,
  }) => {
    await page.goto("/today");
    const hero = page.getByRole("region", { name: "Favori du jour" });
    const lit = hero.locator(".animate-led-light");
    await expect(lit).toHaveCount(8);
    const delays = await lit.evaluateAll((nodes) =>
      nodes.map((n) => parseInt((n as HTMLElement).style.animationDelay, 10)),
    );
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(Math.max(...delays)).toBeLessThan(300);
  });

  test("restent immobiles quand le téléphone demande moins de mouvement", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/today");
    const first = page
      .getByRole("region", { name: "Favori du jour" })
      .locator(".animate-led-light")
      .first();
    expect(await first.evaluate((n) => getComputedStyle(n).animationName)).toBe(
      "none",
    );
  });
});
