import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * Juste après l'inscription, le formulaire envoie vers /auth/verify avec une
 * session ouverte. Jusqu'au 2026-10-30, toutes les pages /auth renvoyaient un
 * visiteur connecté vers le tableau de bord : la vérification du compte
 * n'était jamais montrée. Seules les pages « déconnecté » (connexion,
 * inscription, mot de passe oublié) le font désormais.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(context: BrowserContext, session: string) {
  await context.addCookies([
    { name: "evcore_session", value: session, domain: "localhost", path: "/" },
  ]);
}

test("un compte tout juste inscrit voit la vérification", async ({
  page,
  context,
}) => {
  await signIn(context, "unverified");
  await page.goto("/auth/verify");
  await expect(page).toHaveURL(/\/auth\/verify$/);
  await expect(
    page.getByRole("button", { name: /Vérification par email/ }),
  ).toBeVisible();
  // Jamais imposée (11 § 4) : on peut passer.
  await expect(page.getByRole("link", { name: "Plus tard" })).toBeVisible();
});

test("un compte déjà vérifié repart vers le tableau de bord", async ({
  page,
  context,
}) => {
  await signIn(context, "e2e");
  await page.goto("/auth/verify");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("connecté, la page de connexion renvoie au tableau de bord", async ({
  page,
  context,
}) => {
  await signIn(context, "unverified");
  await page.goto("/auth/login");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("sans session, la vérification renvoie à la connexion", async ({
  page,
}) => {
  await page.goto("/auth/verify");
  await expect(page).toHaveURL(/\/auth\/login$/);
});
