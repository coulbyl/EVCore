import { expect, test } from "@playwright/test";

/**
 * « Moi » (09 § 1, maquette Moi), rendu côté serveur sur GET /me du faux
 * backend : le prénom et mon bilan, En cours · Réglés, les quatre lignes,
 * « Se déconnecter ».
 */
test.describe("Moi", () => {
  test("le prénom, mon bilan, la date du premier suivi", async ({ page }) => {
    await page.goto("/me");
    await expect(page.getByText("Kouassi", { exact: true })).toBeVisible();
    await expect(
      page.getByText("7 gagnés · 4 perdus · 1 remboursé"),
    ).toBeVisible();
    await expect(
      page.getByText("coupons suivis depuis le 13/10"),
    ).toBeVisible();
  });

  test("En cours par défaut ; un coupon ouvre sa feuille d'Aujourd'hui", async ({
    page,
  }) => {
    await page.goto("/me");
    const tabs = page.getByRole("navigation", { name: "Mes coupons suivis" });
    await expect(tabs.getByRole("link", { name: "En cours" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    const running = page.getByRole("list", { name: "En cours" });
    const fav = running.getByRole("link", { name: /Favori du jour/ });
    await expect(fav).toContainText("Paris SG – Lens · Victoire Paris SG");
    await expect(fav).toContainText("1,28");
    await expect(fav).toHaveAttribute("href", "/today/coupon/cp-today-fav");
  });

  test("Réglés : la pastille et la cote payée, « Voir plus » lit la page suivante", async ({
    page,
  }) => {
    await page.goto("/me?tab=settled");
    const settled = page.getByRole("list", { name: "Réglés" });
    await expect(settled.getByRole("listitem")).toHaveCount(2);
    await expect(settled.getByRole("img", { name: "Gagné" })).toBeVisible();
    await expect(
      settled.getByRole("link", { name: /Favori du jour/ }),
    ).toHaveAttribute("href", "/results/coupon/cp-today-fav");
    await page.getByRole("link", { name: "Voir plus" }).click();
    await expect(page).toHaveURL(/tab=settled&more=1$/);
    await expect(settled.getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Voir plus" })).toHaveCount(0);
  });

  test("les quatre lignes, « 1 réponse » sur Messages", async ({ page }) => {
    await page.goto("/me");
    const messages = page.getByRole("link", { name: /^Messages/ });
    await expect(messages).toContainText("1 réponse");
    await expect(messages).toHaveAttribute("href", "/me/messages");
    for (const [name, href] of [
      ["Aide", "/me/help"],
      ["Jeu responsable", "/me/responsible"],
      ["Compte", "/me/account"],
    ] as const) {
      await expect(page.getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  test("sans aucun suivi : « Suis ton premier coupon » vers Aujourd'hui", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "evcore_session",
        value: "me-new",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/me");
    await expect(
      page.getByRole("link", { name: "Suis ton premier coupon" }),
    ).toHaveAttribute("href", "/today");
    await expect(page.getByText("Aucun coupon suivi en cours")).toBeVisible();
  });

  test("Se déconnecter ferme la session et mène à la connexion", async ({
    page,
  }) => {
    await page.goto("/me");
    const logout = page.waitForRequest(
      (r) => r.url().endsWith("/auth/logout") && r.method() === "POST",
    );
    // The mock backend does not clear the cookie as the real one does: the
    // sign-in page would send a session still open back to the dashboard.
    const signIn = page.waitForRequest(
      (r) => r.isNavigationRequest() && r.url().includes("/auth/login"),
    );
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await logout;
    await signIn;
  });
});
