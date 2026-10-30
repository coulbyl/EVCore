import { expect, test } from "@playwright/test";

/**
 * « Matchs » (06 § 1, maquette Matchs), rendu côté serveur sur la journée
 * entière du faux backend (deux pages de GET /matches) : les puces de jour,
 * les heures, une lecture par ligne, les matchs sans lecture repliés.
 */
test.describe("Matchs", () => {
  test("les puces de jour, Aujourd'hui allumée", async ({ page }) => {
    await page.goto("/matches");
    const days = page.getByRole("navigation", { name: "Jour" });
    await expect(
      days.getByRole("link", { name: "Aujourd'hui" }),
    ).toHaveAttribute("aria-current", "true");
    await expect(days.getByRole("link", { name: "Hier" })).toHaveAttribute(
      "href",
      "/matches?day=yesterday",
    );
    await days.getByRole("link", { name: "Demain" }).click();
    await expect(page).toHaveURL(/\/matches\?day=tomorrow$/);
    await expect(days.getByRole("link", { name: "Demain" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("regroupés par heure, une lecture par ligne", async ({ page }) => {
    await page.goto("/matches");
    const at19 = page.getByRole("region", { name: "Coups d'envoi à 19:00" });
    await expect(at19.getByRole("listitem")).toHaveCount(2);
    const arsenal = at19.getByRole("listitem").filter({ hasText: "Arsenal" });
    await expect(arsenal).toContainText("Arsenal – Chelsea");
    await expect(arsenal).toContainText("Premier League");
    await expect(arsenal).toContainText("Victoire Arsenal ·");
    await expect(arsenal.getByText("7 sur 10")).toBeVisible();

    // La seconde page de l'API est lue aussi : Betis est à 20:45.
    const at2045 = page.getByRole("region", { name: "Coups d'envoi à 20:45" });
    await expect(at2045.getByRole("listitem")).toHaveCount(3);
    await expect(at2045).toContainText("Betis – Sevilla");
  });

  test("les matchs sans lecture repliés en bas, chacun avec sa raison", async ({
    page,
  }) => {
    await page.goto("/matches");
    const fold = page.locator("details");
    const summary = fold.locator("summary");
    await expect(summary).toContainText("3 matchs sans lecture");
    await expect(fold.getByText("Brest – Nice")).toBeHidden();
    await summary.click();
    for (const [match, reason] of [
      ["Brest – Nice", "Écarté"],
      ["Asec – Africa", "Pas coté chez 1xBet"],
      ["Gremio – Santos", "Pas de lecture"],
    ] as const) {
      const row = fold.getByRole("listitem").filter({ hasText: match });
      await expect(row).toBeVisible();
      await expect(row).toContainText(reason);
    }
  });

  test("jour sans match", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "evcore_session",
        value: "matches-empty",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/matches");
    await expect(page.getByText("Aucun match aujourd'hui")).toBeVisible();
    await expect(page.locator("details")).toHaveCount(0);
  });

  test("pause : l'onglet est fermé", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "evcore_session",
        value: "today-paused",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/matches");
    await expect(page.getByText(/En pause jusqu'au/)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Jour" })).toHaveCount(0);
  });
});

test.describe("Matchs, Hier, Demain et la recherche (06 § 1)", () => {
  test("Hier : le score, la lecture et son signe, le reporté remboursé", async ({
    page,
  }) => {
    await page.goto("/matches?day=yesterday");
    const psg = page
      .getByRole("listitem")
      .filter({ hasText: "Paris SG – Lens" });
    await expect(psg).toContainText("2–0");
    await expect(psg).toContainText("Victoire Paris SG");
    await expect(psg.getByRole("img", { name: "gagné" })).toBeVisible();
    const inter = page
      .getByRole("listitem")
      .filter({ hasText: "Inter – Napoli" });
    await expect(inter.getByRole("img", { name: "perdu" })).toBeVisible();
    await expect(inter).not.toContainText("sur 10");
    const brest = page
      .getByRole("listitem")
      .filter({ hasText: "Brest – Nice" });
    await expect(brest).toContainText("Rep.");
    await expect(brest).toContainText("Ligue 1 · reporté");
    await expect(brest).toContainText("Remboursé");
    await expect(page.locator("details summary")).toContainText(
      "1 match sans lecture",
    );
  });

  test("Demain : « Lecture ce soir » à son heure, pas replié", async ({
    page,
  }) => {
    await page.goto("/matches?day=tomorrow");
    const at19 = page.getByRole("region", { name: "Coups d'envoi à 19:00" });
    const arsenal = at19.getByRole("listitem").filter({ hasText: "Arsenal" });
    await expect(arsenal).toContainText("Lecture ce soir");
    await expect(
      page.getByRole("region", { name: "Coups d'envoi à 19:30" }),
    ).toContainText("Victoire Dortmund");
    await expect(page.locator("details")).toHaveCount(0);
  });

  test("la loupe filtre en tapant, y compris les matchs sans lecture", async ({
    page,
  }) => {
    await page.goto("/matches");
    await page.getByRole("button", { name: "Chercher une équipe" }).click();
    const field = page.getByRole("searchbox", { name: "Une équipe" });
    await expect(field).toBeFocused();

    await field.fill("lyo");
    await expect(page.getByText("Lyon – Lens")).toBeVisible();
    await expect(page.getByText("Arsenal – Chelsea")).toBeHidden();
    await expect(
      page.getByRole("region", { name: "Coups d'envoi à 20:45" }),
    ).toBeHidden();

    // Une équipe sans lecture : le repli s'ouvre de lui-même.
    await field.fill("asec");
    await expect(page.getByText("Asec – Africa")).toBeVisible();
    await expect(page.getByText("Brest – Nice")).toBeHidden();
    await expect(page.getByText("3 matchs sans lecture")).toBeHidden();

    await field.fill("zzz");
    await expect(
      page.getByText("Aucun match pour « zzz » aujourd'hui"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Fermer la recherche" }).click();
    await expect(page.getByText("Arsenal – Chelsea")).toBeVisible();
    await expect(page.getByText("3 matchs sans lecture")).toBeVisible();
    await expect(page.getByText("Brest – Nice")).toBeHidden();
    await expect(
      page.getByText("Aucun match pour « zzz » aujourd'hui"),
    ).toBeHidden();
  });

  test("Entrée envoie la recherche au serveur", async ({ page }) => {
    await page.goto("/matches");
    await page.getByRole("button", { name: "Chercher une équipe" }).click();
    const field = page.getByRole("searchbox", { name: "Une équipe" });
    await field.fill("lazio");
    await field.press("Enter");
    await expect(page).toHaveURL(/\/matches\?q=lazio$/);
    await expect(page.getByText("Lazio – Torino")).toBeVisible();
    await expect(page.getByText("Arsenal – Chelsea")).toHaveCount(0);
    await expect(
      page.getByRole("searchbox", { name: "Une équipe" }),
    ).toHaveValue("lazio");
  });
});
