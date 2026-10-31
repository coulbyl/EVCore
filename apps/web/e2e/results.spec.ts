import { expect, test } from "@playwright/test";

/**
 * « Résultats » (08 § 1, maquette Resultats), rendu côté serveur sur
 * GET /results/products du faux backend.
 */
test.describe("Résultats", () => {
  test("la ligne Hier : le jour, les issues, la cote payée après un ✓", async ({
    page,
  }) => {
    await page.goto("/results");
    const line = page.getByRole("list", { name: "Hier" });
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
        "depuis le 13/10 · chaque ligne à sa date de mise en ligne",
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

  test("le lundi : « Ta semaine » à la place de Hier", async ({
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
    await expect(page.getByText("Ta semaine")).toBeVisible();
    await expect(page.getByText("9 jours gagnés sur 12")).toBeVisible();
    await expect(page.getByRole("list", { name: "Hier" })).toHaveCount(0);
  });
});
