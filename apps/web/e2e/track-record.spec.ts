import { expect, test } from "@playwright/test";

/**
 * Mesures historiques sur le faux backend (TRACK_RECORD_SUMMARY).
 *
 * Depuis le 2026-10-28, le joueur lit la fréquence du marché (ce que la cote
 * annonçait, marge retirée) à côté du réalisé, sans verdict ni écart : la
 * probabilité du moteur et la lecture « Conforme / Optimiste » restent à
 * l'admin.
 */
test.describe("Mesures historiques", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/track-record");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Ce que nos pronostics ont vraiment donné",
      }),
    ).toBeVisible();
  });

  test("le joueur lit la fréquence du marché et le réalisé", async ({
    page,
  }) => {
    await expect(page.getByText("Fréquence du marché").first()).toBeVisible();
    await expect(
      page.getByText(/Sur 100 pronostics que la cote donnait à 75 %/),
    ).toBeVisible();
  });

  test("ni verdict ni probabilité du moteur côté joueur", async ({ page }) => {
    test.skip(
      process.env.E2E_ROLE !== "OPERATOR",
      "vue joueur : lancer avec E2E_ROLE=OPERATOR",
    );
    await expect(page.getByText("Optimiste", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Conforme", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Moteur/)).toHaveCount(0);
  });

  test("l'admin garde la lecture du moteur", async ({ page }) => {
    test.skip(
      process.env.E2E_ROLE === "OPERATOR",
      "vue admin : rôle par défaut du faux backend",
    );
    await expect(page.getByText(/Le moteur annonçait 76 %/)).toBeVisible();
  });
});
