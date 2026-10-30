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
