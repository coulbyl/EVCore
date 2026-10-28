import { expect, test } from "@playwright/test";
import { lastMondayAt } from "./support/dates.mjs";

/**
 * Notifications et Compte sur le faux backend, en rôle joueur (les captures
 * et la CI tournent avec E2E_ROLE=OPERATOR pour ces écrans). Ce que les deux
 * pages doivent dire depuis le 2026-10-27 : un titre, des annonces lisibles
 * avec un lien direct, aucune gravité ni onglet vide pour le joueur, un
 * réglage de jeu responsable, plus de profil de risque ni de rôle
 * « Opérateur ».
 */
test("arriver par la matinée compte une ouverture, puis efface le paramètre", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_ROLE !== "OPERATOR",
    "vue joueur : lancer avec E2E_ROLE=OPERATOR",
  );
  const event = page.waitForRequest(
    (req) => req.method() === "POST" && req.url().includes("/events"),
  );
  await page.goto("/dashboard?from=morning");
  expect((await event).postDataJSON()).toEqual({
    type: "NOTIFICATION_OPENED",
    notificationType: "MORNING_BRIEF",
  });
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("le lundi, l'Accueil montre le relevé de la semaine", async ({ page }) => {
  test.skip(
    process.env.E2E_ROLE !== "OPERATOR",
    "vue joueur : lancer avec E2E_ROLE=OPERATOR",
  );
  await page.clock.setFixedTime(lastMondayAt(10));
  await page.goto("/dashboard");
  await expect(
    page.getByText("Nos coupons : Favori 5 jours gagnés sur 7"),
  ).toBeVisible();
});

test("l'admin lit la fidélisation sur l'accueil", async ({ page }) => {
  test.skip(
    process.env.E2E_ROLE === "OPERATOR",
    "vue admin : lancer sans E2E_ROLE",
  );
  await page.goto("/dashboard");
  const card = page.getByTestId("retention-card");
  await expect(card).toContainText("Fidélisation");
  await expect(card).toContainText("Actifs / 7 j");
  await expect(card).toContainText("Matinée ouverte");
  await expect(card).toContainText("2026-10-12");
});

test.describe("Notifications", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/notifications");
    await expect(
      page.getByRole("heading", { level: 1, name: "Notifications" }),
    ).toBeVisible();
  });

  test("une annonce montre un aperçu et mène à l'annonce elle-même", async ({
    page,
  }) => {
    const row = page
      .getByTestId("notification-row")
      .filter({ hasText: "Nouvelles fiches de formation" });
    await expect(row).toContainText("lire nos pronostics");
    await expect(
      row.getByRole("link", { name: "Lire l'annonce" }),
    ).toHaveAttribute("href", "/dashboard/updates?id=ann-1");
  });

  test("la matinée mène à l'Accueil, pertes et coupons du jour compris", async ({
    page,
  }) => {
    const row = page
      .getByTestId("notification-row")
      .filter({ hasText: "Ta matinée EVCore" });
    await expect(row).toContainText("Ta matinée");
    await expect(row).toContainText("1 perdu");
    await expect(row).toContainText("Coupons du jour : Favori 1,28");
    await expect(
      row.getByRole("link", { name: "Voir l'accueil" }),
    ).toHaveAttribute("href", "/dashboard");
  });

  test("le joueur n'a ni gravité ni onglet Annonces", async ({ page }) => {
    test.skip(
      process.env.E2E_ROLE !== "OPERATOR",
      "vue joueur : lancer avec E2E_ROLE=OPERATOR",
    );
    await expect(page.getByText("Critique")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Annonces" })).toHaveCount(0);
  });
});

