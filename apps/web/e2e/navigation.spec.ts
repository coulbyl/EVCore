import { expect, test, type Page } from "@playwright/test";

/**
 * Les retours et les feuilles, d'un écran à l'autre (04/11) :
 *
 * - une feuille à la fois : une feuille ouverte depuis une feuille la
 *   remplace (SheetLink), et la refermer ramène à l'écran dessous ; sauf
 *   l'Aide d'un « ? », qui se referme sur la fiche d'où elle vient ;
 * - refermer (croix, Échap, retour du navigateur) ramène à l'écran sous la
 *   feuille, et le retour du navigateur fait la même chose que la croix ;
 * - une vraie page ouverte depuis une feuille la referme ;
 * - le retour d'une page revient là d'où l'on vient, ou à l'écran parent
 *   sans historique (lien direct, rechargement), et son libellé dit lequel ;
 *   au joueur comme au visiteur ;
 * - une adresse de feuille rechargée : l'écran dessous et la feuille.
 *
 * Sur le faux backend, au téléphone comme sur écran large.
 */
const sheetNamed = (page: Page, name: string | RegExp) =>
  page
    .getByRole("dialog", { name })
    .or(page.getByRole("complementary", { name }));

/** Any sheet on screen, modal (phone) or column (wide screen). */
const anySheet = (page: Page) =>
  page.locator(
    "[role=dialog][aria-labelledby], [role=complementary][aria-labelledby]",
  );

const arsenalRow = (page: Page) =>
  page.getByRole("listitem").filter({ hasText: "Arsenal" }).first();

const MATCH = /Arsenal – Chelsea/;
/** Arsenal – Chelsea of the fake backend's Matchs. */
const ARSENAL_CHELSEA = "00000000-0000-4000-8000-617273000000";
const MATCH_URL = /\/matches\/[^/]+$/;

async function openMatchFromList(page: Page) {
  await page.goto("/matches");
  await arsenalRow(page).getByRole("link").first().click();
  // En dev, la première ouverture compile la route interceptée.
  await expect(page).toHaveURL(MATCH_URL, { timeout: 15_000 });
  const sheet = sheetNamed(page, MATCH);
  await expect(sheet).toBeVisible();
  return sheet;
}

async function closeWithCross(page: Page) {
  await anySheet(page).getByRole("button", { name: "Fermer" }).click();
}

/** The band's way back, not the tab of the same name. */
const backLink = (page: Page, label: string) =>
  page.locator(`a[aria-label="${label}"]`);

const historyLength = (page: Page) => page.evaluate(() => history.length);

test.beforeEach(async ({ context }) => {
  // A player's screens (an admin has its own tabs).
  await context.addCookies([
    { name: "evcore_session", value: "player", domain: "localhost", path: "/" },
  ]);
});

test.describe("Une feuille se referme sur l'écran dessous", () => {
  test("par la croix", async ({ page }) => {
    await openMatchFromList(page);
    await closeWithCross(page);
    await expect(page).toHaveURL(/\/matches$/);
    await expect(anySheet(page)).toHaveCount(0);
    await expect(arsenalRow(page)).toBeVisible();
  });

  test("par Échap", async ({ page }) => {
    const sheet = await openMatchFromList(page);
    await expect(sheet).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/matches$/);
    await expect(anySheet(page)).toHaveCount(0);
  });

  test("par le retour du navigateur, et l'avance la rouvre", async ({
    page,
  }) => {
    await openMatchFromList(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/matches$/);
    await expect(anySheet(page)).toHaveCount(0);
    await page.goForward();
    await expect(sheetNamed(page, MATCH)).toBeVisible();
  });

  test("rechargée : Matchs et la feuille ; la croix remplace l'adresse", async ({
    page,
  }) => {
    await openMatchFromList(page);
    await page.reload();
    await expect(sheetNamed(page, MATCH)).toBeVisible();
    await expect(arsenalRow(page)).toBeAttached();
    const before = await historyLength(page);
    await closeWithCross(page);
    await expect(page).toHaveURL(/\/matches$/);
    await expect(anySheet(page)).toHaveCount(0);
    // A pushed entry would reopen the sheet on the browser's back.
    expect(await historyLength(page)).toBe(before);
  });

  test("ouverte d'un lien direct : la croix mène à l'écran dessous", async ({
    page,
  }) => {
    await page.goto("/today/coupon/cp-today-nul");
    await expect(sheetNamed(page, /Chasseur Nul/)).toBeVisible();
    await closeWithCross(page);
    await expect(page).toHaveURL(/\/today$/);
    await expect(anySheet(page)).toHaveCount(0);
  });
});

