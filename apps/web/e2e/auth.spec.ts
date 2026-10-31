import { expect, test } from "@playwright/test";

// Un visiteur : aucun cookie de session.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Where the form sent the browser once signed in. The mock answers on
 * 127.0.0.1 and the page on localhost: its session cookie is not this
 * site's, so the proxy sends the screen back to sign-in with `next` set to
 * it — the screen asked for is in the address either way.
 */
function landedOn(path: string): RegExp {
  const escaped = path.replace(/\//g, "\\/");
  return new RegExp(`(${escaped}$|next=${encodeURIComponent(path)}$)`);
}

/**
 * L'inscription, la connexion et le mot de passe oublié (11 § 2–5,
 * maquettes Inscription, Connexion) sur le faux backend, qui répond selon
 * le corps : « deja@ » est inscrit, « mauvais » est faux, « app@ » a une
 * application, 123456 et le lien « bon » passent.
 */
test.describe("Créer mon compte", () => {
  test("trois champs, deux cases jamais cochées, les erreurs sous chaque champ", async ({
    page,
  }) => {
    await page.goto("/auth/register");
    await expect(
      page.getByRole("heading", { level: 1, name: "Créer mon compte" }),
    ).toBeVisible();
    for (const field of ["Prénom", "E-mail", "Mot de passe"]) {
      await expect(page.getByLabel(field)).toBeVisible();
    }
    await expect(page.getByLabel(/nom d'utilisateur/i)).toHaveCount(0);
    for (const box of await page.getByRole("checkbox").all()) {
      await expect(box).not.toBeChecked();
    }
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("Indique ton prénom.")).toBeVisible();
    await expect(page.getByText("Cet e-mail n'est pas valide.")).toBeVisible();
    await expect(page.getByText("8 caractères au moins.")).toBeVisible();
    await expect(
      page.getByText("Coche cette case pour créer ton compte."),
    ).toHaveCount(2);
    await expect(page.getByLabel("Prénom")).toBeFocused();
  });

  test("un e-mail déjà inscrit propose de se connecter", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByLabel("Prénom").fill("Kouassi");
    await page.getByLabel("E-mail").fill("deja@exemple.com");
    await page.getByLabel("Mot de passe").fill("une phrase longue");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("checkbox").last().check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("Cet e-mail a déjà un compte")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Se connecter" }).first(),
    ).toHaveAttribute("href", "/auth/login");
  });

  test("inscrit : la vérification de l'e-mail suit", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByLabel("Prénom").fill("Kouassi");
    await page.getByLabel("E-mail").fill("kouassi@exemple.com");
    await page.getByLabel("Mot de passe").fill("une phrase longue");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("checkbox").last().check();
    // The mock's account is already verified and its cookie is not this
    // site's: the page goes on from /auth/verify. The form went there.
    const verify = page.waitForRequest((request) =>
      request.url().endsWith("/auth/verify"),
    );
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await verify;
  });
});

test.describe("Se connecter", () => {
  test("une erreur en une ligne, les champs gardés ; afficher le mot de passe", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await page.getByLabel("E-mail").fill("kouassi@exemple.com");
    await page.getByLabel("Mot de passe").fill("mauvais");
    await page.getByRole("button", { name: "afficher" }).click();
    await expect(page.getByLabel("Mot de passe")).toHaveAttribute(
      "type",
      "text",
    );
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(
      page.getByText("E-mail ou mot de passe incorrect"),
    ).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveValue("kouassi@exemple.com");
  });

  test("avec une application : six chiffres de plus, puis Aujourd'hui", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await page.getByLabel("E-mail").fill("app@exemple.com");
    await page.getByLabel("Mot de passe").fill("une phrase longue");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.getByLabel("Le code de ton application").fill("123456");
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page).toHaveURL(landedOn("/today"));
  });

  test("l'écran demandé avant la connexion est rouvert", async ({ page }) => {
    await page.goto("/auth/login?next=%2Fresults");
    await page.getByLabel("E-mail").fill("kouassi@exemple.com");
    await page.getByLabel("Mot de passe").fill("une phrase longue");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(landedOn("/results"));
  });
});

test.describe("Mot de passe oublié", () => {
  test("l'e-mail, puis « regarde tes e-mails », sans dire si le compte existe", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    await page.getByLabel("E-mail").fill("kouassi@exemple.com");
    await page.getByRole("button", { name: "Recevoir le lien" }).click();
    await expect(
      page.getByText(
        "Si un compte existe pour kouassi@exemple.com, on vient d'y envoyer un lien.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Écrire à l'équipe" }),
    ).toHaveAttribute("href", /^mailto:/);
  });

  test("le lien ouvre le nouveau mot de passe, puis la connexion le dit", async ({
    page,
  }) => {
    await page.goto("/auth/reset-password?token=bon");
    await page.getByLabel("Nouveau mot de passe").fill("court");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByText("8 caractères au moins.")).toBeVisible();
    await page.getByLabel("Nouveau mot de passe").fill("une phrase longue");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?reset=success$/);
    await expect(
      page.getByText("Mot de passe changé. Connecte-toi avec le nouveau."),
    ).toBeVisible();
  });

  test("un lien usé : en demander un autre", async ({ page }) => {
    await page.goto("/auth/reset-password?token=vieux");
    await page.getByLabel("Nouveau mot de passe").fill("une phrase longue");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(
      page.getByRole("link", { name: "Demander un nouveau lien" }),
    ).toBeVisible();
  });
});
