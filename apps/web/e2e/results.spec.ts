import { expect, test, type Page } from "@playwright/test";

/**
 * « Résultats » (08 § 1, maquette Resultats), rendu côté serveur sur
 * GET /results/products du faux backend.
 */
test.describe("Résultats", () => {
  test("la ligne Hier : le jour, les issues, la cote payée après un ✓", async ({
    page,
  }) => {
    await page.goto("/results");
    const line = page.getByRole("link", { name: /^Hier / });
    await expect(line).toBeVisible();
    await expect(line).toContainText("FAV");
    await expect(line).toContainText("1,24");
    await expect(line).toContainText("C2");
    await expect(
      line.getByText("Favori : gagné, cote 1,24", { exact: true }),
    ).toBeAttached();
  });

  test("une ligne par produit : la forme et un chiffre ; trop tôt sans pourcentage", async ({
    page,
  }) => {
    await page.goto("/results");
    const rows = page.getByRole("listitem");
    const fav = rows.filter({ hasText: /^Favori/ });
    await expect(fav).toContainText("15 jours gagnés sur 18");
    await expect(
      fav.getByRole("img", {
        name: /10 derniers jours joués : 9 jours gagnés sur 10/,
      }),
    ).toBeVisible();
    const double = rows.filter({ hasText: /^Cote 2/ });
    await expect(double).toContainText("Trop tôt · 1 jour");
    const btts = rows.filter({ hasText: /^Chasseur Les deux marquent/ });
    await expect(btts).toContainText("Trop tôt · 0 jour");
    await expect(page.getByText(/%/)).toHaveCount(0);

    const ai = rows.filter({ hasText: /^Avis IA/ });
    await expect(ai).toContainText("136 avis gagnés sur 207");
    await expect(
      page.getByText(
        "Depuis le 13/10. Chaque produit compte depuis sa mise en ligne.",
      ),
    ).toBeVisible();
  });

  test("les puces de période : 90 j par défaut, 30 j relit la période", async ({
    page,
  }) => {
    await page.goto("/results");
    const periods = page.getByRole("navigation", { name: "Période" });
    await expect(periods.getByRole("link", { name: "90 j" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await periods.getByRole("link", { name: "30 j" }).click();
    await expect(page).toHaveURL(/\/results\?period=30$/);
    await expect(
      page.getByRole("listitem").filter({ hasText: /^Favori/ }),
    ).toContainText("11 jours gagnés sur 14");
  });

  test("le lundi : « Ta semaine », le compte du héros", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "evcore_session",
        value: "results-monday",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/results");
    const line = page.getByRole("link", { name: /^Ta semaine/ });
    await expect(line).toContainText("Favori");
    await expect(line).toContainText("5 jours gagnés sur 6");
    await expect(page.getByRole("link", { name: /^Hier / })).toHaveCount(0);
  });
});

/**
 * Une ligne de Résultats ouverte (08 § 2, maquette Produit) : la grille, le
 * compte et la pire série, annoncé contre réalisé, les francs, le jour par
 * jour qui ouvre le coupon réglé ; « Avis IA » avec l'avis pour unité.
 */
test.describe("Résultats, la fiche d'une ligne", () => {
  const sheetNamed = (page: Page, name: string) =>
    page
      .getByRole("dialog", { name })
      .or(page.getByRole("complementary", { name }));

  test("Favori : grille, compte, pire série, annoncé et réalisé, francs, jour par jour", async ({
    page,
  }) => {
    await page.goto("/results");
    await page.getByRole("link", { name: /^Favori/ }).click();
    await expect(page).toHaveURL(/\/results\/favourite$/, { timeout: 15_000 });
    const sheet = sheetNamed(page, "Favori du jour");
    await expect(
      sheet.getByText("un match, favori à domicile, cote 1,20 à 1,35"),
    ).toBeVisible();
    await expect(sheet.getByText("Les 90 derniers jours")).toBeVisible();
    await expect(
      sheet.getByRole("img", { name: /gagnés, 3 perdus, 1 remboursés/ }),
    ).toBeVisible();
    await expect(sheet).toContainText(
      "15 jours gagnés sur 18 · 1 jour sans Favori",
    );
    await expect(sheet).toContainText("pire série1 jour perdu de suite");
    await expect(sheet).toContainText("Annoncé?8 sur 10");
    await expect(sheet).toContainText(
      /du \d\d\/\d\d au \d\d\/\d\d · 14 jours réglés/,
    );
    await expect(sheet).toContainText("En francs, à 1 000 F par jour");
    await expect(sheet).toContainText(/misé 14\s000 F · rendu 13\s600 F/);
    await expect(
      sheet.getByText("2 jours sans cote, laissés à part"),
    ).toBeVisible();
    await expect(sheet.getByText("Jour par jour")).toBeVisible();
    await expect(sheet).toContainText("Paris SG – Lens · Victoire Paris SG");
    await expect(sheet).toContainText(/pas de Favori · /);
    await expect(sheet.getByText(/%/)).toHaveCount(0);
  });

  test("un jour ouvre son coupon réglé, ses matchs et leurs scores", async ({
    page,
  }) => {
    await page.goto("/results/favourite");
    const sheet = sheetNamed(page, "Favori du jour");
    await sheet
      .getByRole("link", { name: /Paris SG – Lens · Victoire Paris SG/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/results\/coupon\/[0-9a-f-]+$/, {
      timeout: 15_000,
    });
    const coupon = sheetNamed(page, "Favori du jour");
    await expect(
      coupon.getByRole("img", { name: "Gagné" }).first(),
    ).toBeVisible();
    await expect(coupon.getByText("Paris SG", { exact: true })).toBeVisible();
    await expect(coupon.getByRole("button", { name: "Suivre" })).toHaveCount(0);
  });

  test("la période choisie suit la fiche ; trop tôt : pas de comparaison", async ({
    page,
  }) => {
    await page.goto("/results?period=30");
    await page.getByRole("link", { name: /^Cote 2/ }).click();
    await expect(page).toHaveURL(/\/results\/double\?period=30$/, {
      timeout: 15_000,
    });
    const sheet = sheetNamed(page, "Coupon cote 2");
    await expect(sheet.getByText("Les 30 derniers jours")).toBeVisible();
    await expect(
      sheet.getByText("Trop tôt pour comparer · 1 jour réglé"),
    ).toBeVisible();
    await expect(sheet.getByText(/misé/)).toHaveCount(0);
  });

  test("Avis IA : l'avis pour unité, sur 100, le réglage changé marqué", async ({
    page,
  }) => {
    await page.goto("/results/ai");
    const sheet = sheetNamed(page, "Avis IA");
    await expect(sheet).toContainText("136 avis gagnés sur 207");
    await expect(sheet).toContainText("Annoncé?64 sur 100");
    await expect(sheet).toContainText("Réalisé66 sur 100");
    await expect(
      sheet.getByText("En francs, à 1 000 F par avis"),
    ).toBeVisible();
    await expect(sheet.getByText(/^réglage changé le/)).toBeVisible();
    await expect(sheet.getByText("Avis par avis")).toBeVisible();
  });

  test("une ligne inconnue : page introuvable", async ({ page }) => {
    await page.goto("/results/nope");
    await expect(
      page.getByRole("heading", { name: "Cette page n'existe pas." }),
    ).toBeVisible();
  });
});

/** « Hier » et « Ta semaine » ouverts (08 § 3, maquette Semaine). */
test.describe("Résultats, hier et la semaine", () => {
  const sheetNamed = (page: Page, name: string | RegExp) =>
    page
      .getByRole("dialog", { name })
      .or(page.getByRole("complementary", { name }));

  test("Hier ouvre les coupons d'hier, réglés, et les absents avec leur raison", async ({
    page,
  }) => {
    await page.goto("/results");
    await page.getByRole("link", { name: /^Hier / }).click();
    await expect(page).toHaveURL(/\/results\/yesterday$/, { timeout: 15_000 });
    const sheet = sheetNamed(page, /^Hier, /);
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole("region", { name: "Favori du jour" }),
    ).toBeVisible();
    await expect(
      sheet.getByRole("img", { name: "Gagné" }).first(),
    ).toBeVisible();
    await expect(sheet.getByText("Pas de Chasseur Corners")).toBeVisible();

    // A card opens its settled coupon.
    await sheet.getByRole("link", { name: "Ouvrir Favori du jour" }).click();
    await expect(page).toHaveURL(/\/results\/coupon\/cp-today-fav$/, {
      timeout: 15_000,
    });
  });

  test("Ta semaine : sept jours, la pastille et la cote payée, le total, mes suivis", async ({
    page,
  }) => {
    await page.goto("/results/week");
    const sheet = sheetNamed(page, "Ta semaine");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("du 19 au 25/10")).toBeVisible();
    await expect(sheet).toContainText("Favori 5 jours gagnés sur 6");
    const table = sheet.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(9);
    const monday = table.getByRole("row", { name: /lun\. 19/ });
    await expect(monday).toContainText("1,22");
    await expect(monday.getByRole("img", { name: "perdu" })).toBeVisible();
    const total = table.getByRole("row", { name: /Total/ });
    await expect(total).toContainText("5 sur 6");
    await expect(sheet).toContainText("3 gagnés · 2 perdus");
    await expect(
      sheet.getByText(
        "Le relevé du lundi, le même que la notification de 8 h.",
      ),
    ).toBeVisible();
  });
});