test.describe("Une feuille ouverte depuis une feuille la remplace", () => {
  test("Résultats : un produit, puis un de ses jours", async ({ page }) => {
    await page.goto("/results");
    await page.getByRole("link", { name: /^Favori/ }).click();
    await expect(page).toHaveURL(/\/results\/favourite$/, { timeout: 15_000 });
    await sheetNamed(page, "Favori du jour")
      .getByRole("link", { name: /Paris SG – Lens · Victoire Paris SG/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/results\/coupon\/[0-9a-f-]+$/, {
      timeout: 15_000,
    });
    await expect(anySheet(page)).toHaveCount(1);
    await closeWithCross(page);
    await expect(page).toHaveURL(/\/results$/);
    await expect(anySheet(page)).toHaveCount(0);
  });

  test("le retour du navigateur fait comme la croix", async ({ page }) => {
    await page.goto("/results");
    await page.getByRole("link", { name: /^Favori/ }).click();
    await expect(page).toHaveURL(/\/results\/favourite$/, { timeout: 15_000 });
    await sheetNamed(page, "Favori du jour")
      .getByRole("link", { name: /Paris SG – Lens · Victoire Paris SG/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/results\/coupon\/[0-9a-f-]+$/, {
      timeout: 15_000,
    });
    await page.goBack();
    await expect(page).toHaveURL(/\/results$/);
    await expect(anySheet(page)).toHaveCount(0);
  });

  test("le « ? » d'une fiche ouvre l'Aide par-dessus, refermée sur la fiche", async ({
    page,
  }) => {
    await page.goto("/results");
    await page.getByRole("link", { name: /^Favori/ }).click();
    await expect(page).toHaveURL(/\/results\/favourite$/, { timeout: 15_000 });
    await page
      .getByRole("link", { name: "Aide : « 8 sur 10 », ça veut dire quoi" })
      .click();
    await expect(page).toHaveURL(/\/me\/help\/chances$/, { timeout: 15_000 });
    await expect(anySheet(page)).toHaveCount(1);
    // The exception to « one sheet at a time » (09 § 3): back to the sheet
    // the « ? » was in, then to the screen under it.
    await closeWithCross(page);
    await expect(page).toHaveURL(/\/results\/favourite$/);
    await expect(sheetNamed(page, "Favori du jour")).toBeVisible();
    await closeWithCross(page);
    await expect(page).toHaveURL(/\/results$/);
    await expect(anySheet(page)).toHaveCount(0);
  });

  test("écran large : un autre match de la liste", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("desktop"),
      "la liste est inerte sous une feuille modale",
    );
    await openMatchFromList(page);
    const firstUrl = page.url();
    await page
      .getByRole("listitem")
      .filter({ hasNotText: "Arsenal" })
      .filter({ has: page.locator("a[href^='/matches/']") })
      .first()
      .getByRole("link")
      .first()
      .click();
    await expect(page).not.toHaveURL(firstUrl);
    await expect(anySheet(page)).toHaveCount(1);
    await closeWithCross(page);
    await expect(page).toHaveURL(/\/matches$/);
    await expect(anySheet(page)).toHaveCount(0);
  });

  test("écran large : le ticket ouvert de sa barre, sur un match", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("desktop"),
      "la barre est inerte sous une feuille modale",
    );
    const sheet = await openMatchFromList(page);
    await sheet
      .getByRole("button", { name: /^Ajouter à mon ticket – / })
      .first()
      .click();
    await page.getByRole("link", { name: "Ouvrir mon ticket" }).click();
    await expect(page).toHaveURL(/\/ticket$/, { timeout: 15_000 });
    await expect(sheetNamed(page, "Mon ticket")).toBeVisible();
    await expect(anySheet(page)).toHaveCount(1);
    await closeWithCross(page);
    await expect(page).toHaveURL(/\/matches$/);
    await expect(anySheet(page)).toHaveCount(0);
  });
});

