import { expect, test } from "@playwright/test";

/**
 * « Jeu responsable » (09 § 4, maquette JeuResponsable) : la pause
 * confirmée en une ligne, prolongeable seulement, l'aide, la suppression
 * du compte avec le mot de passe.
 */
test.describe("Jeu responsable", () => {
  test("une pause se confirme en une ligne, avec la date de retour", async ({
    page,
  }) => {
    await page.goto("/me/responsible");
    await expect(
      page.getByRole("heading", { name: "Jeu responsable" }),
    ).toBeVisible();
    await expect(page.getByText(/Parier doit rester un jeu/)).toBeVisible();
    const lengths = page.getByRole("group", { name: "Durée de la pause" });
    await expect(lengths.getByRole("button")).toHaveText([
      "24 heures",
      "7 jours",
      "30 jours",
    ]);
    await lengths.getByRole("button", { name: "7 jours" }).click();
    await expect(
      page.getByText(
        /^L'application sera fermée jusqu'au \d\d\/\d\d à \d\d:\d\d\. Tu ne pourras pas revenir avant\.$/,
      ),
    ).toBeVisible();
    const paused = page.waitForRequest(
      (r) => r.url().endsWith("/auth/me/pause") && r.method() === "POST",
    );
    await page.getByRole("button", { name: "Faire la pause" }).click();
    expect((await paused).postDataJSON()).toEqual({ days: 7 });
  });

  test("en pause : la date de retour, seulement les durées qui prolongent", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "evcore_session",
        value: "today-paused",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/me/responsible");
    await expect(page.getByText(/^En pause jusqu'au/)).toBeVisible();
    const lengths = page.getByRole("group", { name: "Durée de la pause" });
    await expect(
      lengths.getByRole("button", { name: "24 heures" }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Seules les durées qui prolongent ta pause/),
    ).toBeVisible();
  });

  test("l'aide et le lien vers les numéros par pays", async ({ page }) => {
    await page.goto("/me/responsible");
    await expect(
      page.getByText("SOS Joueurs · 09 74 75 13 13 (France)"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Les numéros d'aide par pays/ }),
    ).toHaveAttribute("href", "/jeu-responsable");
  });

  test("supprimer mon compte : le mot de passe, puis tout part", async ({
    page,
  }) => {
    await page.goto("/me/responsible");
    await page.getByText("Supprimer mon compte").click();
    await expect(
      page.getByText(
        /Tes coupons suivis, tes messages et ton compte sont supprimés/,
      ),
    ).toBeVisible();
    await page.getByLabel("Mot de passe").fill("secret-123");
    const removed = page.waitForRequest(
      (r) => r.url().endsWith("/auth/me/delete") && r.method() === "POST",
    );
    await page
      .getByRole("button", { name: "Supprimer définitivement" })
      .click();
    expect((await removed).postDataJSON()).toEqual({ password: "secret-123" });
  });
});
