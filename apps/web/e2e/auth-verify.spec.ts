import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * Juste après l'inscription, le formulaire envoie vers /auth/verify avec une
 * session ouverte (11 § 4) : l'e-mail seul, qu'on peut passer. Les pages
 * « déconnecté » (connexion, inscription, mot de passe oublié) renvoient un
 * visiteur connecté vers Aujourd'hui.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(context: BrowserContext, session: string) {
  await context.addCookies([
    { name: "evcore_session", value: session, domain: "localhost", path: "/" },
  ]);
}

test("un compte tout juste inscrit voit la vérification de l'e-mail", async ({
  page,
  context,
}) => {
  await signIn(context, "unverified");
  await page.goto("/auth/verify");
  await expect(
    page.getByRole("heading", { level: 1, name: "Vérifie ton e-mail" }),
  ).toBeVisible();
  await expect(page.getByText(/On a envoyé un code à .+@/)).toBeVisible();
  // Renvoyer attend 30 s ; jamais imposée (11 § 4) : on peut passer.
  await expect(
    page.getByRole("button", { name: /Renvoyer le code \(dans \d+ s\)/ }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "Plus tard" })).toHaveAttribute(
    "href",
    "/today",
  );
  // Plus d'application d'authentification dans ce parcours (11 § 6).
  await expect(page.getByText(/authentification/)).toHaveCount(0);
});

test("un mauvais code se dit sous le champ, le bon mène à Aujourd'hui", async ({
  page,
  context,
}) => {
  await signIn(context, "unverified");
  await page.goto("/auth/verify");
  await page.getByLabel("Le code reçu").fill("000000");
  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page.getByText("Code incorrect ou expiré.")).toBeVisible();
  await page.getByLabel("Le code reçu").fill("123456");
  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page).toHaveURL(/\/today$/);
});

test("un joueur déjà vérifié repart vers Aujourd'hui", async ({
  page,
  context,
}) => {
  await signIn(context, "player");
  await page.goto("/auth/verify");
  await expect(page).toHaveURL(/\/today$/);
});

test("l'admin, lui, garde le tableau de bord", async ({ page, context }) => {
  await signIn(context, "e2e");
  await page.goto("/auth/verify");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("connecté, la page de connexion renvoie à Aujourd'hui", async ({
  page,
  context,
}) => {
  await signIn(context, "player");
  await page.goto("/auth/login");
  await expect(page).toHaveURL(/\/today$/);
});

test("sans session, la vérification renvoie à la connexion", async ({
  page,
}) => {
  await page.goto("/auth/verify");
  await expect(page).toHaveURL(/\/auth\/login/);
});