test.describe("Une page ouverte depuis une feuille la referme", () => {
  test("l'analyse du match ; son retour rouvre la feuille sur Matchs", async ({
    page,
  }) => {
    const sheet = await openMatchFromList(page);
    await sheet.getByRole("link", { name: "Analyse du match" }).click();
    await expect(page).toHaveURL(/\/analysis$/, { timeout: 15_000 });
    await expect(page.locator("h1")).toHaveText(MATCH);
    await expect(anySheet(page)).toHaveCount(0);

    await backLink(page, "Retour au match").click();
    await expect(page).toHaveURL(MATCH_URL);
    await expect(sheetNamed(page, MATCH)).toBeVisible();
    // Matchs under the sheet, not the analysis.
    await expect(
      page.getByRole("heading", { level: 1, name: MATCH }),
    ).toHaveCount(0);
    await expect(arsenalRow(page)).toBeAttached();

    await closeWithCross(page);
    await expect(page).toHaveURL(/\/matches$/);
    await expect(anySheet(page)).toHaveCount(0);
  });

  test("l'analyse, puis le retour du navigateur : la feuille", async ({
    page,
  }) => {
    const sheet = await openMatchFromList(page);
    await sheet.getByRole("link", { name: "Analyse du match" }).click();
    await expect(page).toHaveURL(/\/analysis$/, { timeout: 15_000 });
    await page.goBack();
    await expect(page).toHaveURL(MATCH_URL);
    await expect(sheetNamed(page, MATCH)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: MATCH }),
    ).toHaveCount(0);
  });

  test("le lien d'une fiche d'Aide mène à Résultats, sans feuille", async ({
    page,
  }) => {
    await page.goto("/me/help");
    await page
      .getByRole("link", { name: "« 8 sur 10 », ça veut dire quoi" })
      .click();
    await expect(page).toHaveURL(/\/me\/help\/chances$/, { timeout: 15_000 });
    await anySheet(page)
      .getByRole("link", { name: /Voir nos résultats/ })
      .click();
    await expect(page).toHaveURL(/\/results$/, { timeout: 15_000 });
    await expect(anySheet(page)).toHaveCount(0);
  });
});

