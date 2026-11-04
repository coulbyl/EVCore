import { expect, test } from "@playwright/test";

/**
 * L'analyse d'un match (12-admin § 2), ouverte à tout joueur connecté
 * depuis le 04/11, depuis l'icône de la fiche de match : buts attendus avec
 * le nom des équipes, facteurs en mots, lectures écartées avec leur motif ;
 * pas d'EV, ni canal, ni marge.
 */
test.describe("Analyse du match", () => {
  test("se lit sans jargon", async ({ page }) => {
    await page.goto("/matches/fx-m1/analysis");
    await expect(page.locator("h1")).toHaveText("Arsenal – Burnley");
    await expect(page.getByTestId("sheet-expected")).toHaveText(
      "Arsenal environ 1,6 but, Burnley environ 0,9 but : 2,6 buts en moyenne.",
    );
    await expect(page.getByText("avantage Arsenal").first()).toBeVisible();

    const group = page.getByTestId("sheet-rejected-group").first();
    await group.locator("summary").click();
    await expect(
      group.getByText("Les deux équipes marquent", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/\bEV\b/)).toHaveCount(0);
    await expect(page.getByText("Viable")).toHaveCount(0);
    await expect(page.getByText(/\bcanal\b/i)).toHaveCount(0);
    await expect(page.getByText(/marge/i)).toHaveCount(0);
  });
});