test.describe("Compte", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/params/account/profil");
    await expect(
      page.getByRole("heading", { level: 1, name: "Mon compte" }),
    ).toBeVisible();
  });

  test("le jeu responsable est en tête, le profil de risque a disparu", async ({
    page,
  }) => {
    await expect(page.getByText("Jeu responsable").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Lire la page Jeu responsable" }),
    ).toHaveAttribute("href", "/jeu-responsable");
    await expect(page.getByText("Offensif")).toHaveCount(0);
  });

  test("la matinée et le relevé du lundi se coupent dans Compte", async ({
    page,
  }) => {
    await page.goto("/dashboard/params/account/notifications");
    const morning = page.getByRole("switch", {
      name: "La matinée, à 8 h UTC",
    });
    await expect(morning).toBeChecked();
    await expect(
      page.getByRole("switch", { name: "Le relevé du lundi" }),
    ).toBeChecked();
    const patch = page.waitForRequest(
      (req) => req.method() === "PATCH" && req.url().includes("/auth/me"),
    );
    await morning.click();
    expect((await patch).postDataJSON()).toEqual({
      morningBriefEnabled: false,
    });
    await expect(morning).not.toBeChecked();
  });

  test("le joueur ne voit pas le rôle « Opérateur »", async ({ page }) => {
    test.skip(
      process.env.E2E_ROLE !== "OPERATOR",
      "vue joueur : lancer avec E2E_ROLE=OPERATOR",
    );
    await expect(page.getByText("Opérateur")).toHaveCount(0);
  });

  test("supprimer le compte demande le mot de passe et dit pourquoi ça échoue", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Supprimer mon compte" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("immédiat et définitif");
    const confirm = dialog.getByRole("button", {
      name: "Supprimer définitivement",
    });
    await expect(confirm).toBeDisabled();
    await dialog
      .getByLabel("Ton mot de passe, pour confirmer")
      .fill("mauvais-mot");
    await confirm.click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Mot de passe incorrect.",
    );
    await expect(page).toHaveURL(/\/dashboard\/params\/account\/profil$/);
  });

  test("changer d'adresse demande le mot de passe puis le code reçu", async ({
    page,
  }) => {
    await page
      .getByTestId("email-change-trigger")
      .filter({ visible: true })
      .click();
    const dialog = page.getByRole("dialog");
    const send = dialog.getByRole("button", { name: "Envoyer le code" });
    await expect(send).toBeDisabled();
    await dialog.getByLabel("Nouvelle adresse").fill("nouvelle@exemple.com");
    await dialog.getByLabel("Ton mot de passe").fill("un-bon-mot-de-passe");
    await send.click();
    await expect(dialog).toContainText(
      "vient de partir vers nouvelle@exemple.com",
    );
    await dialog.getByLabel("Code reçu").fill("123456");
    await dialog.getByRole("button", { name: "Confirmer" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("nouvelle@exemple.com").filter({ visible: true }),
    ).toBeVisible();
  });

  test("l'ancien onglet Personnalisation mène au profil", async ({ page }) => {
    await page.goto("/dashboard/params/account/personnalisation");
    await expect(page).toHaveURL(/\/dashboard\/params\/account\/profil$/);
  });
});

test.describe("Pause", () => {
  test("une pause masque les paris tout de suite, sans retour en arrière", async ({
    page,
  }) => {
    await page.goto("/dashboard/params/account/profil");
    const section = page.getByTestId("pause-section");
    await section.getByRole("button", { name: "Faire une pause" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Pas de retour en arrière");
    await dialog.getByRole("radio", { name: "7 jours" }).click();
    await dialog.getByRole("button", { name: "Commencer la pause" }).click();
    await expect(section).toContainText("Tu es en pause jusqu'au");
    await expect(
      section.getByRole("button", { name: "Prolonger la pause" }),
    ).toBeVisible();

    // Navigation dans l'app : la session côté client sait déjà que le
    // joueur est en pause, Coupons montre l'annonce au lieu des coupons.
    await page
      .getByRole("link", { name: "Coupons" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard\/coupons/);
    await expect(page.getByTestId("paused-notice")).toContainText(
      "Tu es en pause",
    );
    await expect(page.getByTestId("paused-notice")).toContainText(
      "Ton historique reste accessible",
    );
  });
});
