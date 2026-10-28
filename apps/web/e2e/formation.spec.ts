import { expect, test } from "@playwright/test";

/**
 * Formation depuis le 2026-10-27 : cinq fiches d'une minute, dans l'ordre.
 * On ouvre la première, on la marque comme lue, on passe à la suivante ; une
 * ancienne adresse d'article mène à la fiche qui reprend son sujet.
 */
test.describe("Formation", () => {
  test("cinq fiches, lues dans l'ordre @responsive", async ({ page }) => {
    await page.goto("/dashboard/formation");
    await expect(page.getByTestId("formation-item")).toHaveCount(5);
    await page.getByTestId("formation-item").first().click();

    await expect(page.locator("h1")).toHaveText("Comment lire un pronostic ?");
    await expect(page.getByText("Fiche 1 sur 5 · 1 min")).toBeVisible();

    const button = page.getByTestId("formation-completion-button");
    await button.click();
    await expect(button).toHaveText("Lue");

    await page.getByRole("link", { name: "Fiche suivante" }).click();
    await expect(page.locator("h1")).toHaveText(
      "Une cote, c'est combien de chances ?",
    );
  });

  test("une ancienne adresse d'article mène à la nouvelle fiche", async ({
    page,
  }) => {
    await page.goto("/dashboard/formation/variance-et-patience");
    await expect(page).toHaveURL(/\/dashboard\/formation\/series-perdantes$/);
    await expect(page.locator("h1")).toHaveText(
      "Pourquoi je perds plusieurs jours de suite ?",
    );
  });
});