test.describe("Le retour d'une page", () => {
  test("avec historique : revient en arrière, sans pousser d'entrée", async ({
    page,
  }) => {
    await page.goto("/me");
    await page.getByRole("link", { name: "Compte" }).click();
    await expect(page).toHaveURL(/\/me\/account$/);
    await backLink(page, "Retour à Moi").click();
    await expect(page).toHaveURL(/\/me$/);
    // It went back: the account is ahead, not behind.
    await page.goForward();
    await expect(page).toHaveURL(/\/me\/account$/);
  });

  test("sans historique : l'écran parent, à la place de la page", async ({
    page,
  }) => {
    for (const [path, label, parent] of [
      ["/me/account", "Retour à Moi", /\/me$/],
      ["/me/help", "Retour à Moi", /\/me$/],
      ["/me/responsible", "Retour à Moi", /\/me$/],
      ["/me/messages", "Retour à Moi", /\/me$/],
      ["/notifications", "Retour à Aujourd'hui", /\/today$/],
    ] as const) {
      await page.goto(path);
      const before = await historyLength(page);
      await backLink(page, label).click();
      await expect(page, path).toHaveURL(parent);
      expect(await historyLength(page), path).toBe(before);
    }
  });

  test("l'analyse sans historique : Matchs et la feuille du match, sans recharger", async ({
    page,
  }) => {
    await page.goto(`/matches/${ARSENAL_CHELSEA}/analysis`);
    await expect(page.locator("h1")).toHaveText(MATCH);
    await page.reload();
    await expect(page.locator("h1")).toHaveText(MATCH);
    await expect(anySheet(page)).toHaveCount(0);
    // A full load would lose this mark.
    await page.evaluate(() => {
      (window as { navMark?: number }).navMark = 1;
    });
    await backLink(page, "Retour au match").click();
    await expect(page).toHaveURL(MATCH_URL);
    await expect(sheetNamed(page, MATCH)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: MATCH }),
    ).toHaveCount(0);
    await expect(arsenalRow(page)).toBeAttached();
    expect(
      await page.evaluate(() => (window as { navMark?: number }).navMark),
    ).toBe(1);
    // Matchs is behind the sheet: closing it leads there.
    await closeWithCross(page);
    await expect(page).toHaveURL(/\/matches$/);
    await expect(anySheet(page)).toHaveCount(0);
  });

  test("la cloche, ouverte d'un onglet, y revient et le dit", async ({
    page,
  }) => {
    await page.goto("/results");
    // The rail's bell sits under Next's dev indicator on a wide screen.
    await page.locator("a[href='/notifications']:visible").first().focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/notifications$/);
    await backLink(page, "Retour aux résultats").click();
    await expect(page).toHaveURL(/\/results$/);
  });

  test("le libellé suit l'écran d'avant, et revient au parent sans historique", async ({
    page,
  }) => {
    await page.goto("/notifications");
    await expect(backLink(page, "Retour à Aujourd'hui")).toBeVisible();
    await page.goto("/me");
    await page.getByRole("link", { name: "Aide" }).click();
    await expect(page).toHaveURL(/\/me\/help$/);
    await expect(backLink(page, "Retour à Moi")).toBeVisible();
  });
});

/**
 * Les retours du visiteur (11 § 2–5, /resultats) : les mêmes règles, avec
 * le bandeau du visiteur.
 */
test.describe("Le retour d'un écran du visiteur", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("la connexion, ouverte de la landing, y revient", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Se connecter" }).first().click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await backLink(page, "Retour à l'accueil").click();
    await expect(page).toHaveURL(/\/$/);
    // It went back: the sign-in is ahead.
    await page.goForward();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("le mot de passe oublié, ouvert de la connexion, y revient", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    await backLink(page, "Retour à la connexion").click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
  });

  test("une ligne de /resultats revient à la liste", async ({ page }) => {
    await page.goto("/resultats");
    await page.getByRole("link", { name: /^Favori/ }).click();
    await expect(page).toHaveURL(/\/resultats\/favourite$/, {
      timeout: 15_000,
    });
    await backLink(page, "Retour aux résultats").click();
    await expect(page).toHaveURL(/\/resultats$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/resultats\/favourite$/);
  });

  test("sans historique : l'écran parent, à la place de la page", async ({
    page,
  }) => {
    for (const [path, label, parent] of [
      ["/auth/login", "Retour à l'accueil", /\/$/],
      ["/auth/register", "Retour à l'accueil", /\/$/],
      ["/auth/forgot-password", "Retour à la connexion", /\/auth\/login$/],
      ["/resultats/favourite", "Retour aux résultats", /\/resultats$/],
    ] as const) {
      await page.goto(path);
      const before = await historyLength(page);
      await backLink(page, label).click();
      await expect(page, path).toHaveURL(parent);
      expect(await historyLength(page), path).toBe(before);
    }
  });
});
